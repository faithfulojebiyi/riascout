'use client'

import type * as React from 'react'

import { Select as SelectPrimitive } from 'radix-ui'

import { styled } from '@riascout-ui/styled-system/jsx'

const StyledSeparator = styled(SelectPrimitive.Separator)

export const SelectSeparator = ({ ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) => {
	return <StyledSeparator h="1px" mx="4px" my="4px" {...props} />
}
