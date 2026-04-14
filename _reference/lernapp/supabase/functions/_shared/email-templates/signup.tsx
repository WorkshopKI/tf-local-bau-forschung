/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  token: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  recipient,
  token,
}: SignupEmailProps) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Dein Bestätigungscode für {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Willkommen beim Workshop KI - Prompting Tutor!</Heading>
        <Text style={text}>
          Gib den folgenden Code ein, um deine E-Mail-Adresse ({recipient}) zu bestätigen:
        </Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={text}>
          Der Code ist 10 Minuten gültig.
        </Text>
        <Text style={footer}>
          Falls du kein Konto erstellt hast, kannst du diese E-Mail ignorieren.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(48, 20%, 20%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: 'hsl(50, 2%, 50%)',
  lineHeight: '1.6',
  margin: '0 0 28px',
}
const codeStyle = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: 'hsl(15, 56%, 52%)',
  letterSpacing: '6px',
  textAlign: 'center' as const,
  margin: '0 0 32px',
  padding: '16px 0',
  borderTop: '1px solid hsl(50, 8%, 84%)',
  borderBottom: '1px solid hsl(50, 8%, 84%)',
}
const footer = { fontSize: '12px', color: 'hsl(50, 2%, 50%)', margin: '30px 0 0' }
