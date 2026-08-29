'use client'

import type * as React from 'react'

import { Tabs as TabsPrimitive } from 'radix-ui'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const tabListStyles = cva({
	base: {
		alignItems: 'center',
		bg: 'background.muted',
		color: 'text.muted',
		display: 'inline-flex',
		h: '8',
		justifyContent: 'center',
		p: '1',
		rounded: 'md'
	}
})

const StyledTabList = styled(TabsPrimitive.List, tabListStyles)

export const TabsList = (props: React.ComponentProps<typeof TabsPrimitive.List> & JsxStyleProps) => {
	return <StyledTabList {...props} />
}
