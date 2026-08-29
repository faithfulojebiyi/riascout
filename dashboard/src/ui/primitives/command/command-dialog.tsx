import type { Dialog as DialogPrimitive } from 'radix-ui'

import { css } from '@riascout-ui/styled-system/css'

import { Dialog, DialogContent } from '../dialog'
import { Command } from './command'

type CommandDialogProps = {
	dialogContentStyles?: string
} & DialogPrimitive.DialogProps

const dialogCommandStyles = css({})

export const CommandDialog = ({ children, dialogContentStyles, ...props }: CommandDialogProps) => {
	return (
		<Dialog {...props}>
			<DialogContent className={dialogContentStyles} overflow="hidden" p="0">
				<Command className={dialogCommandStyles}>{children}</Command>
			</DialogContent>
		</Dialog>
	)
}
