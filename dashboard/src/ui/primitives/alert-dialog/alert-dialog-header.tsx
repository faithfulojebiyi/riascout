import type { FlexProps } from '@riascout-ui/styled-system/jsx'

import { Flex } from '../layout'

export const AlertDialogHeader = (props: FlexProps) => {
	return <Flex data-slot="alert-dialog-header" {...props} />
}
