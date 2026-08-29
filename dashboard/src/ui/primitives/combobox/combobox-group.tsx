'use client';

import { Combobox as ComboboxPrimitive } from '@base-ui/react';

import { styled } from '@riascout-ui/styled-system/jsx';
import type { JsxStyleProps } from '@riascout-ui/styled-system/types';

const StyledGroup = styled(ComboboxPrimitive.Group);

export type ComboboxGroupProps = ComboboxPrimitive.Group.Props & JsxStyleProps;

export const ComboboxGroup = ({ ...props }: ComboboxGroupProps) => {
  return <StyledGroup data-slot="combobox-group" {...props} />;
};
