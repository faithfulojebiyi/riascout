import { createFileRoute } from '@tanstack/react-router';

import { ProspectingPage } from '../../../modules/prospecting/components/prospecting-page';

export const Route = createFileRoute('/_authed/prospecting/advisors')({
  component: () => <ProspectingPage sourceKind="advisor" />,
});
