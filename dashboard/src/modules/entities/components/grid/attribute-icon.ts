import { Icons } from '../../../../ui/icons/base';

type IconKey = keyof typeof Icons;

/**
 * Attributes carry their own icon name from the ETL, so a LinkedIn url reads as
 * LinkedIn rather than as "url". The type is only the fallback.
 */
const BY_ICON_NAME: Record<string, IconKey> = {
  'arrow-right': 'arrowRight',
  'trending-down': 'trendDown',
  'trending-up': 'trendUp',
  badge: 'medal',
  bank: 'bank',
  building: 'building',
  certificate: 'medal',
  check: 'check',
  clock: 'clock',
  currency: 'dollar',
  date: 'calendar',
  email: 'at',
  facebook: 'global',
  globe: 'global',
  hash: 'hash',
  industry: 'briefcase',
  instagram: 'instagram',
  key: 'key',
  link: 'link',
  linkedin: 'linkedin',
  location: 'location',
  map: 'map',
  note: 'note',
  percent: 'percent',
  phone: 'phone',
  radar: 'target',
  share: 'arrowUpRight',
  shield: 'shieldCheck',
  star: 'star',
  text: 'textAa',
  user: 'user',
  users: 'profiles',
  x: 'x',
};

const BY_TYPE: Record<string, IconKey> = {
  boolean: 'boolean',
  currency: 'dollar',
  date: 'calendar',
  email: 'at',
  number: 'number',
  percentage: 'percent',
  phone: 'phone',
  rating: 'star',
  text: 'textAa',
  url: 'link',
};

export const attributeIcon = (
  icon: string | null,
  type: string,
): (typeof Icons)[IconKey] =>
  Icons[(icon ? BY_ICON_NAME[icon] : undefined) ?? BY_TYPE[type] ?? 'textAa'];
