import { Box } from '@riascout-ui/styled-system/jsx';

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
import type { FacetDefinition, ProspectRow } from '../../types/prospecting';

export type ProspectResultsProps = {
  rows: ProspectRow[];
  columns: FacetDefinition[];
};

/**
 * A plain table, not ag-grid: results are a capped page rather than 510k rows,
 * so the SSRM machinery would buy nothing here.
 */
export const ProspectResults = ({ rows, columns }: ProspectResultsProps) => (
  <Box flex="1" overflow="auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>In CRM</TableHead>
          {columns.map((column) => (
            <TableHead key={column.attributeId}>{column.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.sourceCrd}>
            <TableCell>
              {row.recordId ? (
                <Span color="text.placeholder" fontSize="xs">
                  Saved
                </Span>
              ) : null}
            </TableCell>
            {columns.map((column) => {
              const cell = row.values.find(
                (v) => v.attributeId === column.attributeId,
              );
              const Renderer = rendererFor(
                column.kind === 'number' ? 'number' : 'text',
              );

              return (
                <TableCell key={column.attributeId}>
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
