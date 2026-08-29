'use client'

import type * as React from 'react'

import { Command as CommandPrimitive } from 'cmdk'

import { cva, type RecipeVariantProps } from '@riascout-ui/styled-system/css'
import { Box, Flex, styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

import { Icons } from '../../icons/base'

const commandInputStyles = cva({
	base: {
		_disabled: {
			cursor: 'not-allowed',
			opacity: '0.7',
			pointerEvents: 'none'
		},

		_placeholder: {
			color: 'text.placeholder'
		},
		bg: 'transparent',
		outline: 'none',
		w: 'full'
	},
	defaultVariants: {
		look: 'ghost',
		use: 'xs'
	},
	variants: {
		look: {
			editable: {
				_focus: {
					border: 'focused'
				},

				_hover: {
					bg: 'background.muted'
				},
				border: 'none'
			},
			form: {
				_focus: {
					border: 'focused'
				},
				border: 'subtle'
			},
			ghost: {},
			subtle: {
				_focus: {
					border: 'focused'
				},
				border: 'subtle'
			},
			transparent: {
				_focus: {
					border: 'focused'
				},

				_hover: {
					bg: 'background.muted'
				},
				border: 'none'
			}
		},
		showIcon: {
			false: {},
			true: {}
		},
		use: {
			auto: {},
			lg: {
				fontSize: '3',
				h: '4.8rem',
				px: '3.5',
				rounded: 'xl'
			},
			md: {
				fontSize: '2',
				h: '4.4rem',
				px: '3.5',
				rounded: 'xl'
			},
			sm: {
				fontSize: '2',
				h: '3.8rem',
				px: '2',
				rounded: 'lg'
			},
			xl: {
				fontSize: '4',
				h: '5.6rem',
				px: '3.5',
				rounded: 'xl'
			},
			xs: {
				fontSize: '1',
				h: '3.2rem',
				px: '2',
				rounded: 'lg'
			}
		}
	}
})

export type CommandInputVariants = RecipeVariantProps<typeof commandInputStyles>

type Props = React.ComponentProps<typeof CommandPrimitive.Input> & {
	icon?: React.ReactNode
	wrapperProps?: React.ComponentProps<typeof Flex>
	iconWrapperProps?: React.ComponentProps<typeof Box>
} & JsxStyleProps &
	CommandInputVariants

const StyledCommandInput = styled(CommandPrimitive.Input, commandInputStyles)

export const CommandInput = ({ wrapperProps, use = 'xs', icon, showIcon, iconWrapperProps, ...props }: Props) => {
	return (
		<Flex
			align="center"
			cmdk-input-wrapper=""
			data-slot="command-input-wrapper"
			gap="2"
			pos="relative"
			w="full"
			{...wrapperProps}
		>
			{showIcon && <Box {...iconWrapperProps}>{icon ? icon : <Icons.searchNormal size={12} />}</Box>}
			<StyledCommandInput showIcon={showIcon} use={use} {...props} />
		</Flex>
	)
}
