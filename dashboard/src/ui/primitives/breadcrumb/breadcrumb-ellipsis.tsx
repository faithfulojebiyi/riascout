'use client'

import type * as React from 'react'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

import { Icons } from '../../icons'
import { VisuallyHidden } from '../visually-hidden'

const breadcrumbEllipsisStyles = cva({
	base: {
		'& svg': {
			h: '4',
			w: '4'
		},
		alignItems: 'center',
		display: 'flex',
		h: '9',
		justifyContent: 'center',
		w: '9'
	}
})

const StyledSpan = styled('span', breadcrumbEllipsisStyles)

export type BreadcrumbEllipsisProps = React.ComponentProps<'span'> & JsxStyleProps

export const BreadcrumbEllipsis = ({ ...props }: BreadcrumbEllipsisProps) => {
	return (
		<StyledSpan aria-hidden="true" data-slot="breadcrumb-ellipsis" role="presentation" {...props}>
			<Icons.ellipsis />
			<VisuallyHidden>More</VisuallyHidden>
		</StyledSpan>
	)
}
