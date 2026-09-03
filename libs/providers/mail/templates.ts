import { render } from '@react-email/components';

import { SignInOtp, type SignInOtpProps } from './emails/sign-in-otp.js';
import {
  WorkspaceInvite,
  type WorkspaceInviteProps,
} from './emails/workspace-invite.js';

export type MailTemplates = {
  'sign-in-otp': SignInOtpProps;
  'workspace-invite': WorkspaceInviteProps;
};

export type MailTemplateName = keyof MailTemplates;

export type RenderedMail = { subject: string; html: string; text: string };

/**
 * Thunks, not values. A map of already-rendered templates would render every
 * one on every send and discard all but the one it looked up.
 */
const TEMPLATES: {
  [K in MailTemplateName]: {
    subject: (props: MailTemplates[K]) => string;
    render: (props: MailTemplates[K]) => Promise<RenderedMail>;
  };
} = {
  'sign-in-otp': {
    subject: (props) => `${props.otp} is your RIAScout sign-in code`,
    render: async (props) => ({
      subject: `${props.otp} is your RIAScout sign-in code`,
      html: await render(SignInOtp(props)),
      // a text part is not optional: html-only mail scores as spam
      text: await render(SignInOtp(props), { plainText: true }),
    }),
  },
  'workspace-invite': {
    subject: (props) => `Join ${props.workspaceName} on RIAScout`,
    render: async (props) => ({
      subject: `Join ${props.workspaceName} on RIAScout`,
      html: await render(WorkspaceInvite(props)),
      text: await render(WorkspaceInvite(props), { plainText: true }),
    }),
  },
};

export const renderTemplate = <K extends MailTemplateName>(
  name: K,
  props: MailTemplates[K],
): Promise<RenderedMail> => TEMPLATES[name].render(props);

export const templateSubject = <K extends MailTemplateName>(
  name: K,
  props: MailTemplates[K],
): string => TEMPLATES[name].subject(props);
