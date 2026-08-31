'use client';

import type React from 'react';

import {
  AllEnterpriseModule,
  LicenseManager,
  ModuleRegistry,
  themeAlpine,
} from 'ag-grid-enterprise';
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react';

import { Box } from '../layout';

LicenseManager.setLicenseKey(import.meta.env?.VITE_AG_GRID_LICENSE_KEY ?? '');
ModuleRegistry.registerModules([AllEnterpriseModule]);

type DataGridProps = AgGridReactProps & {
  ref?: React.RefObject<AgGridReact> | null;
  /**
   * Hide the outer ag-grid border (the surrounding rectangle on .ag-root-wrapper).
   * Cell column borders, header borders, and pinned-row backgrounds remain.
   */
  borderless?: boolean;
};

export const DataGrid = ({ ref, borderless, ...props }: DataGridProps) => {
  return (
    <GridWrapper borderless={borderless}>
      <AgGridReact
        defaultColDef={{
          enableCellChangeFlash: false,
          resizable: false,
          sortable: false,
          suppressHeaderMenuButton: true,
        }}
        modules={[AllEnterpriseModule]}
        ref={ref}
        rowSelection={{
          checkboxes: false,
          enableClickSelection: false,
          headerCheckbox: false,
          mode: 'multiRow',
        }}
        suppressColumnVirtualisation={true}
        suppressContextMenu={true}
        suppressServerSideFullWidthLoadingRow={true}
        theme={themeAlpine}
        {...props}
        loading={false}
      />
    </GridWrapper>
  );
};

export type {
  ColDef,
  ColumnEventType,
  ColumnMovedEvent,
  ColumnResizedEvent,
  GridApi,
  GridOptions,
  GridReadyEvent,
  ICellRendererParams,
  IDatasource,
  IHeaderParams,
  IRowNode,
  SelectionChangedEvent,
  SuppressKeyboardEventParams,
} from 'ag-grid-enterprise';
export type { AgGridReact, CustomCellEditorProps } from 'ag-grid-react';
export { useGridCellEditor } from 'ag-grid-react';

