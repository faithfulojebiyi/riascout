'use client'

import type * as React from 'react'

import { css } from '@riascout-ui/styled-system/css'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type SidebarFooterProps = React.ComponentProps<'div'> & JsxStyleProps

const footerStyles = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '2',
	p: '2'
})

export const SidebarFooter = (props: SidebarFooterProps) => {
	return <div className={footerStyles} data-slot="sidebar-footer" {...props} />
}
