import { z } from 'zod';

import type { AttributeType } from '@orm/app';

import type { FilterOperator } from './ast.js';

/**
 * (attribute type, operator) → SQL predicate. Operator semantics live here;
 * path joins and tree composition live in the compiler.
 *
 * Every value reaches SQL through addParam. Nothing is interpolated — not even
 * a number that zod has already validated.
 */
export type OperatorContext = {
  /** typed-column reference chosen by the compiler, e.g. "v_t.text_value" */
  columnExpr: string;
  value: unknown;
  addParam: (value: unknown) => string;
};

export type OperatorDescriptor = {
  /** throws ZodError on mismatch; the caller maps that to a 400 */
  parseValue: (raw: unknown) => unknown;
  emit: (ctx: OperatorContext) => string;
};

const stringValue = z.string();
const numberValue = z.union([z.number(), z.coerce.number()]);
const dateValue = z.union([z.iso.datetime({ offset: true }), z.iso.date(), z.date()]);
const booleanValue = z.union([z.boolean(), z.stringbool()]);
const stringArrayValue = z.array(z.string()).min(1);
const numberRangeValue = z.tuple([numberValue, numberValue]);
const dateRangeValue = z.tuple([dateValue, dateValue]);
const positiveInt = z.number().int().min(1);

const parse =
  <T>(schema: z.ZodType<T>) =>
  (raw: unknown): T =>
    schema.parse(raw);

const binary = (
  op: string,
  parser: (raw: unknown) => unknown,
  cast = '',
): OperatorDescriptor => ({
  parseValue: parser,
  emit: (ctx) => `${ctx.columnExpr} ${op} ${ctx.addParam(parser(ctx.value))}${cast}`,
});

const like = (
  wrap: (value: string) => string,
  negated = false,
): OperatorDescriptor => ({
  parseValue: parse(stringValue),
  emit: (ctx) =>
    `${ctx.columnExpr} ${negated ? 'NOT ILIKE' : 'ILIKE'} ${ctx.addParam(wrap(parse(stringValue)(ctx.value)))}`,
});

const isEmpty: OperatorDescriptor = {
  parseValue: () => null,
  emit: (ctx) => `${ctx.columnExpr} IS NULL`,
};

const isNotEmpty: OperatorDescriptor = {
  parseValue: () => null,
  emit: (ctx) => `${ctx.columnExpr} IS NOT NULL`,
};

const between = (parser: (raw: unknown) => readonly unknown[]): OperatorDescriptor => ({
  parseValue: parser,
  emit: (ctx) => {
    const [lo, hi] = parser(ctx.value);

    return `${ctx.columnExpr} BETWEEN ${ctx.addParam(lo)} AND ${ctx.addParam(hi)}`;
  },
});

/**
 * make_interval takes the day count as a bound parameter. Ghost built this as
 * INTERVAL '${n} days' — safe there because n is zod-parsed, but it puts a
 * value in the SQL text, which is the habit we do not want.
 */
const withinLastNDays: OperatorDescriptor = {
  parseValue: parse(positiveInt),
  emit: (ctx) =>
    `${ctx.columnExpr} >= NOW() - make_interval(days => ${ctx.addParam(parse(positiveInt)(ctx.value))})`,
};

const isAnyOf: OperatorDescriptor = {
  parseValue: parse(stringArrayValue),
  emit: (ctx) => `${ctx.columnExpr} = ANY(${ctx.addParam(parse(stringArrayValue)(ctx.value))})`,
};

const isNoneOf: OperatorDescriptor = {
  parseValue: parse(stringArrayValue),
  emit: (ctx) => `${ctx.columnExpr} <> ALL(${ctx.addParam(parse(stringArrayValue)(ctx.value))})`,
};

type OperatorMap = Partial<Record<FilterOperator, OperatorDescriptor>>;

const TEXT_OPS: OperatorMap = {
  is: binary('=', parse(stringValue)),
  isNot: binary('<>', parse(stringValue)),
  contains: like((v) => `%${v}%`),
  notContains: like((v) => `%${v}%`, true),
  startsWith: like((v) => `${v}%`),
  endsWith: like((v) => `%${v}`),
  isAnyOf,
  isNoneOf,
  isEmpty,
  isNotEmpty,
};

const NUMBER_OPS: OperatorMap = {
  is: binary('=', parse(numberValue)),
  isNot: binary('<>', parse(numberValue)),
  isLessThan: binary('<', parse(numberValue)),
  isGreaterThan: binary('>', parse(numberValue)),
  isBetween: between(parse(numberRangeValue)),
  isEmpty,
  isNotEmpty,
};

const DATE_OPS: OperatorMap = {
  is: binary('=', parse(dateValue), '::timestamptz'),
  isNot: binary('<>', parse(dateValue), '::timestamptz'),
  isBefore: binary('<', parse(dateValue), '::timestamptz'),
  isAfter: binary('>', parse(dateValue), '::timestamptz'),
  isBetween: between(parse(dateRangeValue)),
  isWithinLastNDays: withinLastNDays,
  isEmpty,
  isNotEmpty,
};

const SELECT_OPS: OperatorMap = {
  is: binary('=', parse(stringValue)),
  isNot: binary('<>', parse(stringValue)),
  isAnyOf,
  isNoneOf,
  isEmpty,
  isNotEmpty,
};

const BOOLEAN_OPS: OperatorMap = {
  is: binary('=', parse(booleanValue)),
  isNot: binary('<>', parse(booleanValue)),
  isEmpty,
  isNotEmpty,
};

const REGISTRY: Record<AttributeType, OperatorMap> = {
  text: TEXT_OPS,
  email: TEXT_OPS,
  phone: TEXT_OPS,
  url: TEXT_OPS,
  domain: TEXT_OPS,
  location: TEXT_OPS,
  country: TEXT_OPS,

  number: NUMBER_OPS,
  currency: NUMBER_OPS,
  percentage: NUMBER_OPS,
  rating: NUMBER_OPS,

  date: DATE_OPS,
  timestamp: DATE_OPS,

  boolean: BOOLEAN_OPS,
  checkbox: BOOLEAN_OPS,

  status: SELECT_OPS,
  select: SELECT_OPS,
  user: SELECT_OPS,
  record: SELECT_OPS,

  file: { isEmpty, isNotEmpty },
  // relationship existence lives in the path compiler, not here
  relationship: {},
};

export const operatorRegistry = {
  resolve(type: AttributeType, operator: FilterOperator): OperatorDescriptor | null {
    return REGISTRY[type]?.[operator] ?? null;
  },
};
