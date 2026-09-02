import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { token } from '@riascout-ui/styled-system/tokens';

import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../../ui/primitives/charts';
import type { FirmMetricsPoint } from '../../../api/generated/rIAScoutAPI.schemas';

/**
 * token() resolves the panda variable, which is prefixed (--riascout-colors-…).
 * Hand-written var names silently resolve to nothing, which paints the series
 * grey and makes two of them indistinguishable.
 */
const config: ChartConfig = {
  discretionaryAum: {
    label: 'Discretionary',
    color: token('colors.brand.info.9'),
  },
  nonDiscretionaryAum: {
    label: 'Non-discretionary',
    color: token('colors.brand.success.9'),
  },
} satisfies ChartConfig;

/**
 * Money arrives as a decimal string because numeric(20,2) overflows a double.
 * Number() is for plotting only, where the magnitude is what matters — and null
 * must stay null so recharts breaks the line rather than dropping it to zero.
 */
const toPlot = (value: string | null): number | null =>
  value === null ? null : Number(value);

const compact = (value: number) =>
  new Intl.NumberFormat('en-US', {
    compactDisplay: 'short',
    currency: 'USD',
    maximumFractionDigits: 1,
    notation: 'compact',
    style: 'currency',
  }).format(value);

const day = (iso: string | number) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });

export const AumChart = ({ points }: { points: FirmMetricsPoint[] }) => {
  const data = points.map((point) => ({
    submittedAt: point.submittedAt ? Date.parse(point.submittedAt) : null,
    discretionaryAum: toPlot(point.discretionaryAum),
    nonDiscretionaryAum: toPlot(point.nonDiscretionaryAum),
  }));

  return (
    <>
      <ChartLegend config={config} />
      <ChartContainer config={config} h="18rem" w="full">
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid
            stroke={token('colors.brand.panel.4')}
            vertical={false}
          />
          {/*
          A real time axis, not a categorical one: filings are irregular, and
          evenly spacing them would make a six-year gap look like a six-month
          one.
        */}
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
          <YAxis
            axisLine={false}
            tickFormatter={compact}
            tickLine={false}
            tickMargin={8}
            width={56}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={day}
                valueFormatter={(value) => compact(Number(value))}
              />
            }
          />
          {/*
          Stacked, because the two sum to regulatory AUM — showing them as
          separate lines invites reading the total off the wrong one.

          connectNulls stays false: an unreported measure leaves a gap, and
          bridging it would draw a trend the filings never reported.
        */}
          <Area
            connectNulls={false}
            dataKey="discretionaryAum"
            fill="var(--color-discretionaryAum)"
            fillOpacity={0.2}
            stackId="aum"
            stroke="var(--color-discretionaryAum)"
            strokeWidth={2}
            type="monotone"
          />
          <Area
            connectNulls={false}
            dataKey="nonDiscretionaryAum"
            fill="var(--color-nonDiscretionaryAum)"
            fillOpacity={0.2}
            stackId="aum"
            stroke="var(--color-nonDiscretionaryAum)"
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ChartContainer>
    </>
  );
};
