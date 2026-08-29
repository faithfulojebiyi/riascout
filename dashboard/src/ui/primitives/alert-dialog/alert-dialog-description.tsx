'use client'

import type * as React from 'react'

import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'

import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const StyledDescription = styled(AlertDialogPrimitive.Description)

export const AlertDialogDescription = (
	props: React.ComponentProps<typeof AlertDialogPrimitive.Description> & JsxStyleProps
) => {
	return <StyledDescription color="text.muted" data-slot="alert-dialog-description" fontWeight="500" {...props} />
}
