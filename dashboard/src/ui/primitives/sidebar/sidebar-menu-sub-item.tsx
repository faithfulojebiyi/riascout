'use client'

import type * as React from 'react'

import { css } from '@riascout-ui/styled-system/css'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type SidebarMenuSubItemProps = React.ComponentProps<'li'> & JsxStyleProps

const subItemStyles = css({
	position: 'relative'
})

export const SidebarMenuSubItem = (props: SidebarMenuSubItemProps) => {
	return <li className={subItemStyles} data-slot="sidebar-menu-sub-item" {...props} />
}
