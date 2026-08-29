'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

import { Icons } from '../../icons/base'

const triggerStyles = cva({
	base: {
		'& svg:not([class*="size-"])': {
			h: '4',
			w: '4'
		}
	}
})

const StyledTrigger = styled(ComboboxPrimitive.Trigger, triggerStyles)

export type ComboboxTriggerProps = ComboboxPrimitive.Trigger.Props & JsxStyleProps

export const ComboboxTrigger = ({ children, ...props }: ComboboxTriggerProps) => {
	return (
		<StyledTrigger data-slot="combobox-trigger" {...props}>
			{children}
			<Icons.caretDown color="text.muted" pointerEvents="none" />
		</StyledTrigger>
	)
}
