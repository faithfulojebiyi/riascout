import type { LinkProps } from '@tanstack/react-router';

import type { Icons } from '../../../ui/icons/base';

type IconKey = keyof typeof Icons;

export type NavItem = {
  title: string;
  /** typed against the route tree, so a renamed route breaks the build */
  href?: LinkProps['to'];
  icon: IconKey;
  /** pill shown after the label ("Beta", "Soon") */
  pill?: string;
  /** rendered non-interactive — the surface is not built yet */
  disabled?: boolean;
};

export const GLOBAL_NAV: NavItem[] = [
  { href: '/', icon: 'home', title: 'Home' },
  { href: '/prospecting', icon: 'userSearch', title: 'Prospecting' },
  { disabled: true, icon: 'trendUp', pill: 'Soon', title: 'Movement' },
  { disabled: true, icon: 'searchNormal', title: 'Search' },
];

/** an entity's saved views, expanded under it the way projects expand in gavely */
export const entityIcon = (sourceKind: string | null): IconKey =>
  sourceKind === 'firm' ? 'building' : 'user';
