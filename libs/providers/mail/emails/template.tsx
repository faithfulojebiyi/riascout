import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';

/**
 * Inline style objects, not classes: every template spreads these. Email
 * clients strip <style> blocks and have no cascade worth relying on.
 */
export const page: React.CSSProperties = {
  backgroundColor: '#f6f7f8',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: '32px 0',
};

export const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e6e8eb',
  borderRadius: '10px',
  margin: '0 auto',
  maxWidth: '520px',
  padding: '32px',
};

export const h1: React.CSSProperties = {
  color: '#101317',
  fontSize: '20px',
  fontWeight: 600,
  lineHeight: '28px',
  margin: '0 0 12px',
};

export const paragraph: React.CSSProperties = {
  color: '#3d444d',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

export const muted: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
  margin: 0,
};

export const code: React.CSSProperties = {
  backgroundColor: '#f2f4f6',
  borderRadius: '8px',
  color: '#101317',
  display: 'block',
  fontFamily: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: '30px',
  fontWeight: 600,
  letterSpacing: '6px',
  margin: '0 0 20px',
  padding: '16px',
  textAlign: 'center',
};

export const button: React.CSSProperties = {
  backgroundColor: '#101317',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 500,
  padding: '11px 20px',
  textDecoration: 'none',
};

export const divider: React.CSSProperties = {
  borderTop: '1px solid #e6e8eb',
  margin: '24px 0 16px',
};

/** the shell every template renders inside; preview is the inbox snippet */
export const EmailLayout = ({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) => (
  <Html lang="en">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={page}>
      <Container style={container}>
        <Text style={{ ...h1, fontSize: '15px', margin: '0 0 24px' }}>
          RIAScout
        </Text>
        {children}
        <Section style={divider} />
        <Text style={muted}>
          You received this because someone used this address with RIAScout.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default EmailLayout;
