import { cva, type RecipeVariantProps } from '@riascout-ui/styled-system/css'

import { Icons } from '../../icons/base'

export type SpinnerProps = {
	size?: 'attribute' | 'auto' | 'icon' | 'lg' | 'md' | 'sm' | 'xs' | 'xxs'
} & SpinnerVariants

export const spinnerStyle = cva({
	base: {
		animation: 'spin 1s linear infinite'
	},
	variants: {
		size: {
			attribute: {},
			auto: {},
			icon: {
				h: '1.4rem',
				w: '1.4rem'
			},
			lg: {
				h: '2.5rem',
				w: '2.5rem'
			},
			md: {
				h: '2rem',
				w: '2rem'
			},
			sm: {
				h: '1.6rem',
				w: '1.6rem'
			},
			xs: {
				h: '1.4rem',
				w: '1.4rem'
			},
			xxs: {
				h: '1.4rem',
				w: '1.4rem'
			}
		}
	}
})

export type SpinnerVariants = RecipeVariantProps<typeof spinnerStyle>
export const Spinner = ({ size = 'md' }: SpinnerProps) => {
	return <Icons.loading animation="loader" className={spinnerStyle({ size })} size={size} />
}
