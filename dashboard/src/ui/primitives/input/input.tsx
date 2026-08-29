'use client'

import type * as React from 'react'

import { Input as InputPrimitive } from '@base-ui/react/input'

import { cva, type RecipeVariantProps } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

export const inputStyles = cva({
	base: {
		_dark: {
			_disabled: {
				bg: 'colors.gray.3/80'
			},
			bg: 'colors.gray.3/30'
		},

		_disabled: {
			bg: 'colors.gray.3/50',
			cursor: 'not-allowed',
			opacity: '0.5',
			pointerEvents: 'none'
		},

		_file: {
			bg: 'transparent',
			border: 'none',
			color: 'text.app',
			display: 'inline-flex',
			fontSize: '1',
			fontWeight: '500',
			h: '1.5rem'
		},

		_focusVisible: {
			borderColor: 'brand.primary.8',
			outline: 'none',
			ring: '3px',
			ringColor: 'brand.primary.3/50'
		},

		_placeholder: {
			color: 'text.placeholder'
		},
		// explicit error state only (aria-invalid/data-invalid) — never native :invalid,
		// so empty required/email fields aren't red before the user interacts
		'&[aria-invalid=true], &[data-invalid]': {
			_dark: {
				borderColor: 'brand.error.9/50',
				ringColor: 'brand.error.4'
			},
			borderColor: 'brand.error.9',
			ring: '3px',
			ringColor: 'brand.error.3'
		},

		bg: 'transparent',
		border: 'subtle',
		color: 'text.app',
		fontSize: '1',
		minW: '0',
		outline: 'none',
		px: '2.5',
		py: '1',
		rounded: 'lg',
		transition: 'colors',
		w: 'full'
	},
	defaultVariants: {
		size: 'xs'
	},
	variants: {
		size: {
			lg: {
				fontSize: '3',
				h: '2.5rem',
				px: '3.5',
				rounded: 'xl'
			},
			md: {
				fontSize: '2',
				h: '2.25rem',
				px: '4',
				rounded: 'lg'
			},
			sm: {
				fontSize: '1',
				h: '2rem',
				px: '3',
				rounded: 'lg'
			},
			xs: {
				fontSize: '1',
				h: '1.75rem',
				px: '1.5',
				rounded: 'lg'
			}
		}
	}
})

const StyledInput = styled(InputPrimitive, inputStyles)

export type InputVariants = RecipeVariantProps<typeof inputStyles>

export type InputProps = Omit<React.ComponentProps<'input'>, 'size'> & JsxStyleProps & InputVariants

export const Input = ({ size = 'xs', ...props }: InputProps) => {
	return <StyledInput data-slot="input" size={size} {...props} />
}
