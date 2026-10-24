import nodemailer from 'nodemailer'
import { unsubscribeUrl } from '@/lib/unsubscribe'

// Email goes out through Resend when RESEND_API_KEY is set (it reports delivery,
// opens, clicks and bounces back to /api/email/webhook), otherwise through SMTP.
export const isResendConfigured = () => Boolean(process.env.RESEND_API_KEY)

// True when email can be sent by either route
export function isSmtpConfigured(): boolean {
  return isResendConfigured() || Boolean(process.env.SMTP_PASS)
}

// A send failure that retrying won't fix (bad address, rejected by the provider)
export class PermanentEmailError extends Error {
  permanent = true
}

export function getFromEmail(): string {
  const fromName = process.env.EMAIL_FROM_NAME || 'Selfera Support'
  const fromAddress = process.env.SMTP_USER || process.env.EMAIL_FROM || 'support@selfera.co.uk'
  return `"${fromName}" <${fromAddress}>`
}

// The email layout. Markers: {{title}}, {{preheader}}, {{unsubscribe_url}}, and the
// message text goes between CONTENT START and CONTENT END (the sample paragraphs
// there only set the paragraph style). HTML comments are stripped before sending.
const EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>{{title}}</title>
<style>
  :root { color-scheme: light only; supported-color-schemes: light only; }
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #ffffff; }

  @media screen and (max-width: 600px) {
    .email-container { width: 100% !important; max-width: 100% !important; }
    .fluid-padding { padding-left: 20px !important; padding-right: 20px !important; }
    .cta-button { width: 100% !important; text-align: center !important; }
    .cta-button a { display: block !important; width: 100% !important; box-sizing: border-box !important; }
    .h1-mobile { font-size: 22px !important; line-height: 30px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#ffffff;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#ffffff;">
  {{preheader}}
</div>

<center style="width:100%; background-color:#ffffff; padding: 0 0 40px 0;">
<div style="max-width:600px; margin:0 auto;" class="email-container">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; margin:0 auto; background-color:#ffffff; border:0;">

    <!-- HEADER: LIGHT GREEN BACKGROUND + CENTERED LOGO + NAVBAR BRAND TEXT + BOTTOM #002921 LINE -->
    <tr>
      <td class="fluid-padding" style="background-color:#edf5f2; padding:34px 24px 28px 24px; border-bottom:2.5px solid #002921; text-align:center;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="text-align:center;">
                    <img src="https://www.selfera.co.uk/logo.png" width="106" height="71" alt="Selfera" style="display:block; width:106px; height:auto; border:0; outline:none; text-decoration:none; margin:0 auto;">
                  </td>
                </tr>
                <tr>
                  <td align="center" style="text-align:center; padding-top:14px;">
                    <div style="font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:29px; font-weight:700; line-height:1; color:#1d1d1f; letter-spacing:-0.04em;">
                      Selfera<span style="color:#0071e3;">.</span>
                    </div>
                    <div style="font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; font-weight:600; line-height:1.2; color:#0071e3; letter-spacing:0.025em; margin-top:5px;">
                      Automation, with an associate
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- MAIN BODY CONTENT -->
    <tr>
      <td class="fluid-padding" style="background-color:#ffffff; padding:38px 32px 24px 32px;">
        <!-- CONTENT START: the email's text goes here. The sample paragraphs below are only for previewing;
             each paragraph of the real message uses the first <p> tag's style. -->
        <p style="margin:0 0 16px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; line-height:1.65; color:#1d1d1f;">Hi Sarah,</p>
        <p style="margin:0 0 16px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; line-height:1.65; color:#1d1d1f;">I came across The Olive Tree and loved what you're doing in Camden. We help restaurants like yours automate bookings, reviews and follow-ups, so your team can focus on guests.</p>
        <p style="margin:0 0 16px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; line-height:1.65; color:#1d1d1f;">Would you be open to a quick 15-minute call this week?</p>
        <p style="margin:0 0 16px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; line-height:1.65; color:#1d1d1f;">Best regards,<br />Kesav<br />Selfera</p>
        <!-- CONTENT END -->
      </td>
    </tr>

    <!-- FOOTER: EXECUTIVE CARD IN #002921 WITH LOGO IN TOP-RIGHT CORNER -->
    <tr>
      <td class="fluid-padding" style="padding:10px 32px 36px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#002921; border-radius:16px; overflow:hidden; box-shadow:0 6px 20px rgba(0,41,33,0.14);">
          <tr>
            <td style="padding:32px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top; text-align:left;">
                    <p style="margin:0 0 8px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:18px; font-weight:700; color:#ffffff; letter-spacing:-0.2px;">
                      Selfera<span style="color:#00f5c0;">.</span>
                    </p>
                    <p style="margin:0 0 8px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12.5px; color:#a2bdb6;">
                      Automation, with an associate
                    </p>
                    <p style="margin:0 0 3px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12.5px;">
                      <a href="mailto:support@selfera.co.uk" style="color:#00f5c0; text-decoration:none; font-weight:600;">support@selfera.co.uk</a>
                    </p>
                    <p style="margin:0 0 18px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; color:#789890;">
                      London, United Kingdom
                    </p>
                    <p style="margin:0 0 16px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px;">
                      <a href="https://www.selfera.co.uk/privacy-policy" style="color:#a2bdb6; text-decoration:underline;">Privacy</a>
                      <span style="color:#4a6860;"> &middot; </span>
                      <a href="https://www.selfera.co.uk/terms-of-service" style="color:#a2bdb6; text-decoration:underline;">Terms</a>
                    </p>
                    <p style="margin:0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:11px; color:#68867e;">
                      Selfera &copy; 2026. All rights reserved.
                    </p>
                  </td>
                  <!-- TOP RIGHT CORNER LOGO -->
                  <td width="96" style="vertical-align:top; text-align:right; padding-top:2px;">
                    <img src="https://www.selfera.co.uk/logo.png" width="88" height="59" alt="Selfera" style="display:block; width:88px; height:auto; border:0; outline:none; text-decoration:none; margin-left:auto;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- UNSUBSCRIBE / DO-NOT-CONTACT: plain, small, under the footer card -->
    <tr>
      <td class="fluid-padding" style="padding:0 32px 8px 32px; text-align:center;">
        <p style="margin:0 0 6px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.6; color:#86868b;">
          You're receiving this because we thought Selfera could help your business.
        </p>
        <p style="margin:0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.6; color:#86868b;">
          Not interested?
          <a href="{{unsubscribe_url}}" style="color:#002921; text-decoration:underline; font-weight:600;">Unsubscribe</a>
          and we won't email you again.
        </p>
      </td>
    </tr>

  </table>

</div>
</center>

</body>
</html>
`

function loadTemplate(): string {
  return EMAIL_TEMPLATE
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Used when no unsubscribe link can be made (no signing secret)
const UNSUBSCRIBE_MAILTO = 'mailto:support@selfera.co.uk?subject=Unsubscribe&body=Please%20stop%20contacting%20me.'

export function renderEmailTemplate({
  pageTitle,
  preheader,
  body,
  unsubscribeUrl = null,
}: {
  pageTitle: string
  preheader: string
  body: string
  unsubscribeUrl?: string | null
}): string {
  const template = loadTemplate()
  const start = template.indexOf('<!-- CONTENT START')
  const end = template.indexOf('<!-- CONTENT END -->')
  if (start < 0 || end < start) throw new Error('The email template is missing its CONTENT START / CONTENT END markers')

  // Each paragraph gets the style of the template's first sample paragraph
  const paragraphTag = template.slice(template.indexOf('-->', start), end).match(/<p\b[^>]*>/)?.[0] || '<p>'
  // Paragraphs split on blank lines; single line breaks become <br />
  const contentHtml = body
    .trim()
    .split(/\n\s*\n/)
    .map(paragraph => `${paragraphTag}${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('\n')

  return (template.slice(0, start) + contentHtml + template.slice(end + '<!-- CONTENT END -->'.length))
    .replace(/<!--[\s\S]*?-->\n?/g, '')
    .replaceAll('{{title}}', escapeHtml(pageTitle))
    .replaceAll('{{preheader}}', escapeHtml(preheader))
    .replaceAll('{{unsubscribe_url}}', escapeHtml(unsubscribeUrl || UNSUBSCRIBE_MAILTO))
}

// Everything both senders need: the HTML, a plain-text copy, and the
// List-Unsubscribe headers that make Gmail and Outlook show their own
// "Unsubscribe" button (one click, RFC 8058).
function buildMessage(to: string, subject: string, body: string) {
  const link = unsubscribeUrl(to)
  const html = renderEmailTemplate({
    pageTitle: subject,
    preheader: body.replace(/\s+/g, ' ').trim().slice(0, 120),
    body,
    unsubscribeUrl: link,
  })
  const text = link ? `${body}\n\n--\nNot interested? Unsubscribe: ${link}` : body
  const headers: Record<string, string> = link
    ? { 'List-Unsubscribe': `<${link}>, <${UNSUBSCRIBE_MAILTO}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    : { 'List-Unsubscribe': `<${UNSUBSCRIBE_MAILTO}>` }
  return { html, text, headers }
}

export async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}): Promise<{ messageId: string; provider: 'resend' | 'smtp' }> {
  if (isResendConfigured()) return sendWithResend({ to, subject, body })

  const user = process.env.SMTP_USER || 'support@selfera.co.uk'
  const pass = process.env.SMTP_PASS

  if (!pass) {
    throw new Error('SMTP_PASS is not set in .env. Please add your Google App Password for ' + user)
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.SMTP_PORT || '465', 10)
  const secure = process.env.SMTP_SECURE === 'true' || port === 465

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  })

  const { html, text, headers } = buildMessage(to, subject, body)
  const info = await transporter.sendMail({
    from: getFromEmail(),
    to,
    subject,
    text,
    html,
    headers,
  })

  return { messageId: info.messageId, provider: 'smtp' }
}

async function sendWithResend({ to, subject, body }: { to: string; subject: string; body: string }) {
  // The From address must be on a domain verified in Resend. Replies go to the
  // mailbox the IMAP sync reads, so reply matching keeps working.
  const fromName = process.env.EMAIL_FROM_NAME || 'Selfera'
  const fromAddress = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SMTP_USER || 'support@selfera.co.uk'
  const replyTo = process.env.EMAIL_REPLY_TO || process.env.SMTP_USER

  const { html, text, headers } = buildMessage(to, subject, body)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${fromName} <${fromAddress}>`,
      to: [to],
      subject,
      text,
      html,
      headers,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = `Resend: ${json?.message || `HTTP ${res.status}`}`
    // 4xx (bad address, unverified domain) won't succeed on retry; 429 and 5xx might
    if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new PermanentEmailError(message)
    throw new Error(message)
  }
  return { messageId: String(json.id), provider: 'resend' as const }
}
