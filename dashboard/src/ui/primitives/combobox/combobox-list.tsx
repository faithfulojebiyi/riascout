'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const listStyles = cva({
	base: {
		'&[data-empty]': {
			p: '0'
		},
		maxH: 'calc(min(18rem - 2.25rem, var(--available-height) - 2.25rem))',
		overflowY: 'auto',
		overscrollBehavior: 'contain',
		p: '1',
		scrollbar: 'hidden',
		scrollPaddingY: '1'
	}
})

const StyledList = styled(ComboboxPrimitive.List, listStyles)

export type ComboboxListProps = ComboboxPrimitive.List.Props & JsxStyleProps

export const ComboboxList = ({ ...props }: ComboboxListProps) => {
	return <StyledList data-slot="combobox-list" {...props} />
}
