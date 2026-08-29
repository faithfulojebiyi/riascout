import { Popover as PopoverPrimitive } from 'radix-ui'

import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const StyledAnchor = styled(PopoverPrimitive.Anchor, {
	base: {
		w: 'full'
	}
})

type Props = React.ComponentProps<typeof PopoverPrimitive.Anchor> & {
	inset?: boolean
} & JsxStyleProps

export const PopoverAnchor = ({ ...props }: Props) => {
	return <StyledAnchor data-slot="popover-anchor" {...props} />
}
