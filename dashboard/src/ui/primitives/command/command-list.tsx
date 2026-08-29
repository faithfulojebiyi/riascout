'use client'

import type * as React from 'react'

import { Command as CommandPrimitive } from 'cmdk'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type Props = React.ComponentProps<typeof CommandPrimitive.List> & JsxStyleProps

const commandListStyles = cva({
	base: {
		'&::-webkit-scrollbar': {
			display: 'none'
		},
		h: 'var(--cmdk-list-height)',
		maxH: '25rem',
		overflowX: 'hidden',
		overflowY: 'scroll',
		p: '1',
		scrollPaddingBlockEnd: '8px',
		scrollPaddingBlockStart: '8px'
	}
})

const StyledList = styled(CommandPrimitive.List, commandListStyles)

export const CommandList = ({ children, ...props }: Props) => {
	return (
		<StyledList data-slot="command-list" {...props}>
			{children}
		</StyledList>
	)
}
