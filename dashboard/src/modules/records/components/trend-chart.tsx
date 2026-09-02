import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { token } from '@riascout-ui/styled-system/tokens';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../../ui/primitives/charts';
import type { FirmMetricsPoint } from '../../../api/generated/rIAScoutAPI.schemas';

/**
 * One measure per chart, on its own axis. Accounts and employees can differ by
 * orders of magnitude, so a shared axis can hide the smaller series entirely
 * rather than inviting a comparison.
 */
export type TrendKey = 'accountCount' | 'employeeCount' | 'officeCount';

const compact = (value: number) =>
  new Intl.NumberFormat('en-US', {
    compactDisplay: 'short',
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value);

const day = (iso: string | number) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });

export const TrendChart = ({
  points,
  dataKey,
  label,
  color,
}: {
  points: FirmMetricsPoint[];
  dataKey: TrendKey;
  label: string;
  color: string;
}) => {
  const config: ChartConfig = { [dataKey]: { label, color } };

  const data = points.map((point) => ({
    submittedAt: point.submittedAt ? Date.parse(point.submittedAt) : null,
    [dataKey]: point[dataKey],
  }));

  return (
    <ChartContainer config={config} h="13rem" w="full">
      <LineChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid
          stroke={token('colors.brand.panel.4')}
          vertical={false}
        />
        <XAxis
          axisLine={false}
          dataKey="submittedAt"
          domain={['dataMin', 'dataMax']}
          scale="time"
          tickFormatter={day}
          tickLine={false}
          tickMargin={8}
          type="number"
        />
        {/*
          Scaled to the data, not anchored at zero: these are counts a firm
          restates, and forcing a zero baseline flattens the movement that the
          chart exists to show.
        */}
        <YAxis
          axisLine={false}
          domain={['auto', 'auto']}
          tickFormatter={compact}
          tickLine={false}
          tickMargin={8}
          width={56}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={day}
              valueFormatter={(value) => Number(value).toLocaleString()}
            />
          }
        />
        {/* connectNulls false: an unreported count is a gap, not a dip to zero */}
        <Line
          connectNulls={false}
          dataKey={dataKey}
          dot={false}
          stroke={color}
          strokeWidth={2}
          type="monotone"
        />
      </LineChart>
    </ChartContainer>
  );
};
