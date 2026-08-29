import { Flex, type FlexProps } from '@riascout-ui/styled-system/jsx'

export const SheetFooter = ({ ...props }: FlexProps) => {
	return (
		<Flex
			gap="3"
			// glass="popup"
			justify="flex-end"
			px="4"
			py="3"
			w="full"
			{...props}
		/>
	)
}
