import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const fieldLegendStyles = cva({
	base: {
		'&[data-variant=legend]': {
			fontSize: 'base'
		},
		fontWeight: 'medium',
		mb: '3'
	},
	variants: {
		variant: {
			label: {
				fontSize: '2'
			},
			legend: {
				fontSize: '3'
			}
		}
	}
})

const StyledFieldLegend = styled('legend', fieldLegendStyles)
export const FieldLegend = ({
	variant = 'legend',
	...props
}: React.ComponentProps<'legend'> & {
	variant?: 'legend' | 'label'
} & JsxStyleProps) => {
	return <StyledFieldLegend data-slot="field-legend" variant={variant} {...props} />
}
