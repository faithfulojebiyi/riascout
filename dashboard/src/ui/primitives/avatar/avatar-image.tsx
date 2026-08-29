import * as React from 'react'

import { Avatar as AvatarPrimitive } from 'radix-ui'

import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

type Element = React.ElementRef<typeof AvatarPrimitive.Image>

const avatarImageStyle = cva({
	base: {
		aspectRatio: 'square',
		h: '100%',
		w: '100%'
	}
})

const StyledAvatarImage = styled(AvatarPrimitive.AvatarImage, avatarImageStyle)

export type AvatarImageProps = React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> & JsxStyleProps

export const AvatarImage = React.forwardRef<Element, AvatarImageProps>(function AvatarImage({ ...props }, ref) {
	return <StyledAvatarImage ref={ref} {...props} />
})
