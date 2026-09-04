import { useState } from 'react';
import { Link, useParams, useRouterState } from '@tanstack/react-router';
import { Box, HStack } from '@riascout-ui/styled-system/jsx';

import { useFetchEntities } from '../../entities/queries/use-fetch-entities';
import { Icons } from '../../../ui/icons/base';
import { AnimateChangeInHeight } from '../../../ui/primitives/animated-height';
import { Avatar, AvatarFallback } from '../../../ui/primitives/avatar';
import { Button } from '../../../ui/primitives/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from '../../../ui/primitives/sidebar';
import { GLOBAL_NAV, entityIcon, type NavItem } from './nav-config';
import { Pill } from './pill';
import { UserMenu } from './user-menu';

const workspaceInitials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** the workspace mark in the header — identity, not a switcher */
const WorkspaceMark = ({ workspaceName }: { workspaceName: string }) => (
  <Avatar radius="md" size={1}>
    <AvatarFallback
      bg="brand.primary.9"
      color="brand.primary.1"
      fontSize="1"
      fontWeight="600"
    >
      {workspaceInitials(workspaceName) || '·'}
    </AvatarFallback>
  </Avatar>
);

const NavRow = ({ item, isActive }: { item: NavItem; isActive?: boolean }) => {
  const ItemIcon = Icons[item.icon];
  const label = (
    <>
      <ItemIcon />
      <span>{item.title}</span>
      {item.pill ? (
        <Box ml="auto">
          <Pill tone={item.pill === 'Beta' ? 'accent' : 'subtle'}>
            {item.pill}
          </Pill>
        </Box>
      ) : null}
    </>
  );

  if (item.disabled || !item.href) {
    return (
      <SidebarMenuButton aria-disabled tooltip={item.title}>
        {label}
      </SidebarMenuButton>
    );
  }

  return (
    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
      <Link to={item.href}>{label}</Link>
    </SidebarMenuButton>
  );
};

/**
 * Global nav up top, then the workspace's records with the active one expanded
 * inline to its saved views. Entities come from GET /entities rather than a
 * hardcoded list: a workspace can gain one, and a sidebar that does not know
 * about it makes that entity unreachable.
 */
export const AppSidebar = ({ workspaceName }: { workspaceName: string }) => {
  const { data, isPending } = useFetchEntities();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeViewId = useRouterState({
    select: (s) => (s.location.search as { view?: string }).view,
  });
  const params = useParams({ strict: false });
  const activeSlug = params.entitySlug;
  // clicking the open entity again folds its views back up
  const [folded, setFolded] = useState(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* collapsed: the toggle moves to the footer — two items do not fit the rail */}
        <HStack
          css={{ '[data-collapsible=icon] &': { justifyContent: 'center' } }}
          gap="1"
          justify="space-between"
          w="full"
        >
          <WorkspaceMark workspaceName={workspaceName} />
          <SidebarTrigger
            css={{ '[data-collapsible=icon] &': { display: 'none' } }}
            h="7"
            p="0"
            w="7"
          />
        </HStack>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {GLOBAL_NAV.map((item) => (
              <SidebarMenuItem key={item.title}>
                <NavRow isActive={pathname === item.href} item={item} />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarMenu>
            {isPending ? (
              <>
                <SidebarMenuSkeleton showIcon />
                <SidebarMenuSkeleton showIcon />
              </>
            ) : (
              data?.entities.map((entity) => {
                const isActive = entity.slug === activeSlug;
                const EntityIcon = Icons[entityIcon(entity.sourceKind)];

                return (
                  <SidebarMenuItem key={entity.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={entity.name}
                    >
                      <Link
                        onClick={(event) => {
                          if (isActive) {
                            // already open — just fold or unfold the views
                            event.preventDefault();
                            setFolded((current) => !current);
                          } else {
                            setFolded(false);
                          }
                        }}
                        params={{ entitySlug: entity.slug }}
                        to="/$entitySlug"
                      >
                        <EntityIcon />
                        <span>{entity.name}</span>
                      </Link>
                    </SidebarMenuButton>

                    {entity.recordCount > 0 && !isActive ? (
                      <SidebarMenuBadge
                        // the rail has no room for a count next to the icon
                        css={{
                          '[data-collapsible=icon] &': { display: 'none' },
                        }}
                      >
                        {entity.recordCount.toLocaleString()}
                      </SidebarMenuBadge>
                    ) : null}

                    <AnimateChangeInHeight>
                      {isActive && !folded ? (
                        <SidebarMenuSub>
                          {entity.views.map((view) => (
                            <SidebarMenuSubItem key={view.id}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={
                                  activeViewId
                                    ? activeViewId === view.id
                                    : view.isDefault
                                }
                              >
                                <Link
                                  params={{ entitySlug: entity.slug }}
                                  search={{ view: view.id }}
                                  to="/$entitySlug"
                                >
                                  <Icons.entityList />
                                  <span>{view.name}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      ) : null}
                    </AnimateChangeInHeight>
                  </SidebarMenuItem>
                );
              })
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/* collapsed rail: the expand toggle lives here, above the avatar */}
        <Box
          css={{
            '[data-collapsible=icon] &': {
              display: 'flex',
              justifyContent: 'center',
            },
            display: 'none',
          }}
        >
          <SidebarTrigger h="7" p="0" w="7" />
        </Box>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
};
