import { createFileRoute, redirect } from '@tanstack/react-router';

/** firm prospecting lives under its target now; the old path still resolves */
export const Route = createFileRoute('/_authed/firms')({
  beforeLoad: () => {
    throw redirect({ to: '/prospecting/firms' });
  },
});
