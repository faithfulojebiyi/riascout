'use client'

import type * as React from 'react'

import { Command as CommandPrimitive } from 'cmdk'

import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const StyledEmpty = styled(CommandPrimitive.Empty)

export const CommandEmpty = (props: React.ComponentProps<typeof CommandPrimitive.Empty> & JsxStyleProps) => {
	return <StyledEmpty data-slot="command-empty" px="2.5" py="5" {...props} />
}
