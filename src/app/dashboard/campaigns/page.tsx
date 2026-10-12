import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import {
  EmailCampaignsView,
  type CampaignRow,
  type EmailDatabaseRow,
  type PipelineLead,
  type EmailTemplate,
} from '@/components/v2/EmailCampaignsView'
import { ErrorNote } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const { supabase, profile, user } = await requireProfile()
  if (!profile) return null

  // 1. Fetch campaigns
  const { data: campaignRows, error: campaignError } = await supabase
    .from('email_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  // 2. Fetch custom email databases
  const { data: databaseRows, error: databaseError } = await supabase
    .from('email_databases')
    .select('*')
    .order('created_at', { ascending: false })

  // 3. Fetch all pipeline businesses with email (for populating databases)
  const { data: leadRows, error: leadsError } = await supabase
    .from('businesses')
    .select('id, business_name, contact_name, email, category, business_type')
    .not('email', 'is', null)
    .neq('email', '')
    .order('business_name')

  // 4. Fetch email templates
  const { data: templateRows } = await supabase
    .from('templates')
    .select('id, name, subject, body, step')
    .in('platform', ['Email', 'All'])
    .order('name')

  const parsedCampaigns: CampaignRow[] = (campaignRows || []).map((c: any) => ({
    ...c,
    recipients: Array.isArray(c.recipients)
      ? c.recipients
      : typeof c.recipients === 'string'
        ? JSON.parse(c.recipients)
        : [],
  }))

  const parsedDatabases: EmailDatabaseRow[] = (databaseRows || []).map((d: any) => ({
    ...d,
    contacts: Array.isArray(d.contacts)
      ? d.contacts
      : typeof d.contacts === 'string'
        ? JSON.parse(d.contacts)
        : [],
  }))

  const pipelineLeads: PipelineLead[] = (leadRows || []) as PipelineLead[]
  const templates: EmailTemplate[] = (templateRows || []) as EmailTemplate[]

  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Email Campaigns' },
        ]}
      />
      {campaignError ? (
        <ErrorNote error={campaignError.message} />
      ) : databaseError ? (
        <ErrorNote error={databaseError.message} />
      ) : leadsError ? (
        <ErrorNote error={leadsError.message} />
      ) : (
        <EmailCampaignsView
          campaigns={parsedCampaigns}
          databases={parsedDatabases}
          pipelineLeads={pipelineLeads}
          templates={templates}
          userEmail={user.email || ''}
        />
      )}
    </>
  )
}
