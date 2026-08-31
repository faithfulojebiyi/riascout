import { createFileRoute } from '@tanstack/react-router';

import { ProspectingPage } from '../../../modules/prospecting/components/prospecting-page';

export const Route = createFileRoute('/_authed/prospecting/firms')({
  component: () => <ProspectingPage sourceKind="firm" />,
});
