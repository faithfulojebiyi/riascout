/**
 * Header and rows share this. Alpine's defaults differ (48 vs 42), which reads
 * as a header sitting on top of the data rather than part of the same grid.
 *
 * The prospecting results table reads it too, so the two surfaces cannot drift.
 */
export const GRID_ROW_HEIGHT = 34;

/** panda token `1` = 0.75rem = 12px; cells, headers and skeletons all use it */
export const GRID_FONT_SIZE = '1';

/** a flat starting width — per-type widths made the header read as ragged */
export const GRID_DEFAULT_COL_WIDTH = 200;
