import { Suspense, type ReactNode } from 'react';

import { QueryProvider } from '../../../lib/query';
import { ThemeProvider } from '../../../ui/primitives/theme/theme-provider';
import { Toaster } from '../../../ui/primitives/toast/toast';

/**
 * One place every provider is composed, so a screen cannot render with half of
 * them. The toaster sits outside the query provider because the query cache
 * reports failures through it and must not depend on it.
 */
export const AppProviders = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={null}>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
      storageKey="riascout:theme"
      themes={['light', 'dark']}
    >
      <QueryProvider>{children}</QueryProvider>
      <Toaster />
    </ThemeProvider>
  </Suspense>
);
