'use client'

import type * as React from 'react'

import { css } from '@riascout-ui/styled-system/css'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type SidebarMenuItemProps = React.ComponentProps<'li'> & JsxStyleProps

const menuItemStyles = css({
	'&:hover > [data-show-on-hover]': {
		opacity: '1',
		pointerEvents: 'auto'
	},
	display: 'flex',
	flexDirection: 'column',
	gap: '1',
	position: 'relative'
})

export const SidebarMenuItem = (props: SidebarMenuItemProps) => {
	return <li className={menuItemStyles} data-slot="sidebar-menu-item" {...props} />
}
