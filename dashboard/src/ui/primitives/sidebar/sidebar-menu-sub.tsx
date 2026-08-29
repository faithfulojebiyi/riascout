'use client'

import type * as React from 'react'

import { css, cx } from '@riascout-ui/styled-system/css'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type SidebarMenuSubProps = React.ComponentProps<'ul'> & JsxStyleProps

const menuSubStyles = css({
	borderLeft: '1px solid',
	borderLeftColor: 'brand.panel.6',
	display: 'flex',
	flexDirection: 'column',
	gap: '1',
	minW: '0',
	ml: '3.5',
	mr: '0',
	pl: '2.5',
	pr: '0',
	py: '0.5'
})

const collapsedSubStyles = css({
	'[data-collapsible=icon] &': {
		display: 'none'
	}
})

export const SidebarMenuSub = (props: SidebarMenuSubProps) => {
	return <ul className={cx(menuSubStyles, collapsedSubStyles)} data-slot="sidebar-menu-sub" {...props} />
}
