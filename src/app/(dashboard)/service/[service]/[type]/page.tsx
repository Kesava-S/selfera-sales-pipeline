import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BusinessList } from '@/components/v2/BusinessList'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
  searchParams
}: {
  params: Promise<{ service: string, type: string }>
  searchParams: Promise<{ page?: string, search?: string, filter?: string }>
}) {
  const { service, type } = await params
  const { page = '1', search = '', filter = 'all' } = await searchParams
  
  const decodedService = decodeURIComponent(service)
  const decodedType = decodeURIComponent(type)
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = roleData?.role || 'sales'

  // Build the query
  // We want to fetch opportunities that match the service, joined with businesses of the specified type
  let query = supabase
    .from('opportunities')
    .select(`
      id,
      stage,
      services_pitched,
      assigned_sales_id,
      assigned_consultant_id,
      businesses!inner (
        id,
        business_name,
        business_type,
        area,
        google_rating
      ),
      threads (
        id,
        platform,
        status,
        step,
        next_due_on
      )
    `, { count: 'exact' })
    .contains('services_pitched', [decodedService])
    .eq('businesses.business_type', decodedType)
    
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
    <BusinessList 
      service={decodedService} 
      type={decodedType} 
      opportunities={data || []} 
      totalCount={count || 0}
      currentPage={currentPage}
      pageSize={pageSize}
      search={search}
      filter={filter}
    />
  )
}
