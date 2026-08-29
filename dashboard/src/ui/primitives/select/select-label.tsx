'use client'

import type * as React from 'react'

import { Select as SelectPrimitive } from 'radix-ui'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'

type Props = React.ComponentProps<typeof SelectPrimitive.Label>

const styledLabel = cva({
	base: {
		fontSize: '1',
		pr: '4',
		py: '1.5'
	}
})

const StyledLabel = styled(SelectPrimitive.Label, styledLabel)

export const SelectLabel = (props: Props) => {
	return <StyledLabel {...props} />
}
