'use client'

import type * as React from 'react'

import { css } from '@riascout-ui/styled-system/css'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type SidebarGroupContentProps = React.ComponentProps<'div'> & JsxStyleProps

const groupContentStyles = css({
	fontSize: 'sm',
	w: 'full'
})

export const SidebarGroupContent = (props: SidebarGroupContentProps) => {
	return <div className={groupContentStyles} data-slot="sidebar-group-content" {...props} />
}
