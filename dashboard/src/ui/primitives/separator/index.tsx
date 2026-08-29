import type * as React from 'react'

import { Separator as SeparatorPrimitive } from 'radix-ui'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

export type SeparatorProps = React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> &
	JsxStyleProps & {
		orientation?: 'horizontal' | 'vertical'
		decorative?: boolean
	}

const separatorStyles = cva({
	base: {
		bg: 'colors.gray.4',
		flexShrink: 0
	}
})

const StyledSeparator = styled(SeparatorPrimitive.Root, separatorStyles)

export const Separator = ({ orientation = 'horizontal', decorative = true, ...props }: SeparatorProps) => {
	return (
		<StyledSeparator
			decorative={decorative}
			orientation={orientation}
			{...props}
			style={{
				height: orientation === 'horizontal' ? '1px' : '100%',
				width: orientation === 'vertical' ? '1px' : '100%'
			}}
		/>
	)
}
