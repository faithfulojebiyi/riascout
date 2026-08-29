'use client'

import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'

import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const StyledRadioGroup = styled(DropdownMenuPrimitive.RadioGroup)

export const DropdownMenuRadioGroup = ({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup> & JsxStyleProps) => {
	return <StyledRadioGroup data-slot="dropdown-menu-radio-group" {...props} />
}
