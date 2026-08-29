'use client'

import type * as React from 'react'

import { css } from '@riascout-ui/styled-system/css'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type SidebarMenuProps = React.ComponentProps<'ul'> & JsxStyleProps

const menuStyles = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '1',
	minW: '0',
	w: 'full'
})

export const SidebarMenu = (props: SidebarMenuProps) => {
	return <ul className={menuStyles} data-slot="sidebar-menu" {...props} />
}
