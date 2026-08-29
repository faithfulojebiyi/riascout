'use client'

import { css } from '@riascout-ui/styled-system/css'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

import { Input, type InputProps } from '../input'

type SidebarInputProps = InputProps & JsxStyleProps

const inputWrapperStyles = css({
	px: '2'
})

export const SidebarInput = (props: SidebarInputProps) => {
	return (
		<div className={inputWrapperStyles}>
			<Input
				data-slot="sidebar-input"
				{...props}
				css={{
					_focusVisible: {
						ring: '2px',
						ringColor: 'border.focused'
					},
					bg: 'background.app',
					h: '8',
					shadow: 'none'
				}}
			/>
		</div>
	)
}
