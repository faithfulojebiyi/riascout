'use client'

import type * as React from 'react'

import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'

import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const StyledCancel = styled(AlertDialogPrimitive.Cancel)

export const AlertDialogCancel = (props: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> & JsxStyleProps) => {
	return <StyledCancel {...props} />
}
