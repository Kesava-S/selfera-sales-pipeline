import { createClient } from '@/lib/supabase/server'
import { FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const supabase = await createClient()

  const { data: templates, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error(error)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1>Message Templates</h1>
      </div>

      <div className="grid grid-cols-2">
        {!templates || templates.length === 0 ? (
          <div className="card text-center" style={{ gridColumn: 'span 2', padding: '3rem' }}>
            <p className="text-muted mb-0">No templates found.</p>
          </div>
        ) : (
          templates.map((template: any) => (
            <div key={template.id} className="card card-hover">
              <div className="flex items-center gap-3 mb-4">
                <div className="avatar" style={{ backgroundColor: 'rgba(92, 111, 255, 0.15)', color: 'var(--primary)' }}>
                  <FileText size={16} />
                </div>
                <h3 className="font-semibold">{template.name}</h3>
              </div>
              
              <div className="mb-4">
                <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Subject</div>
                <div className="font-semibold" style={{ fontSize: '0.875rem' }}>{template.subject || 'N/A'}</div>
              </div>

              <div>
                <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Body</div>
                <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', backgroundColor: 'var(--background)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                  {template.body}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
