import { useState, type ComponentProps } from 'react';
import { Flex, VStack } from '@riascout-ui/styled-system/jsx';

import {
  InviteTeammatesInvitesItemRole,
  type OnboardingState,
} from '../../../api/generated/rIAScoutAPI.schemas';
import { Button } from '../../../ui/primitives/button';
import { Input } from '../../../ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/primitives/select';
import { Span } from '../../../ui/primitives/text';
import { toast } from '../../../ui/primitives/toast/toast';
import { useInviteTeammates } from '../mutations/use-onboarding-steps';
import { StepHeader } from './step-header';

type Row = { email: string; role: InviteTeammatesInvitesItemRole };

const ROLE_LABELS: Record<InviteTeammatesInvitesItemRole, string> = {
  admin: 'Admin',
  member: 'Member',
};

const emptyRow = (): Row => ({
  email: '',
  role: InviteTeammatesInvitesItemRole.member,
});

export type InviteStepProps = {
  state: OnboardingState;
  step: number;
  total: number;
  onBack: () => void;
  onDone: () => void;
  finishing: boolean;
};

export const InviteStep = ({
  state,
  step,
  total,
  onBack,
  onDone,
  finishing,
}: InviteStepProps) => {
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);

  const inviteTeammates = useInviteTeammates();

  const setRow = (index: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row, at) => (at === index ? { ...row, ...patch } : row)),
    );

  const filled = rows.filter((row) => row.email.trim() !== '');

  const onSubmit: ComponentProps<'form'>['onSubmit'] = async (event) => {
    event.preventDefault();

    let result;

    try {
      result = await inviteTeammates.mutateAsync({
        invites: filled.map((row) => ({
          email: row.email.trim(),
          role: row.role,
        })),
      });
    } catch {
      // the mutation's onError already reported it; do not finish onboarding
      return;
    }

    if (result.skipped.length > 0) {
      toast.info(
        `${result.skipped.length} already invited or already a member`,
      );
    }

    onDone();
  };

  const busy = inviteTeammates.isPending || finishing;

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <VStack alignItems="stretch" gap="6">
        <StepHeader
          description="A shortlist is worth more when the whole desk can work it. Invites can wait — you can send them any time from settings."
          step={step}
          title="Collaborate with your team"
          total={total}
        />

        <VStack alignItems="stretch" gap="3">
          <Span color="text.muted" fontSize="2">
            Invite people to collaborate in RIAScout
          </Span>

          {rows.map((row, index) => (
            <Flex gap="2" key={index}>
              <Input
                flex="1"
                onChange={(event) =>
                  setRow(index, { email: event.target.value })
                }
                placeholder="example@email.com"
                size="sm"
                type="email"
                value={row.email}
              />
              <Select
                onValueChange={(value) =>
                  setRow(index, {
                    role: value as InviteTeammatesInvitesItemRole,
                  })
                }
                value={row.role}
              >
                <SelectTrigger size="sm" w="8rem">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Flex>
          ))}

          {rows.length < 10 ? (
            <Button
              alignSelf="flex-start"
              onClick={() => setRows((current) => [...current, emptyRow()])}
              size="sm"
              type="button"
              variant="ghost"
            >
              Add another
            </Button>
          ) : null}

          {state.pendingInvites.length > 0 ? (
            <Span color="text.placeholder" fontSize="1">
              {state.pendingInvites.length} invite
              {state.pendingInvites.length === 1 ? '' : 's'} already pending
            </Span>
          ) : null}
        </VStack>

        <VStack alignItems="stretch" gap="2">
          <Button
            disabled={busy || filled.length === 0}
            size="sm"
            type="submit"
          >
            {busy ? 'Working…' : 'Send invites'}
          </Button>
          <Button
            disabled={busy}
            onClick={onDone}
            size="sm"
            type="button"
            variant="ghost"
          >
            Skip for now
          </Button>
          <Button onClick={onBack} size="sm" type="button" variant="ghost">
            Back
          </Button>
        </VStack>

        <Span color="text.placeholder" fontSize="1">
          No mail provider is configured yet — each invite is written to the api
          log instead of being sent.
        </Span>
      </VStack>
    </form>
  );
};
