import type { ReactNode } from 'react';

import { Badge } from '../../../ui/primitives/badge';

type PillTone = 'success' | 'accent' | 'warn' | 'crit' | 'subtle';

const TONE_PALETTE: Record<PillTone, string> = {
  accent: 'brand.primary',
  crit: 'brand.error',
  subtle: 'colors.gray',
  success: 'brand.success',
  warn: 'brand.warning',
};

export const Pill = ({
  tone = 'subtle',
  children,
}: {
  tone?: PillTone;
  children: ReactNode;
}) => (
  <Badge colorPalette={TONE_PALETTE[tone]} look="soft" size="xs">
    {children}
  </Badge>
);
