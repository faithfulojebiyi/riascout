import { css } from '@riascout-ui/styled-system/css';
import { Link, useRouterState } from '@tanstack/react-router';

import { useFetchEntities } from '../../entities/queries/use-fetch-entities';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '../../../ui/primitives/sidebar';

/**
 * Records are listed from GET /entities rather than hardcoded: a workspace can
 * gain an entity, and a sidebar that does not know about it makes the entity
 * unreachable.
 */
export const AppSidebar = ({ workspaceName }: { workspaceName: string }) => {
  const { data, isPending } = useFetchEntities();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar>
      <SidebarHeader>
        <div
          className={css({
            fontSize: 'sm',
            fontWeight: '600',
            px: '2',
            py: '1',
          })}
        >
          {workspaceName}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Records</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isPending ? (
                <>
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton showIcon />
                </>
              ) : (
                data?.entities.map((entity) => (
                  <SidebarMenuItem key={entity.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/${entity.slug}`}
                    >
                      <Link
                        to="/$entitySlug"
                        params={{ entitySlug: entity.slug }}
                      >
                        {entity.name}
                      </Link>
                    </SidebarMenuButton>
                    {entity.recordCount > 0 ? (
                      <SidebarMenuBadge>
                        {entity.recordCount.toLocaleString()}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div
          className={css({
            color: 'text.muted',
            fontSize: 'xs',
            px: '2',
            py: '1',
          })}
        >
          RIAScout
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
