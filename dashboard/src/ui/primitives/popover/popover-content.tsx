'use client'

import type * as React from 'react'

import { Popover as PopoverPrimitive } from 'radix-ui'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

import { AnimateChangeInHeight } from '../animated-height'

export const popoverContentStyles = cva({
	base: {
		_light: {
			bg: 'white',
			glass: 'none'
		},
		'&[data-state=closed]': {
			animation: 'popoverHide'
		},
		'&[data-state=open]': {
			animation: 'popoverUpIn'
		},
		bg: 'background.popover',
		border: 'subtle',
		glass: 'popup',
		rounded: 'xl',
		shadow: 'sSm',
		zIndex: '100'
	}
})

const StyledPopoverContent = styled(PopoverPrimitive.Content, popoverContentStyles)

export type PopoverContentProps = React.ComponentProps<typeof PopoverPrimitive.Content> &
	JsxStyleProps & {
		noGrain?: boolean
	}

export const PopoverContent: React.FC<PopoverContentProps> = ({
	align = 'center',
	sideOffset = 4,
	children,
	style,
	noGrain = false,
	...props
}) => {
	return (
		<PopoverPrimitive.Portal>
			<StyledPopoverContent
				align={align}
				data-slot="popover-content"
				sideOffset={sideOffset}
				style={{
					...style
				}}
				{...props}
			>
				<AnimateChangeInHeight duration={0.05}>{children}</AnimateChangeInHeight>
			</StyledPopoverContent>
		</PopoverPrimitive.Portal>
	)
}
