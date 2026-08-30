import { SavePreferencesUseCasesItem } from '../../api/generated/rIAScoutAPI.schemas';

/** the api owns the values; this owns how they read on screen */
export const USE_CASE_OPTIONS: {
  value: SavePreferencesUseCasesItem;
  label: string;
}[] = [
  { value: SavePreferencesUseCasesItem.recruiting, label: 'Recruiting' },
  {
    value: SavePreferencesUseCasesItem.succession,
    label: 'M&A and succession',
  },
  {
    value: SavePreferencesUseCasesItem.asset_management_sales,
    label: 'Asset management sales',
  },
  {
    value: SavePreferencesUseCasesItem.platform_sales,
    label: 'Custody and platform sales',
  },
  { value: SavePreferencesUseCasesItem.consulting, label: 'Consulting' },
  { value: SavePreferencesUseCasesItem.investing, label: 'Investing' },
  { value: SavePreferencesUseCasesItem.marketing, label: 'Marketing' },
  { value: SavePreferencesUseCasesItem.other, label: 'Other' },
];
