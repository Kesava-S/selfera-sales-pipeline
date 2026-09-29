export type ChannelType = 'Email' | 'WhatsApp' | 'Instagram' | 'Phone' | 'Walk-in'

export type StageType =
  | 'New'
  | 'Contacted'
  | 'Replied'
  | 'Interested'
  | 'Won'
  | 'Lost'
  | 'Do not contact'

export interface Lead {
  id: string
  lead_code?: string | null
  business_name: string
  email: string | null
  channel: ChannelType
  stage: StageType
  follow_up_count: number
  next_follow_up: string | null
  assigned_to: string | null
  created_at: string
}

export interface ExtendedLead extends Lead {
  phone?: string
  instagram_handle?: string
  company_type?: 'limited' | 'sole_trader'
}

export interface Task {
  id: string
  title: string
  description: string | null
  assigned_to: string | null
  due_date: string | null
  status: string
  task_type: string
  lead_id: string | null
  leads?: {
    id?: string
    lead_code?: string | null
    business_name: string
    channel: ChannelType
    phone?: string | null
    email?: string | null
    instagram_handle?: string | null
    stage?: StageType
  } | null
}

export interface ExtendedTask extends Task {
  phone?: string
  instagram_handle?: string
  channel?: string
  email?: string
}

export interface ActivityLog {
  id: string
  lead_id: string
  action_type: 'sent' | 'received' | 'note' | 'system'
  details: string | null
  created_at: string
  created_by: string | null
}

export type TemplateChannel = 'All' | 'WhatsApp' | 'Instagram' | 'SMS' | 'Facebook' | 'Email'

export type CadenceStep = 0 | 1 | 2 | 3

export interface Template {
  id: string
  name: string
  subject: string | null
  body: string
  channel?: TemplateChannel | string | null
  step?: CadenceStep | null
  created_at: string
}

export interface CSVLeadRow {
  business_name: string
  email?: string
  channel?: ChannelType
}

export interface AppLog {
  id: string
  event: string
  category: string
  details: Record<string, unknown> | null
  created_at: string
}

export interface UserLog {
  id: string
  user_id: string | null
  user_name: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface ErrorLog {
  id: string
  error_message: string
  error_stack: string | null
  context: string | null
  user_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}


