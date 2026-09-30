import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ServiceView } from '@/components/v2/ServiceView'

export const dynamic = 'force-dynamic'

export default async function Page({
  params
}: {
  params: Promise<{ service: string }>
}) {
  const { service } = await params
  const decodedService = decodeURIComponent(service)

  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: counts } = await supabase
    .rpc('v_business_type_counts', { 
      p_service: decodedService, 
      p_user: user.id 
    })

  return <ServiceView service={decodedService} counts={counts || []} />
}
