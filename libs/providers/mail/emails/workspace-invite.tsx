import { Button, Heading, Text } from '@react-email/components';

import { EmailLayout, button, h1, muted, paragraph } from './template.js';

export type WorkspaceInviteProps = {
  workspaceName: string;
  /** null when the inviter has not set a name; the copy drops the clause */
  invitedBy: string | null;
  acceptUrl: string;
};

export const WorkspaceInvite = ({
  workspaceName = 'Northstar Advisors',
  invitedBy = 'Dana Whitfield',
  acceptUrl = 'https://app.riascout.com/invite/example',
}: WorkspaceInviteProps) => (
  <EmailLayout preview={`Join ${workspaceName} on RIAScout`}>
    <Heading style={h1}>Join {workspaceName}</Heading>
    <Text style={paragraph}>
      {invitedBy ? `${invitedBy} invited you` : 'You have been invited'} to the{' '}
      {workspaceName} workspace on RIAScout.
    </Text>
    <Button href={acceptUrl} style={button}>
      Accept the invitation
    </Button>
    <Text style={{ ...muted, marginTop: '20px' }}>
      If the button does not work, paste this into your browser:
      <br />
      {acceptUrl}
    </Text>
  </EmailLayout>
);

export default WorkspaceInvite;
