'use client'

import type * as React from 'react'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const tableFooterStyles = cva({
	base: {
		'& > tr:last-child': {
			borderBottom: 'none'
		},
		bg: 'background.muted',
		borderTop: 'subtle',
		fontWeight: 'medium'
	}
})

const StyledTableFooter = styled('tfoot', tableFooterStyles)

export const TableFooter = ({ ...props }: React.ComponentProps<'tfoot'> & JsxStyleProps) => {
	return <StyledTableFooter data-slot="table-footer" {...props} />
}
