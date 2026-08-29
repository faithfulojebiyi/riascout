'use client'

import type * as React from 'react'

import { css, cx } from '@riascout-ui/styled-system/css'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type SidebarGroupProps = React.ComponentProps<'div'> & JsxStyleProps

const groupStyles = css({
	display: 'flex',
	flexDirection: 'column',
	minW: '0',
	p: '2',
	position: 'relative',
	w: 'full'
})

export const SidebarGroup = ({ className, ...props }: SidebarGroupProps) => {
	return <div className={cx(groupStyles, className)} data-slot="sidebar-group" {...props} />
}
