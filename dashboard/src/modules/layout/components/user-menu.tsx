import { useNavigate } from '@tanstack/react-router';
import { Box, HStack } from '@riascout-ui/styled-system/jsx';

import { authClient, useSession } from '../../../lib/auth-client';
import { Icons } from '../../../ui/icons/base';
import { Avatar, AvatarFallback } from '../../../ui/primitives/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../ui/primitives/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../../../ui/primitives/sidebar';
import { Text } from '../../../ui/primitives/text';
import { useTheme } from '../../../ui/primitives/theme';

const initials = (value: string) =>
  value
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const THEMES = [
  { icon: 'sun', label: 'Light', value: 'light' },
  { icon: 'moon', label: 'Dark', value: 'dark' },
  { icon: 'device', label: 'System', value: 'system' },
] as const;

export const UserMenu = () => {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { setTheme, theme } = useTheme();
  const { isMobile } = useSidebar();

  const user = session?.user;
  const name = user?.name || user?.email || 'Account';

  const onSignOut = async () => {
    await authClient.signOut();
    await navigate({ to: '/sign-in', search: {} });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              css={{
                // collapsed rail: a centered square around the avatar, no stray padding
                '[data-collapsible=icon] &': {
                  h: '8',
                  justifyContent: 'center',
                  mx: 'auto',
                  p: '0',
                  w: '8',
                },
              }}
              gap="2"
              h="9"
              p="0"
            >
              <Avatar radius="md" size={1}>
                <AvatarFallback
                  bg="brand.primary.9"
                  color="brand.primary.1"
                  fontSize="1"
                  fontWeight="600"
                >
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <Box
                css={{ '[data-collapsible=icon] &': { display: 'none' } }}
                flex="1"
                minW="0"
                overflow="hidden"
                textAlign="left"
              >
                <Text
                  fontSize="1"
                  fontWeight="500"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {name}
                </Text>
              </Box>
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            css={{ minW: '15rem' }}
            side={isMobile ? 'bottom' : 'right'}
          >
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            {THEMES.map((option) => {
              const ThemeIcon = Icons[option.icon];

              return (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => setTheme(option.value)}
                >
                  <HStack gap="2" justify="space-between" w="full">
                    <HStack gap="2">
                      <ThemeIcon size={14} />
                      <Text fontSize="1">{option.label}</Text>
                    </HStack>
                    {theme === option.value ? <Icons.check size={14} /> : null}
                  </HStack>
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={() => void onSignOut()}>
              <HStack gap="2">
                <Icons.logout size={14} />
                <Text fontSize="1">Sign out</Text>
              </HStack>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
