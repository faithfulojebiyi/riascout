import { createFileRoute, redirect } from '@tanstack/react-router';

/** the home page is the assistant; a bare /chat has nothing else to show */
export const Route = createFileRoute('/_authed/chat/')({
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
});
