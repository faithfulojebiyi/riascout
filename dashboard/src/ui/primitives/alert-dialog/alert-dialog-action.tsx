'use client';

import type * as React from 'react';

import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';

export const AlertDialogAction = ({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) => {
  return <AlertDialogPrimitive.Action {...props} />;
};
