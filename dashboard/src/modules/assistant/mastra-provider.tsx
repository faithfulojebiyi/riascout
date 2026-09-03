import { MastraReactProvider } from '@mastra/react';
import type { ReactNode } from 'react';

/** mastra's routes are mounted on the api under /agent; the cookie is the credential */
export const MASTRA_API_PREFIX = '/agent';

export const MastraProvider = ({ children }: { children: ReactNode }) => (
  <MastraReactProvider
    apiPrefix={MASTRA_API_PREFIX}
    baseUrl={import.meta.env?.VITE_API_URL ?? 'http://localhost:3320'}
    credentials="include"
  >
    {children}
  </MastraReactProvider>
);
