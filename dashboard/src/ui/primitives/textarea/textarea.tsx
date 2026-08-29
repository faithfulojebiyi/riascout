'use client'

import type * as React from 'react'

import { cva, type RecipeVariantProps } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const textareaStyles = cva({
	base: {
		_dark: {
			_disabled: {
				bg: 'colors.gray.3/80'
			},
			_invalid: {
				borderColor: 'brand.error.9/50',
				ringColor: 'brand.error.4'
			},
			bg: 'colors.gray.3/30'
		},

		_disabled: {
			bg: 'colors.gray.3/50',
			cursor: 'not-allowed',
			opacity: '0.5'
		},

		_focusVisible: {
			borderColor: 'brand.primary.8',
			outline: 'none',
			ring: '3px',
			ringColor: 'brand.primary.3/50'
		},
		_invalid: {
			borderColor: 'brand.error.9',
			ring: '3px',
			ringColor: 'brand.error.3'
		},

		_placeholder: {
			color: 'text.placeholder'
		},

		bg: 'transparent',
		border: 'subtle',
		color: 'text.app',
		display: 'flex',
		fieldSizing: 'content',
		fontSize: '2',
		minH: '4rem',
		outline: 'none',
		px: '2.5',
		py: '2',
		rounded: 'lg',
		transition: 'colors',
		w: 'full'
	},
	defaultVariants: {
		size: 'md'
	},
	variants: {
		size: {
			lg: {
				fontSize: '3',
				px: '3.5',
				py: '3',
				rounded: 'xl'
			},
			md: {
				fontSize: '2',
				px: '2.5',
				py: '2',
				rounded: 'lg'
			},
			sm: {
				fontSize: '2',
				px: '2',
				py: '1.5',
				rounded: 'lg'
			}
		}
	}
})

const StyledTextarea = styled('textarea', textareaStyles)

export type TextareaVariants = RecipeVariantProps<typeof textareaStyles>

export type TextareaProps = React.ComponentProps<'textarea'> & JsxStyleProps & TextareaVariants

export const Textarea = ({ size = 'md', ...props }: TextareaProps) => {
	return <StyledTextarea data-slot="textarea" size={size} {...props} />
}
