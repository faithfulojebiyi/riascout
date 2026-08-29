'use client'

import type * as React from 'react'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const breadcrumbListStyles = cva({
	base: {
		alignItems: 'center',
		color: 'text.muted',
		display: 'flex',
		flexWrap: 'wrap',
		fontSize: '2',
		gap: '1.5',
		sm: {
			gap: '2.5'
		},
		wordBreak: 'break-word'
	}
})

const StyledOl = styled('ol', breadcrumbListStyles)

export type BreadcrumbListProps = React.ComponentProps<'ol'> & JsxStyleProps

export const BreadcrumbList = ({ ...props }: BreadcrumbListProps) => {
	return <StyledOl data-slot="breadcrumb-list" {...props} />
}
