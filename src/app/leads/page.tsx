import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlusCircle, Search, Upload } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const supabase = await createClient()

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1>All Leads</h1>
        <div className="flex gap-3">
          <Link href="/leads/import" className="btn btn-secondary">
            <Upload size={18} />
            Import
          </Link>
          <Link href="/leads/add" className="btn btn-primary">
            <PlusCircle size={18} />
            New Lead
          </Link>
        </div>
      </div>

      <div className="card mb-6 flex items-center gap-2">
        <Search size={20} className="text-muted" />
        <input 
          type="text" 
          placeholder="Search leads by name, email, or channel..." 
          className="input-field"
          style={{ border: 'none', padding: 0, boxShadow: 'none', backgroundColor: 'transparent' }}
        />
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Business Name</th>
              <th>Channel</th>
              <th>Stage</th>
              <th>Follow Ups</th>
              <th>Next Action</th>
            </tr>
          </thead>
          <tbody>
            {!leads || leads.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-muted" style={{ padding: '2rem' }}>
                  No leads found. Create your first lead to get started.
                </td>
              </tr>
            ) : (
              leads.map((lead: any) => (
                <tr key={lead.id} style={{ cursor: 'pointer' }}>
                  <td>
                    <Link href={`/leads/${lead.id}`} style={{ display: 'block', fontWeight: 500, color: 'var(--foreground)' }}>
                      {lead.business_name}
                      {lead.email && <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 400 }}>{lead.email}</div>}
                    </Link>
                  </td>
                  <td>{lead.channel}</td>
                  <td>
                    <span className={`badge badge-stage-${lead.stage.replace(/\s+/g, '')}`}>
                      {lead.stage}
                    </span>
                  </td>
                  <td>
                    {lead.follow_up_count > 0 ? (
                      <span className="badge badge-neutral">{lead.follow_up_count}</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    {lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleDateString() : <span className="text-muted">None</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
