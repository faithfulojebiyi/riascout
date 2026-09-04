import { SidebarTrigger, useSidebar } from '../../../ui/primitives/sidebar';

/**
 * Below the mobile breakpoint the sidebar is a closed drawer and its own
 * trigger is inside it, so nothing on screen could open it. This one floats
 * over the page only on mobile.
 */
export const MobileSidebarTrigger = () => {
  const { isMobile, openMobile } = useSidebar();

  if (!isMobile || openMobile) return null;

  return (
    <SidebarTrigger
      bg="background.app"
      borderColor="brand.panel.6"
      borderWidth="1px"
      boxShadow="0 1px 2px rgba(10, 18, 23, 0.08)"
      h="8"
      left="2"
      p="0"
      position="fixed"
      rounded="md"
      top="2"
      w="8"
      zIndex="40"
    />
  );
};
