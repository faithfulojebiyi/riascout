import { Heading, Text } from '@react-email/components';

import { EmailLayout, code, h1, muted, paragraph } from './template.js';

export type SignInOtpProps = {
  otp: string;
  /** seconds; the plugin is configured for 300 */
  expiresIn: number;
};

/** the defaults are the preview fixture, so `email dev` renders without props */
export const SignInOtp = ({ otp = '481902', expiresIn = 300 }: SignInOtpProps) => (
  <EmailLayout preview={`${otp} is your RIAScout sign-in code`}>
    <Heading style={h1}>Your sign-in code</Heading>
    <Text style={paragraph}>Enter this code to finish signing in.</Text>
    <Text style={code}>{otp}</Text>
    <Text style={muted}>
      It expires in {Math.round(expiresIn / 60)} minutes and can be used once. If
      you did not ask to sign in, ignore this — nobody can get in without it.
    </Text>
  </EmailLayout>
);

export default SignInOtp;
