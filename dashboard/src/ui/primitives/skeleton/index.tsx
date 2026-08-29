import * as React from 'react'

import { Slot } from 'radix-ui'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type SkeletonElement = React.ElementRef<'span'>
type Props<T> = {
	loading?: boolean
	asChild?: boolean
} & React.HTMLAttributes<T> &
	JsxStyleProps

export type SkeletonProps = Props<HTMLSpanElement> & {
	children?: React.ReactNode
}

const skeletonStyles = cva({
	base: {
		// '& > *, &::after, &::before': {
		// 	visibility: 'hidden'
		// },
		// '&:empty': {
		// 	display: 'block',
		// 	height: '3'
		// },
		'&[data-inline-skeleton]': {
			lineHeight: '0'
		},
		animation: 'skeletonPulse 1000ms infinite alternate-reverse',
		backgroundClip: 'border-box',
		backgroundImage: 'none',
		border: 'none',
		borderRadius: 'sm',
		boxDecorationBreak: 'clone',
		boxShadow: 'none',
		color: 'transparent',
		cursor: 'default',
		display: 'block',
		h: '3',
		outline: 'none',
		pointerEvents: 'none',
		userSelect: 'none'
	}
})

const StyledSkeleton = styled('span', skeletonStyles)

const Skeleton = React.forwardRef<SkeletonElement, SkeletonProps>((props, forwardedRef) => {
	const { children, loading = true, asChild = false, ...skeletonProps } = props

	if (!loading) return children

	const Component = asChild ? Slot.Root : StyledSkeleton

	return (
		<Component
			aria-hidden
			data-inline-skeleton={React.isValidElement(children) ? undefined : true}
			ref={forwardedRef}
			tabIndex={-1}
			{...skeletonProps}
		>
			{children}
		</Component>
	)
})

Skeleton.displayName = 'Skeleton'

export { Skeleton }
