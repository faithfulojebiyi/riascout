'use client'

import type * as React from 'react'

import { css } from '@riascout-ui/styled-system/css'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type SidebarHeaderProps = React.ComponentProps<'div'> & JsxStyleProps

const headerStyles = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '2',
	p: '2'
})

export const SidebarHeader = (props: SidebarHeaderProps) => {
	return <div className={headerStyles} data-slot="sidebar-header" {...props} />
}
