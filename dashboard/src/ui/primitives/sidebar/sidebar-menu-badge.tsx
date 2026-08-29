'use client'

import type * as React from 'react'

import { css, cx } from '@riascout-ui/styled-system/css'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type SidebarMenuBadgeProps = React.ComponentProps<'div'> & JsxStyleProps

const menuBadgeStyles = css({
	alignItems: 'center',
	color: 'text.muted',
	display: 'inline-flex',
	fontSize: '0.75rem',
	fontVariantNumeric: 'tabular-nums',
	fontWeight: '500',
	h: '5',
	justifyContent: 'center',
	minW: '5',
	pointerEvents: 'none',
	position: 'absolute',
	px: '1',
	right: '1',
	rounded: 'md',
	textOverflow: 'ellipsis',
	userSelect: 'none',
	whiteSpace: 'nowrap'
})

const collapsedBadgeStyles = css({
	'[data-collapsible=icon] &': {
		fontSize: '0.625rem',
		h: '4',
		minW: '4',
		position: 'absolute',
		right: '-1',
		rounded: 'full',
		top: '-1'
	}
})

export const SidebarMenuBadge = (props: SidebarMenuBadgeProps) => {
	return <div className={cx(menuBadgeStyles, collapsedBadgeStyles)} data-slot="sidebar-menu-badge" {...props} />
}
