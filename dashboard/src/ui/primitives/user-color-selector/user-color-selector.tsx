import React, { ReactNode, useState } from 'react'

import { Icons } from '../../icons/base'
import { Button } from '../button'
import { Popover, PopoverContent, PopoverTrigger } from '../popover'
import { Flex } from '@riascout-ui/styled-system/jsx'
import { Token, token } from '@riascout-ui/styled-system/tokens'
import { USER_COLORS } from '../../theme/colors'

import { PopoverContentProps } from '../popover/popover-content'

type Props = {
	color: string
	setColor: (color: string) => void
	triggerChildren?: ReactNode
	popoverContentProps?: PopoverContentProps
	colorType?: 'solid' | 'alpha'
}

export const UserColorSelector = ({
	triggerChildren,
	popoverContentProps,
	color,
	setColor,
	colorType = 'solid'
}: Props) => {
	const [open, setOpen] = useState(false)

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				{triggerChildren || (
					<Button
						bg="var(--color)"
						color={color ? 'var(--text-color)' : 'text.app'}
						variant="outline"
						style={
							{
								'--color': token.var(`colors.user.${colorType}.${color}` as Token),
								'--text-color': token.var(`colors.user.text.${color}` as Token)
							} as React.CSSProperties
						}
					>
						<Icons.caretDown size={12} />
					</Button>
				)}
			</PopoverTrigger>
			<PopoverContent align="start" p="4" w="26rem" {...popoverContentProps}>
				<Flex gap="4" wrap="wrap">
					{USER_COLORS.map((color: string) => (
						<Button
							bg="var(--color)"
							color={colorType === 'alpha' ? 'var(--text-color)' : 'white'}
							fontSize="1"
							h="8"
							key={color}
							variant="ghost"
							onClick={(e) => {
								e.stopPropagation()
								setColor(color)
								setOpen(false)
							}}
							rounded="50%"
							size="sm"
							style={
								{
									'--color': token.var(`colors.user.${colorType}.${color}` as Token),
									'--text-color': token.var(`colors.user.text.${color}` as Token)
								} as React.CSSProperties
							}
							w="8"
						>
							A
						</Button>
					))}
				</Flex>
			</PopoverContent>
		</Popover>
	)
}
