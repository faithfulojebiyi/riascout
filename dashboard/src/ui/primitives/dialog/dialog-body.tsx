import { Box, type BoxProps } from '@riascout-ui/styled-system/jsx';

export const DialogBody = ({ ...props }: BoxProps) => {
  return (
    <Box
      data-slot="dialog-body"
      maxH="90vh"
      overflowY="scroll"
      px="4"
      py="3"
      {...props}
    />
  );
};
