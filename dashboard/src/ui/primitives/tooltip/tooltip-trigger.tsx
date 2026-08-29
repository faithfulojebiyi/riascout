'use client'

import { Tooltip as TooltipPrimitive } from 'radix-ui'

import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const StyledTrigger = styled(TooltipPrimitive.Trigger)

export const TooltipTrigger = ({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger> & JsxStyleProps) => {
	return <StyledTrigger data-slot="tooltip-trigger" {...props} />
}
