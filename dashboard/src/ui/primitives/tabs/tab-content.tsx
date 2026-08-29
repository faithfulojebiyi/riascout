'use client'

import type * as React from 'react'

import { Tabs as TabsPrimitive } from 'radix-ui'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const tabContentStyles = cva({
	base: {
		_focusVisible: {
			outline: 'none'
		}
	}
})

const StyledTabContent = styled(TabsPrimitive.Content, tabContentStyles)

export const TabContent = (props: React.ComponentProps<typeof TabsPrimitive.Content> & JsxStyleProps) => {
	return <StyledTabContent {...props} />
}
