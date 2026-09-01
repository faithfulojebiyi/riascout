import { Box } from '@riascout-ui/styled-system/jsx';

import { Checkbox } from '../../../../ui/primitives/checkbox/checkbox';

import { GRID_ROW_HEIGHT } from '../../../../ui/primitives/data-grid';
import { TableSkeleton } from '../../../../ui/primitives/skeleton/table-skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table';
import { Span } from '../../../../ui/primitives/text';
import { rendererForColumn } from '../../../entities/components/attribute-renderers';
import type { ProspectRow } from '../../types/prospecting';

/** attributeId is null until the facets land; the column still holds its place */
export type ProspectColumn = {
  allowKey: string;
  label: string;
  width: string | null;
  attributeId: string | null;
  type: string;
  isArray: boolean;
  options?: { value: string; label: string }[];
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

/** shared with the entity grid, so the two tables cannot drift apart */
const ROW_H = `${GRID_ROW_HEIGHT}px`;

const CHECKBOX_W = '2.75rem';
const IN_CRM_W = '4.5rem';
const MIN_W = '48rem';

/**
 * Empty rows drawn as a gradient rather than DOM nodes, so the table still reads
 * as a grid when a filter leaves three results. Measuring the container to emit
 * real filler rows would need a ResizeObserver for no visible gain.
 */
const fillerRows = {
  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${GRID_ROW_HEIGHT - 1}px, token(colors.brand.panel.4) ${GRID_ROW_HEIGHT - 1}px, token(colors.brand.panel.4) ${GRID_ROW_HEIGHT}px)`,
  flex: '1',
  minH: '0',
};

/**
 * A plain table, not ag-grid: results are a capped page rather than 510k rows,
 * so the SSRM machinery would buy nothing here.
 *
 * Layout is fixed and the narrow columns declare their width, so the name column
 * absorbs the slack instead of the table overflowing. Auto layout re-measured on
 * every render, which moved the header when the facets resolved and again when
 * the rows replaced the skeleton.
 */
export const ProspectResults = ({
  rows,
  columns,
  isLoading,
  onRowClick,
  onToggle,
  onToggleAll,
  selected,
}: ProspectResultsProps) => {
  if (isLoading) {
    return (
      <TableSkeleton
        columns={[
          { isControl: true, key: 'select', width: CHECKBOX_W },
          { key: 'in-crm', label: 'In CRM', width: IN_CRM_W },
          ...columns.map((column) => ({
            key: column.allowKey,
            label: column.label,
            width: column.width,
          })),
        ]}
        minW={MIN_W}
        rowHeight={ROW_H}
      />
    );
  }

  return (
    <Box
      display="flex"
      flex="1"
      flexDirection="column"
      minH="0"
      overflow="auto"
    >
      {/* Table here is the unstyled primitive, so the size has to be set on it */}
      <Table
        fontSize="1"
        minW={MIN_W}
        style={{ tableLayout: 'fixed' }}
        w="full"
      >
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
          {rows.map((row) => (
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
                const Renderer = rendererForColumn(
                  column.allowKey,
                  column.type,
                  column.isArray,
                );

                return (
                  <TableCell key={column.allowKey} overflow="hidden">
                    <Renderer options={column.options} value={cell?.value} />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box css={fillerRows} />
    </Box>
  );
};
