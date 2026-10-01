import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeadsManagement } from '@/components/v2/LeadsManagement'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ page?: string, search?: string, filter?: string }>
}) {
  const { page = '1', search = '', filter = 'all' } = await searchParams
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = roleData?.role || 'sales'

  // Build the query
  let query = supabase
    .from('opportunities')
    .select(`
      id,
      stage,
      services_pitched,
      businesses!inner (
        id,
        business_name,
        business_type,
        contact_name,
        email_address,
        phone_number,
        instagram_handle
      )
    `, { count: 'exact' })
    
  if (role !== 'admin') {
    query = query.or(`assigned_sales_id.eq.${user.id},assigned_consultant_id.eq.${user.id}`)
  }

  if (search) {
    query = query.ilike('businesses.business_name', `%${search}%`)
  }

  if (filter !== 'all') {
    query = query.eq('stage', filter)
  }

  // Pagination
  const pageSize = 20
  const currentPage = parseInt(page)
  const from = (currentPage - 1) * pageSize
  const to = from + pageSize - 1

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Lead Management' }
      ]} />
      <LeadsManagement 
        opportunities={data as any || []} 
        totalCount={count || 0}
        currentPage={currentPage}
        pageSize={pageSize}
        search={search}
        filter={filter}
        isAdmin={role === 'admin'}
      />
    </>
  )
}
