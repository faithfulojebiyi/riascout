'use client'

import type * as React from 'react'

import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const radioGroupStyles = cva({
	base: {
		display: 'grid',
		gap: '2',
		w: 'full'
	}
})

const StyledRadioGroup = styled(RadioGroupPrimitive.Root, radioGroupStyles)

type RadioGroupProps = React.ComponentProps<typeof RadioGroupPrimitive.Root> & JsxStyleProps

export const RadioGroup = (props: RadioGroupProps) => <StyledRadioGroup data-slot="radio-group" {...props} />
