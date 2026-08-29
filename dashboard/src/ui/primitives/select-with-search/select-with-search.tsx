import { useEffect, useMemo, useRef, useState } from 'react';

import { Icons } from '../../icons/base';
import { css } from '@riascout-ui/styled-system/css';

import { Button, ButtonProps } from '../button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '../command';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { PopoverContentProps } from '../popover/popover-content';
import { Span } from '../text';

export type SelectWithSearchProps = {
  options: { value: string; label: string }[];
  placeholder?: string;
  value: string;
  setValue: (val: string) => void;
  defaultValue?: string;
  disabled?: boolean;
  triggerTestId?: string;
  triggerProps?: ButtonProps;
  triggerClassName?: string;
  popoverContentProps?: PopoverContentProps;
  getOptionTestId?: (option: { value: string; label: string }) => string;
};

export const SelectWithSearch = (props: SelectWithSearchProps) => {
  const {
    options,
    placeholder = 'Select',
    value,
    setValue,
    defaultValue,
    disabled,
    triggerTestId,
    triggerProps,
    triggerClassName,
    popoverContentProps,
    getOptionTestId,
  } = props;

  const val = defaultValue || value || '';
  const [selected, setSelected] = useState(
    options.find((opt) => opt.value === val)?.label || '',
  );
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const val = defaultValue || value || '';

    if (val && !selected) {
      setSelected(options.find((opt) => opt.value === val)?.label || '');
    }
  }, [defaultValue]);

  // custom Filter
  const filteredResults = useMemo(() => {
    return options.filter((item) =>
      item.label.toLowerCase().includes(search.toLowerCase()),
    );
  }, [options, search]);

  useEffect(() => {
    if (!search.trim() && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [search]);

  return (
    <Popover
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setSearch('');
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          border="1px solid {colors.fg.3}"
          color={selected ? undefined : 'text.placeholder'}
          data-testid={triggerTestId}
          disabled={disabled}
          fontSize="2"
          fontWeight="400"
          variant="form"
          role="combobox"
          w="full"
          {...triggerProps}
          className={triggerClassName}
        >
          <Span>{selected || defaultValue || placeholder}</Span>
          <Icons.caretDown ml="1" style={{ color: 'text.muted' }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" w="35rem" {...popoverContentProps}>
        <Command
          className={css({ minW: '100%', p: '0', w: '100%' })}
          shouldFilter={false}
        >
          <CommandInput onValueChange={setSearch} placeholder={placeholder} />
          <CommandEmpty className={css({ pl: '1rem', py: '2rem' })}>
            No option.
          </CommandEmpty>
          <CommandList h="max-content" maxH="25rem" overflowY="scroll">
            {filteredResults?.map((item) => {
              return (
                <CommandItem
                  data-testid={getOptionTestId?.(item)}
                  key={item.value}
                  mb="0.5"
                  onSelect={() => {
                    setValue(item.value);
                    setSelected(item.label);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  {item.label}
                  <Icons.check
                    mr="2"
                    opacity={value === item.value.toLowerCase() ? '1' : '0'}
                  />
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
