export type ChannelId = 'whatsapp' | 'email' | 'instagram' | 'facebook' | 'linkedin'
export type IntegrationEnvironment = 'realtime' | 'sandbox'

export interface ChannelField {
  key: string
  label: string
  type: 'text' | 'password' | 'select'
  placeholder?: string
  options?: { label: string; value: string }[]
  required?: boolean
}

export interface ChannelIntegration {
  id: ChannelId
  name: string
  provider: string
  accountInfo: string
  status: 'connected' | 'disconnected'
  environment?: IntegrationEnvironment
  webhookUrl?: string
  config: Record<string, any>
  fields: ChannelField[]
}
