import { Box, type BoxProps } from '@riascout-ui/styled-system/jsx';

export const SheetBody = ({ ...props }: BoxProps) => {
  return <Box px="4" py="3" {...props} />;
};
