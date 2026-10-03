import nodemailer from 'nodemailer'

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_PASS)
}

export function getFromEmail(): string {
  const fromName = process.env.EMAIL_FROM_NAME || 'Selfera Support'
  const fromAddress = process.env.SMTP_USER || process.env.EMAIL_FROM || 'support@selfera.co.uk'
  return `"${fromName}" <${fromAddress}>`
}

function formatBodyHtml(body: string): string {
  // Split into clean paragraphs by double newlines, preserving single linebreaks as <br />
  return body
    .trim()
    .split(/\n\s*\n/)
    .map(paragraph => {
      const formatted = paragraph.replace(/\n/g, '<br />')
      return `<p style="margin:0 0 16px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; line-height:1.65; color:#1d1d1f;">${formatted}</p>`
    })
    .join('\n')
}

export function renderEmailTemplate({
  pageTitle,
  preheader,
  body,
}: {
  pageTitle: string
  preheader: string
  body: string
}): string {
  const contentHtml = formatBodyHtml(body)
  const escapedTitle = pageTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const escapedPreheader = preheader.replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapedTitle}</title>
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
  ${escapedPreheader}
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
        ${contentHtml}
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

  </table>

</div>
</center>

</body>
</html>`
}

export async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}): Promise<{ messageId: string }> {
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

  // Generate preview preheader from body text
  const cleanPreheader = body.replace(/\s+/g, ' ').trim().slice(0, 120)

  // Render branded executive HTML template
  const html = renderEmailTemplate({
    pageTitle: subject,
    preheader: cleanPreheader,
    body,
  })

  const info = await transporter.sendMail({
    from: getFromEmail(),
    to,
    subject,
    text: body,
    html,
  })

  return { messageId: info.messageId }
}
