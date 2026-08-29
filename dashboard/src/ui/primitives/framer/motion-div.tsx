'use client'

import { type HTMLMotionProps, isValidMotionProp, motion } from 'motion/react'

import { isCssProperty, styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type Props = Omit<JsxStyleProps, 'transition'> &
	HTMLMotionProps<'div'> & {
		className?: string
	}

export const MotionDiv = styled(
	motion.div,
	{},
	{
		shouldForwardProp: (prop, variantKeys) =>
			isValidMotionProp(prop) || (!variantKeys.includes(prop) && !isCssProperty(prop))
	}
) as React.FC<Props>
