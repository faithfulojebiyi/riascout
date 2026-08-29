'use client'

import type * as React from 'react'

import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type Props = React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
	inset?: boolean
} & JsxStyleProps

const styles = cva({
	base: { px: '1.5', py: '1', textStyle: 'label', userSelect: 'none' }
})

const StyledLabel = styled(DropdownMenuPrimitive.Label, styles)

export const DropdownMenuLabel = ({ className, ...props }: Props) => {
	return <StyledLabel className={className} data-slot="dropdown-menu-label" textStyle="label" {...props} />
}
