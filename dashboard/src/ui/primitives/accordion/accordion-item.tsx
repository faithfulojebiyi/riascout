'use client'

import type * as React from 'react'

import { Accordion as AccordionPrimitive } from 'radix-ui'

import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const StyledAccordionItem = styled(AccordionPrimitive.Item)

export const AccordionItem = ({ ...props }: React.ComponentProps<typeof AccordionPrimitive.Item> & JsxStyleProps) => {
	return <StyledAccordionItem {...props} />
}
