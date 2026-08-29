'use client'

import type * as React from 'react'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const inputGroupTextStyles = cva({
	base: {
		'& svg': {
			pointerEvents: 'none'
		},

		'& svg:not([class*="size-"])': {
			h: '4',
			w: '4'
		},

		alignItems: 'center',
		color: 'text.muted',
		display: 'flex',
		fontSize: '1',
		gap: '2'
	}
})

const StyledInputGroupText = styled('span', inputGroupTextStyles)

export type InputGroupTextProps = React.ComponentProps<'span'> & JsxStyleProps

export const InputGroupText = ({ ...props }: InputGroupTextProps) => {
	return <StyledInputGroupText {...props} />
}
