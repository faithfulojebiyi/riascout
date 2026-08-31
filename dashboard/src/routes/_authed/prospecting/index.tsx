import { createFileRoute } from '@tanstack/react-router';

import { TargetPicker } from '../../../modules/prospecting/components/target/target-picker';

export const Route = createFileRoute('/_authed/prospecting/')({
  component: TargetPicker,
});
