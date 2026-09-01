import { Box } from '@riascout-ui/styled-system/jsx';

import { Checkbox } from '../../../../ui/primitives/checkbox/checkbox';

import { Skeleton } from '../../../../ui/primitives/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table';
import { Span } from '../../../../ui/primitives/text';
import { rendererFor } from '../../../entities/components/attribute-renderers';
import type { ProspectRow } from '../../types/prospecting';

/** attributeId is null until the facets land; the column still holds its place */
export type ProspectColumn = {
  allowKey: string;
  label: string;
  width: string | null;
  attributeId: string | null;
  type: string;
  isArray: boolean;
};

export type ProspectResultsProps = {
  rows: ProspectRow[];
  columns: ProspectColumn[];
  isLoading: boolean;
  onRowClick: (row: ProspectRow) => void;
  selected: Set<string>;
  onToggle: (sourceCrd: string) => void;
  onToggleAll: () => void;
};

/** enough to fill a viewport, so the skeleton does not end mid-scroll */
const SKELETON_ROWS = 12;

/**
 * Pinned on both the skeleton and the data rows. Left to content, a skeleton
 * row is shorter than a real one — the checkbox is taller than a line of text —
 * and the whole table jumps when the first page arrives.
 */
const ROW_H = '2.125rem';

const CHECKBOX_W = '2.75rem';
const IN_CRM_W = '4.5rem';

/** varied so the loading state reads as content, not as a progress bar */
const BAR_W = ['72%', '54%', '81%', '63%'];

/**
 * A plain table, not ag-grid: results are a capped page rather than 510k rows,
 * so the SSRM machinery would buy nothing here.
 *
 * Layout is fixed and the narrow columns declare their width, so the name
 * column absorbs the slack instead of the table overflowing. Auto layout
 * re-measured on every render, which moved the header when the facets resolved
 * and again when the rows replaced the skeleton.
 */
export const ProspectResults = ({
  rows,
  columns,
  isLoading,
  onRowClick,
  onToggle,
  onToggleAll,
  selected,
}: ProspectResultsProps) => (
  <Box flex="1" overflow="auto">
    {/* Table here is the unstyled primitive, so the size has to be set on it */}
    <Table fontSize="1" minW="48rem" style={{ tableLayout: 'fixed' }} w="full">
      <colgroup>
        <col style={{ width: CHECKBOX_W }} />
        <col style={{ width: IN_CRM_W }} />
        {columns.map((column) => (
          <col
            key={column.allowKey}
            style={column.width ? { width: column.width } : undefined}
          />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow h={ROW_H}>
          <TableHead>
            <Checkbox
              checked={rows.length > 0 && selected.size === rows.length}
              disabled={isLoading}
              onCheckedChange={onToggleAll}
            />
          </TableHead>
          <TableHead>In CRM</TableHead>
          {columns.map((column) => (
            <TableHead key={column.allowKey}>{column.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading
          ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
              <TableRow h={ROW_H} key={`skeleton-${row}`}>
                <TableCell>
                  {/* the real control, so the row is exactly as tall as a data row */}
                  <Checkbox checked={false} disabled />
                </TableCell>
                <TableCell />
                {columns.map((column, index) => (
                  <TableCell key={column.allowKey}>
                    <Skeleton
                      display="block"
                      h="0.6875rem"
                      loading
                      w={BAR_W[(row + index) % BAR_W.length]}
                    >
                      <Span>&nbsp;</Span>
                    </Skeleton>
                  </TableCell>
                ))}
              </TableRow>
            ))
          : rows.map((row) => (
              <TableRow
                h={ROW_H}
                key={row.sourceCrd}
                onClick={() => onRowClick(row)}
                style={{ cursor: 'pointer' }}
              >
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(row.sourceCrd)}
                    onCheckedChange={() => onToggle(row.sourceCrd)}
                  />
                </TableCell>
                <TableCell>
                  {row.recordId ? (
                    <Span color="text.placeholder" fontSize="1">
                      Saved
                    </Span>
                  ) : null}
                </TableCell>
                {columns.map((column) => {
                  const cell = row.values.find(
                    (v) => v.attributeId === column.attributeId,
                  );
                  const Renderer = rendererFor(column.type, column.isArray);

                  return (
                    <TableCell key={column.allowKey} overflow="hidden">
                      <Renderer value={cell?.value} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  </Box>
);
