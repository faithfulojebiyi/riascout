'use client'

import type * as React from 'react'

import { Dialog as DialogPrimitive } from 'radix-ui'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type Props = React.ComponentProps<typeof DialogPrimitive.Title> & JsxStyleProps

const titleStyles = cva({
	base: {
		alignItems: 'center',
		display: 'flex',
		gap: '1.5',
		textStyle: 'modalTitle'
	}
})

const StyledDialogTitle = styled(DialogPrimitive.Title, titleStyles)

export const DialogTitle = (props: Props) => {
	return <StyledDialogTitle data-slot="dialog-title" {...props} />
}
