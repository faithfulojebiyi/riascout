'use client'

import type * as React from 'react'

import { Label as LabelPrimitive } from 'radix-ui'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const labelStyles = cva({
	base: {
		_peerDisabled: {
			cursor: 'not-allowed',
			opacity: '0.5'
		},
		'.group[data-disabled=true] &': {
			opacity: '0.5',
			pointerEvents: 'none'
		},
		alignItems: 'center',
		display: 'flex',
		fontSize: '2',
		fontWeight: '500',
		gap: '2',
		lineHeight: '1',
		userSelect: 'none'
	}
})

const StyledLabel = styled(LabelPrimitive.Root, labelStyles)

export const Label = ({ ...props }: React.ComponentProps<typeof LabelPrimitive.Root> & JsxStyleProps) => {
	return <StyledLabel data-slot="label" {...props} />
}
