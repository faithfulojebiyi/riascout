'use client'

import type React from 'react'

import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type Props = React.ComponentProps<typeof ContextMenuPrimitive.Label> & {
	inset?: boolean
} & JsxStyleProps

const styles = cva({
	base: { my: '4px' }
})

const StyledLabel = styled(ContextMenuPrimitive.Label, styles)

export const ContextMenuLabel = ({ ...props }: Props) => {
	return <StyledLabel data-slot="context-menu-label" {...props} />
}
