import { useSyncExternalStore } from 'react';

/**
 * One sheet, opened from anywhere (today: the user menu). A module-level flag
 * rather than context so a menu item deep in the sidebar needs no provider.
 */
let open = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const openRecruiterProfile = () => {
  open = true;
  emit();
};

export const setRecruiterProfileOpen = (next: boolean) => {
  open = next;
  emit();
};

export const useRecruiterProfileOpen = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    () => open,
    () => false,
  );
