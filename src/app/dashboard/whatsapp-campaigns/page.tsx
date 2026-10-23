import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import {
  WhatsAppCampaignsView,
  type WhatsAppCampaignRow,
  type WhatsAppDatabaseRow,
  type PipelineLead,
  type WhatsAppTemplate,
} from '@/components/v2/WhatsAppCampaignsView'
import { ErrorNote } from '@/components/ui'
import { isWhatsAppConfigured } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export default async function WhatsAppCampaignsPage() {
  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  // 1. Fetch WhatsApp campaigns
  const { data: campaignRows, error: campaignError } = await supabase
    .from('whatsapp_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  // 2. Fetch custom WhatsApp databases
  const { data: databaseRows, error: databaseError } = await supabase
    .from('whatsapp_databases')
    .select('*')
    .order('created_at', { ascending: false })

  // 3. Fetch all pipeline businesses with WhatsApp / phone numbers
  const { data: leadRows, error: leadsError } = await supabase
    .from('businesses')
    .select('id, business_name, contact_name, whatsapp_number, category, business_type')
    .not('whatsapp_number', 'is', null)
    .neq('whatsapp_number', '')
    .order('business_name')

  // 4. Fetch WhatsApp templates
  const { data: templateRows } = await supabase
    .from('templates')
    .select('id, name, body, whatsapp_template_name')
    .in('platform', ['WhatsApp', 'All'])
    .order('name')

  const parsedCampaigns: WhatsAppCampaignRow[] = (campaignRows || []).map((c: any) => ({
    ...c,
    recipients: Array.isArray(c.recipients)
      ? c.recipients
      : typeof c.recipients === 'string'
        ? JSON.parse(c.recipients)
        : [],
  }))

  const parsedDatabases: WhatsAppDatabaseRow[] = (databaseRows || []).map((d: any) => ({
    ...d,
    contacts: Array.isArray(d.contacts)
      ? d.contacts
      : typeof d.contacts === 'string'
        ? JSON.parse(d.contacts)
        : [],
  }))

  const pipelineLeads: PipelineLead[] = (leadRows || []) as PipelineLead[]
  const templates: WhatsAppTemplate[] = (templateRows || []) as WhatsAppTemplate[]

  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'WhatsApp Campaigns' },
        ]}
      />
      {campaignError ? (
        <ErrorNote error={campaignError.message} />
      ) : databaseError ? (
        <ErrorNote error={databaseError.message} />
      ) : leadsError ? (
        <ErrorNote error={leadsError.message} />
      ) : (
        <WhatsAppCampaignsView
          campaigns={parsedCampaigns}
          databases={parsedDatabases}
          pipelineLeads={pipelineLeads}
          templates={templates}
          isApiConfigured={isWhatsAppConfigured()}
        />
      )}
    </>
  )
}
