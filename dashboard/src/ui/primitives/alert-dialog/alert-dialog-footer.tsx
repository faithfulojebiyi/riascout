import type { FlexProps } from '@riascout-ui/styled-system/jsx'

import { Flex } from '../layout'

export const AlertDialogFooter = (props: FlexProps) => {
	return <Flex data-slot="alert-dialog-footer" {...props} />
}
