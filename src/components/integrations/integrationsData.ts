import type { ChannelIntegration } from './types'

export const CHANNELS: ChannelIntegration[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    provider: 'Meta Cloud API',
    accountInfo: 'Not configured',
    status: 'disconnected',
    webhookUrl: '/api/whatsapp/webhook',
    config: {
      default_template_name: 'selfera_sales_pipeline_general',
      templates: ['selfera_sales_pipeline_general'],
    },
    fields: [
      { key: 'phone_number_id', label: 'Phone Number ID', type: 'text', placeholder: 'Enter Phone Number ID' },
      { key: 'waba_id', label: 'Business Account ID (WABA)', type: 'text', placeholder: 'Optional WABA ID' },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Permanent System User Token' },
      { key: 'verify_token', label: 'Verify Token', type: 'text', placeholder: 'Webhook Verify Token' },
      { key: 'app_secret', label: 'App Secret', type: 'password', placeholder: 'Meta App Secret' },
    ],
  },
  {
    id: 'email',
    name: 'Email',
    provider: 'Resend / SMTP & IMAP',
    accountInfo: 'Not configured',
    status: 'disconnected',
    webhookUrl: '/api/email/webhook',
    config: {
      provider: 'smtp',
    },
    fields: [
      {
        key: 'provider',
        label: 'Provider Route',
        type: 'select',
        options: [
          { label: 'SMTP & IMAP (Send & Inbound Reply Tracking)', value: 'smtp' },
          { label: 'Resend API (Cloud Gateway)', value: 'resend' },
        ],
      },
      // Resend fields
      { key: 'resend_api_key', label: 'Resend API Key', type: 'password', placeholder: 're_••••••••' },
      { key: 'resend_webhook_secret', label: 'Resend Webhook Secret (Optional)', type: 'password', placeholder: 'whsec_••••••••' },

      // Outbound SMTP fields
      { key: 'smtp_host', label: 'SMTP Host (Outgoing Send)', type: 'text', placeholder: 'e.g. smtp.gmail.com' },
      { key: 'smtp_port', label: 'SMTP Port', type: 'text', placeholder: '465 (SSL) or 587 (TLS)' },
      { key: 'smtp_user', label: 'SMTP Username', type: 'text', placeholder: 'e.g. user@yourdomain.com' },
      { key: 'smtp_pass', label: 'SMTP Password / App Password', type: 'password', placeholder: '••••••••' },

      // Inbound IMAP fields
      { key: 'imap_host', label: 'IMAP Host (Incoming Reply Tracking)', type: 'text', placeholder: 'e.g. imap.gmail.com' },
      { key: 'imap_port', label: 'IMAP Port', type: 'text', placeholder: '993 (SSL)' },
      { key: 'imap_user', label: 'IMAP Username', type: 'text', placeholder: 'Defaults to SMTP user if empty' },
      { key: 'imap_pass', label: 'IMAP Password', type: 'password', placeholder: 'Defaults to SMTP pass if empty' },

      // Common sender fields
      { key: 'from_name', label: 'From Display Name', type: 'text', placeholder: 'e.g. Sales Team' },
      { key: 'from_email', label: 'From Email Address', type: 'text', placeholder: 'e.g. outreach@yourdomain.com' },
      { key: 'reply_to', label: 'Reply-To Email Address (Monitored Mailbox)', type: 'text', placeholder: 'e.g. support@yourdomain.com' },
    ],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    provider: 'Direct Messaging',
    accountInfo: 'Not configured',
    status: 'disconnected',
    webhookUrl: '/api/instagram/webhook',
    config: {},
    fields: [
      { key: 'username', label: 'Username', type: 'text', placeholder: 'e.g. @yourbusiness' },
      { key: 'account_id', label: 'Account ID', type: 'text', placeholder: 'Instagram Professional Account ID' },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: '••••••••' },
    ],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    provider: 'Messenger & Pages',
    accountInfo: 'Not configured',
    status: 'disconnected',
    webhookUrl: '/api/facebook/webhook',
    config: {},
    fields: [
      { key: 'page_name', label: 'Page Name', type: 'text', placeholder: 'e.g. Your Business Page' },
      { key: 'page_id', label: 'Page ID', type: 'text', placeholder: 'Facebook Page ID' },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: '••••••••' },
    ],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    provider: 'Messaging API',
    accountInfo: 'Not configured',
    status: 'disconnected',
    config: {},
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'Client ID' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••' },
    ],
  },
]
