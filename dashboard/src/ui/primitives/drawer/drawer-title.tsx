'use client'

import type * as React from 'react'

import { Drawer as DrawerPrimitive } from 'vaul'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type Props = React.ComponentProps<typeof DrawerPrimitive.Title> & JsxStyleProps

const titleStyles = cva({
	base: {
		alignItems: 'center',
		display: 'flex',
		gap: '1.5',
		textStyle: 'modalTitle'
	}
})

const StyledDrawerTitle = styled(DrawerPrimitive.Title, titleStyles)

export const DrawerTitle = (props: Props) => {
	return <StyledDrawerTitle data-slot="drawer-title" {...props} />
}
