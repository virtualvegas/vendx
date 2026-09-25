import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  requestNumber?: string
  price?: string
  message?: string
  imageUrl?: string
  statusUrl?: string
}

const Email = ({ name, requestNumber, price, message, imageUrl, statusUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your custom arcade concept and quote are ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>VENDX GLOBAL</Text>
        <Heading style={h1}>Your concept is ready</Heading>
        <Text style={text}>{name ? `Hi ${name},` : 'Hi there,'}</Text>
        <Text style={text}>
          Our artists finished a concept for your custom arcade build{requestNumber ? ` (${requestNumber})` : ''}. Take a look below.
        </Text>
        {imageUrl ? <Img src={imageUrl} alt="Concept design" width="520" style={img} /> : null}
        {price ? (
          <Section style={priceBox}>
            <Text style={priceLabel}>Quoted price</Text>
            <Text style={priceValue}>{price}</Text>
          </Section>
        ) : null}
        {message ? <Text style={text}>{message}</Text> : null}
        <Text style={text}>Once you accept, production begins. Each custom build takes 4–6 weeks.</Text>
        {statusUrl ? <Button href={statusUrl} style={button}>View & respond to your quote</Button> : null}
        <Text style={footer}>Questions? Just reply to this email.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Your custom arcade concept${d?.requestNumber ? ` — ${d.requestNumber}` : ''}`,
  displayName: 'Custom arcade quote',
  previewData: { name: 'Alex', requestNumber: 'CAR-1024', price: '$4,850.00', message: 'We went with a neon Tron theme.', statusUrl: 'https://vendxglobal.net' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '580px' }
const brand = { color: '#12bde8', fontSize: '12px', fontWeight: 'bold', letterSpacing: '3px' }
const h1 = { color: '#0b1220', fontSize: '24px', margin: '8px 0 16px' }
const text = { color: '#333333', fontSize: '15px', lineHeight: '24px' }
const img = { borderRadius: '8px', width: '100%', margin: '12px 0' }
const priceBox = { backgroundColor: '#0b1220', borderRadius: '8px', padding: '12px 18px', margin: '16px 0' }
const priceLabel = { color: '#9aa4b2', fontSize: '12px', margin: '0' }
const priceValue = { color: '#39e58c', fontSize: '26px', fontWeight: 'bold', margin: '4px 0 0' }
const button = { backgroundColor: '#12bde8', color: '#0b1220', padding: '12px 20px', borderRadius: '6px', fontWeight: 'bold', textDecoration: 'none' }
const footer = { color: '#888888', fontSize: '12px', marginTop: '28px' }
