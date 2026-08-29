'use client'

import type * as React from 'react'

import { Switch as SwitchPrimitives } from 'radix-ui'

import { cva, type RecipeVariantProps } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const rootStyles = cva({
	base: {
		_disabled: {
			cursor: 'not-allowed',
			opacity: '0.5'
		},

		_focusVisible: {
			border: 'focused'
		},

		'&[data-state=checked]': {
			bg: 'brand.primary.9'
		},

		'&[data-state=unchecked]': {
			bg: 'background.muted'
		},
		alignItems: 'center',
		border: 'subtle',
		cursor: 'pointer',
		display: 'inline-flex',
		flexShrink: '0',
		rounded: '99999px',
		transitionDuration: '300ms',
		transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke',
		transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
	},
	defaultVariants: {
		size: 'sm'
	},
	variants: {
		size: {
			md: {
				h: '1.5rem',
				w: '2.75rem'
			},
			sm: {
				h: '1.25rem',
				w: '2.25rem'
			},
			xs: {
				h: '1rem',
				w: '1.75rem'
			}
		}
	}
})

const thumbStyles = cva({
	base: {
		bg: 'white',
		display: 'block',
		pointerEvents: 'none',
		rounded: '50%',
		transitionDuration: '300ms',
		transitionProperty: 'transform',
		transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
	},
	defaultVariants: {
		size: 'sm'
	},
	variants: {
		size: {
			md: {
				'&[data-state=checked]': {
					transform: 'translateX(1.313rem)'
				},

				'&[data-state=unchecked]': {
					transform: 'translateX(0.125)'
				},
				h: '1.25rem',
				w: '1.25rem'
			},
			sm: {
				'&[data-state=checked]': {
					transform: 'translateX(1.063rem)'
				},

				'&[data-state=unchecked]': {
					transform: 'translateX(0.125)'
				},
				h: '1rem',
				w: '1rem'
			},
			xs: {
				'&[data-state=checked]': {
					transform: 'translateX(0.813rem)'
				},

				'&[data-state=unchecked]': {
					transform: 'translateX(0.125)'
				},
				h: '0.75rem',
				w: '0.75rem'
			}
		}
	}
})

const SwitchRoot = styled(SwitchPrimitives.Root, rootStyles)

const SwitchThumb = styled(SwitchPrimitives.Thumb, thumbStyles)

type SwitchVariants = RecipeVariantProps<typeof rootStyles>

export const Switch = ({
	size,
	...props
}: React.ComponentProps<typeof SwitchPrimitives.Root> & JsxStyleProps & SwitchVariants) => {
	return (
		<SwitchRoot size={size} {...props}>
			<SwitchThumb size={size} />
		</SwitchRoot>
	)
}
