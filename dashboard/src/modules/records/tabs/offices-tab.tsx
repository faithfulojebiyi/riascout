import { useQuery } from '@tanstack/react-query';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/primitives/table';
import { firmOfficesQuery } from '../record-queries';
import { NeverFiled, NoMarketLink, NothingReported, TabLoading } from './tab-state';

/** loaded whole rather than paged: the largest firm reports 246 offices */
export const OfficesTab = ({ firmCrd }: { firmCrd: string | null }) => {
  const query = useQuery({ ...firmOfficesQuery(firmCrd ?? ''), enabled: !!firmCrd });

  if (!firmCrd) {
    return <NoMarketLink />;
  }

  if (query.isPending) {
    return <TabLoading />;
  }

  if (!query.data?.filingId) {
    return <NeverFiled />;
  }

  if (query.data.offices.length === 0) {
    return <NothingReported what="office locations" />;
  }

  return (
    <Table fontSize="1">
      <TableHeader>
        <TableRow>
          <TableHead>City</TableHead>
          <TableHead>Region</TableHead>
          <TableHead>Country</TableHead>
          <TableHead>Employees</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {query.data.offices.map((office, index) => (
          <TableRow key={office.officeReference ?? `office-${index}`}>
            <TableCell>{office.city ?? '—'}</TableCell>
            <TableCell>{office.region ?? '—'}</TableCell>
            <TableCell>{office.country ?? '—'}</TableCell>
            {/* null is "not reported", so it must not render as 0 */}
            <TableCell>{office.employeeCount ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
