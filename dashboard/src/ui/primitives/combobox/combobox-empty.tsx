'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const emptyStyles = cva({
	base: {
		'.group\\/combobox-content[data-empty] &': {
			display: 'flex'
		},
		color: 'text.muted',
		display: 'none',
		fontSize: '2',
		justifyContent: 'center',
		py: '2',
		textAlign: 'center',
		w: 'full'
	}
})

const StyledEmpty = styled(ComboboxPrimitive.Empty, emptyStyles)

export type ComboboxEmptyProps = ComboboxPrimitive.Empty.Props & JsxStyleProps

export const ComboboxEmpty = ({ ...props }: ComboboxEmptyProps) => {
	return <StyledEmpty data-slot="combobox-empty" {...props} />
}
