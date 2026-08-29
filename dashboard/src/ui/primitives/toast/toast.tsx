'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps, toast } from 'sonner'

import { css, cx } from '@riascout-ui/styled-system/css'

import { Icons } from '../../icons/base'
import { buttonStyle } from '../button/button'

const baseToastStyles = css({
	alignItems: 'center',
	backdropFilter: 'blur(10px)',
	columnGap: '2.5',
	display: 'flex',
	p: '2.5',
	rounded: 'xl',
	w: 'full'
})

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = 'system' } = useTheme()
	return (
		<Sonner
			className="toaster group"
			icons={{
				error: <Icons.close className="size-4" />,
				info: <Icons.infoCircle className="size-4" />,
				loading: <Icons.loading animation="loader" className="size-4" />,
				success: <Icons.check className="size-4" />,
				warning: <Icons.warn className="size-4" />
			}}
			style={
				{
					'--border-radius': 'var(--radius)',
					'--normal-bg': 'var(--popover)',
					'--normal-border': 'var(--border)',
					'--normal-text': 'var(--popover-foreground)'
				} as React.CSSProperties
			}
			theme={theme as ToasterProps['theme']}
			toastOptions={{
				classNames: {
					actionButton: cx(
						buttonStyle({ size: 'xs', variant: 'outline' }),
						css({ colorPalette: 'colors.gray', cursor: 'pointer' })
					),
					default: cx(
						baseToastStyles,
						css({
							_dark: {
								bg: 'rgba(4, 2, 12, 0.75)',
								color: 'darkGrayAlpha.12'
							},

							_light: {
								bg: 'rgba(255, 255, 255, 1) !important',
								color: 'color.gray.12 !important'
							},
							border: 'subtle'
						})
					),
					description: css({ fontSize: '1', fontWeight: '500' }),
					error: cx(
						baseToastStyles,
						css({
							_dark: {
								bg: 'linear-gradient(90deg, token(colors.darkErrorAlpha.5) 0%, token(colors.darkErrorAlpha.2) 100%)'
							},

							_light: {
								bg: 'linear-gradient(90deg, token(colors.errorAlpha.10) 0%, token(colors.errorAlpha.7) 100%) !important'
							},
							border: 'error'
							// glass: 'popup'
						})
					),
					info: cx(
						baseToastStyles,
						css({
							_dark: {
								bg: 'linear-gradient(90deg, token(colors.darkInfoAlpha.5) 0%, token(colors.darkInfoAlpha.2) 100%)'
							},

							_light: {
								bg: 'linear-gradient(90deg, token(colors.infoAlpha.11) 0%, token(colors.infoAlpha.7) 100%) !important'
							},
							border: 'info'
							// glass: 'popup'
						})
					),
					success: cx(
						baseToastStyles,
						css({
							_dark: {
								bg: 'linear-gradient(90deg, token(colors.successAlpha.5) 0%, token(colors.successAlpha.2) 100%)'
							},

							_light: {
								bg: 'linear-gradient(90deg, token(colors.successAlpha.10) 0%, token(colors.successAlpha.7) 100%) !important'
							},
							border: 'success'
							// glass: 'popup'
						})
					),
					title: css({ fontSize: '2', fontWeight: '500' }),
					warning: cx(
						baseToastStyles,
						css({
							_dark: {
								bg: 'linear-gradient(90deg, token(colors.darkWarningAlpha.5) 0%, token(colors.darkWarningAlpha.2) 100%)'
							},

							_light: {
								bg: 'linear-gradient(90deg, token(colors.warningAlpha.11) 0%, token(colors.warningAlpha.8) 100%) !important'
							},
							border: 'warning'
							// glass: 'popup'
						})
					)
				},
				unstyled: true
			}}
			{...props}
		/>
	)
}
export { Toaster, toast }
