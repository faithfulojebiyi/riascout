import { cva } from '@riascout-ui/styled-system/css'
import { styled } from '@riascout-ui/styled-system/jsx'
import type { JsxStyleProps } from '@riascout-ui/styled-system/types'

const fieldGroupStyles = cva({
	base: {
		containerName: 'field-group',
		containerType: 'inline-size',
		display: 'flex',
		flexDirection: 'column',
		gap: '1rem',
		width: '100%'
	}
})
const StyledFieldGroup = styled('div', fieldGroupStyles)

export const FieldGroup = ({ ...props }: React.ComponentProps<'div'> & JsxStyleProps) => {
	return <StyledFieldGroup className="group/field-group" data-slot="field-group" {...props} />
}