export const GridWrapper = ({
  children,
  borderless,
}: {
  children: React.ReactNode;
  borderless?: boolean;
}) => {
  return (
    <Box
      css={{
        // extend theme
        '--ag-alpine-active-color': 'token(colors.brand.primary.9) !important',

        // table
        '--ag-background-color': 'token(colors.background.app) !important',
        '--ag-border-color': 'token(colors.colors.gray.4) !important',
        '--ag-border-radius': '0 !important',
        '--ag-card-shadow': 'none !important',
        '--ag-cell-column-border':
          '0.2px solid token(colors.colors.gray.3) !important',
        '--ag-cell-horizontal-padding': '0.8rem !important',
        // checkbox sizing & shape
        '--ag-checkbox-border-radius': '6px !important',
        '--ag-checkbox-border-width': '1.5px !important',

        // checkbox checked state
        '--ag-checkbox-checked-background-color':
          'token(colors.brand.primary.9) !important',
        '--ag-checkbox-checked-border-color': 'transparent !important',
        '--ag-checkbox-checked-shape-color': 'white !important',

        // checkbox indeterminate state
        '--ag-checkbox-indeterminate-background-color':
          'token(colors.brand.primary.9) !important',
        '--ag-checkbox-indeterminate-border-color': 'transparent !important',
        '--ag-checkbox-indeterminate-shape-color': 'white !important',

        // checkbox unchecked state
        '--ag-checkbox-unchecked-background-color': 'transparent !important',
        '--ag-checkbox-unchecked-border-color':
          'token(colors.colors.gray.4) !important',
        '--ag-column-border-style': 'solid !important',
        '--ag-column-border-width': '1px !important',

        // popups
        '--ag-control-panel-background-color': 'transparent !important',
        '--ag-font-family': 'var(--font-geist-sans) !important',
        // alpine's 14px reads oversized against a 40px row
        '--ag-font-size': '0.8125rem !important',

        // text — drives .ag-row-group and any element without an explicit color override
        '--ag-foreground-color': 'token(colors.text.app) !important',

        // header
        '--ag-header-background-color':
          'token(colors.background.app) !important',
        '--ag-input-border-color': 'token(colors.colors.gray.4) !important',
        '--ag-input-focus-border-color':
          'token(colors.brand.primary.9) !important',

        // borders and box shadows
        '--ag-input-focus-shadow': 'none !important',

        // rows
        '--ag-odd-row-background-color':
          'token(colors.background.app) !important',
        '--ag-range-selection-background-color':
          'token(colors.colors.gray.3) !important',

        // selection
        '--ag-range-selection-border-color':
          'token(colors.brand.primary.7) !important',
        '--ag-range-selection-border-style': 'dashed !important',
        '--ag-row-hover-color': 'token(colors.colors.gray.3) !important',
        '--ag-secondary-border-color': 'token(colors.colors.gray.4) !important',
        '--ag-selected-row-background-color':
          'token(colors.colors.gray.2) !important',

        '& .ag-cell': {
          '&.ag-cell-range-bottom': {
            borderBottom: 'focused !important',
            borderBottomStyle: 'dashed !important',
          },

          '&.ag-cell-range-left': {
            borderLeft: 'focused !important',
            borderLeftStyle: 'dashed !important',
          },

          '&.ag-cell-range-right': {
            borderRight: 'focused !important',
            borderRightStyle: 'dashed !important',
          },

          '&.ag-cell-range-selected': {
            backgroundColor: 'token(colors.colors.gray.3) !important',
          },

          '&.ag-cell-range-top': {
            borderTop: 'focused !important',
            borderTopStyle: 'dashed !important',
          },
          // borderY: '0.2px solid token(colors.colors.gray.3) !important',
          borderX: '0.2px solid token(colors.colors.gray.3) !important',
          color: 'text.app !important',
          // fontFamily: 'var(--font-dm-mono) !important',
          fontSize: '1 !important',
          fontWeight: '400 !important',
          // lineHeight: 'initial !important'
        },

        '& .ag-cell-inline-editing': {
          border: 'none !important',
          borderRadius: '0 !important',
        },

        '& .ag-checkbox-input-wrapper': {
          '&:focus-within': {
            boxShadow: 'none !important',
          },
          '&.ag-checked': {
            borderRadius: '6px !important',
            overflow: 'hidden !important',
          },
          borderRadius: '6px !important',
        },

        '& .ag-floating-bottom': {
          '& .ag-row-pinned': {
            _hover: {
              backgroundColor: 'token(colors.colors.gray.2) !important',
            },
            backgroundColor: 'token(colors.colors.gray.2) !important',
            fontWeight: '600 !important',
          },
        },

        /**
         * Borderless keeps only the divider between header cells and the line
         * under the row — bordering all four sides draws a frame across the top
         * and down both outer edges, which is the box borderless is meant to drop.
         */
        '& .ag-header-cell': {
          border: '0.5px solid token(colors.colors.gray.4) !important',
          borderBottom: 'none !important',
          color: 'text.app !important',
          ...(borderless && {
            borderLeft: 'none !important',
            borderTop: 'none !important',
          }),
        },

        /**
         * One line under the header, not two: ag-grid already borders .ag-header
         * with --ag-border-color, so adding one to the row stacked them into 2px
         * in a grey that did not match the page header above it.
         */
        '& .ag-header': {
          ...(borderless && {
            // literal, not a constant — panda extracts these statically
            borderBottom: '1px solid token(colors.brand.primary.5) !important',
          }),
        },

        '& .ag-header-row': {
          ...(borderless && { borderBottom: 'none !important' }),
        },

        '& .ag-overlay-no-rows-center': {
          color: 'text.app !important',
        },

        '& .ag-popup-editor': {
          border: 'none !important',
          borderRadius: '0 !important',
        },

        '& .ag-root-wrapper': {
          borderRadius: '0 !important',
          ...(borderless && { border: 'none !important' }),
        },
      }}
      h="full"
      w="full"
    >
      {children}
    </Box>
  );
};
