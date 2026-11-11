import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { ChannelDetailView } from '@/components/integrations/ChannelDetailView'
import { getDynamicChannels } from '@/lib/integrations'
import type { ChannelId } from '@/components/integrations/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

const VALID_CHANNELS: ChannelId[] = ['whatsapp', 'email', 'instagram', 'facebook', 'linkedin']

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const name = id.charAt(0).toUpperCase() + id.slice(1)
  return {
    title: `${name} Integration | Selfera Sales Pipeline`,
    description: `Configure and test ${name} integration for sandbox and realtime environments.`,
  }
}

export default async function ChannelIntegrationPage({ params }: Props) {
  const { id } = await params
  if (!VALID_CHANNELS.includes(id as ChannelId)) {
    notFound()
  }

  const { profile } = await requireProfile()
  if (!profile) return null

  const channels = await getDynamicChannels()
  const channel = channels.find(c => c.id === id)
  if (!channel) notFound()

  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Integrations', href: '/dashboard/integrations' },
          { label: channel.name },
        ]}
      />
      <ChannelDetailView channel={channel} isAdmin={profile.role === 'admin'} />
    </>
  )
}

