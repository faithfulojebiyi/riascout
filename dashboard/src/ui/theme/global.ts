import { defineGlobalStyles } from '@pandacss/dev';

export const globalCss = defineGlobalStyles({
  /* to control scrollbars on different browsers */
  '::-webkit-scrollbar': {
    h: '0.375rem',
    w: '0.25rem',
  },

  '::-webkit-scrollbar-thumb': {
    '&:hover': {
      bg: 'background.mutedNoAlpha',
    },
    bg: 'background.mutedNoAlpha',
    // rounded: 'xl'
  },

  '::-webkit-scrollbar-track': {
    '&:hover': {
      bg: 'background.muted',
    },
    rounded: '0.2rem',
  },

  // ag-grid
  '.ag-dnd-ghost': {
    alignItems: 'center !important',
    backdropFilter: 'blur(4rem)',
    bg: 'background.muted !important',
    color: 'text.app !important',
    display: 'flex !important',
    h: '3rem !important',
    p: '0 !important',
    px: '1rem !important',
    rounded: '1rem !important',
  },
  // ag-grid renders the drag preview in document.body — outside the grid theme
  // root — so the inner label/icon need explicit color overrides too. Without
  // these, ag-grid's Alpine default for `.ag-dnd-ghost-label` wins and the text
  // is invisible against our dark `background.muted` in dark mode.
  '.ag-dnd-ghost-icon, .ag-dnd-ghost-label': {
    color: 'text.app !important',
  },

  '.empty-state-illustration': {
    color: 'text.illustration',
  },

  '.hidden-scrollbar': {
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },

  '*': {
    '&:focus-visible': {
      // border: 'subtle'
    },
    outline: 'none',
  },

  body: {
    // same paint as html — a transiently unpainted compositor layer (e.g. a fixed
    // panel mid-transition during a route switch) must never show through as black
    backgroundColor: 'background.app',
    fontFamily: 'geist',
    fontSize: '2',
    fontWeight: '400',
    height: '100vh',
    overflow: 'hidden',
  },

  html: {
    backgroundColor: 'background.app',
    color: 'text.app',
    fontFamily: 'geist',
    fontSize: '16px',
  },

  // file upload button override
  'input[type=file]::-webkit-file-upload-button': {
    cursor: 'pointer',
  },

  kbd: {
    font: 'unset',
  },
});
