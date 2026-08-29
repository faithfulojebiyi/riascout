'use client'

import type * as React from 'react'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const tableBodyStyles = cva({
	base: {
		'& tr:last-child': {
			borderBottom: 'none'
		}
	}
})

const StyledTableBody = styled('tbody', tableBodyStyles)

export const TableBody = ({ ...props }: React.ComponentProps<'tbody'> & JsxStyleProps) => {
	return <StyledTableBody data-slot="table-body" {...props} />
}
