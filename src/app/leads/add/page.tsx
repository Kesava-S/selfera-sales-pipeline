import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AddLeadPage() {
  async function createLead(formData: FormData) {
    'use server'
    
    const supabase = await createClient()
    
    const data = {
      business_name: formData.get('business_name'),
      email: formData.get('email') || null,
      channel: formData.get('channel'),
      stage: 'New',
      next_follow_up: new Date().toISOString().split('T')[0] // today
    }
    
    const { error } = await supabase.from('leads').insert([data])
    
    if (error) {
      console.error('Error creating lead:', error)
      // Basic error handling for now
      return
    }
    
    redirect('/leads')
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/leads" className="text-muted" style={{ display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 className="mb-0">Add New Lead</h1>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <form action={createLead}>
          <div className="input-group">
            <label htmlFor="business_name" className="input-label">Business Name *</label>
            <input 
              type="text" 
              id="business_name" 
              name="business_name" 
              required 
              className="input-field" 
              placeholder="e.g. Acme Corp"
            />
          </div>

          <div className="input-group">
            <label htmlFor="email" className="input-label">Email Address</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              className="input-field" 
              placeholder="contact@acme.com"
            />
          </div>

          <div className="input-group">
            <label htmlFor="channel" className="input-label">Primary Channel *</label>
            <select id="channel" name="channel" required className="input-field">
              <option value="Email">Email</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Instagram">Instagram</option>
              <option value="Phone">Phone</option>
              <option value="Walk-in">Walk-in</option>
            </select>
          </div>

          <div className="mt-6 flex gap-4">
            <button type="submit" className="btn btn-primary">Create Lead</button>
            <Link href="/leads" className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
