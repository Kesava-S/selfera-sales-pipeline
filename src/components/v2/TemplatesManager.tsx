'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function TemplatesManager({ initialTemplates }: { initialTemplates: any[] }) {
  const router = useRouter()
  const [templates, setTemplates] = useState(initialTemplates)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({ name: '', subject: '', body: '' })

  const handleEdit = (t: any) => {
    setEditingId(t.id)
    setFormData({ name: t.name, subject: t.subject || '', body: t.body })
    setIsCreating(false)
  }

  const handleCancel = () => {
    setEditingId(null)
    setIsCreating(false)
    setFormData({ name: '', subject: '', body: '' })
  }

  const handleSave = async () => {
    try {
      const method = isCreating ? 'POST' : 'PUT'
      const url = isCreating ? '/api/templates' : `/api/templates/${editingId}`
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!res.ok) throw new Error('Failed to save template')
      
      // We rely on router.refresh() to update data from server
      setEditingId(null)
      setIsCreating(false)
      setFormData({ name: '', subject: '', body: '' })
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Error saving template')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Error deleting template')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-semibold text-2xl">Message Templates</h1>
        <button 
          onClick={() => { setIsCreating(true); setEditingId(null); setFormData({ name: '', subject: '', body: '' }) }}
          className="btn btn-primary"
        >
          <Plus size={16} className="mr-2" /> New Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isCreating && (
          <div className="card border-blue-500 shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">New Template</h3>
              <button onClick={handleCancel} className="text-muted hover:text-foreground"><X size={16}/></button>
            </div>
            <input 
              type="text" 
              placeholder="Template Name" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              className="input w-full mb-3 font-medium"
            />
            <input 
              type="text" 
              placeholder="Subject (Optional for Email)" 
              value={formData.subject} 
              onChange={e => setFormData({...formData, subject: e.target.value})} 
              className="input w-full mb-3 text-sm"
            />
            <textarea 
              placeholder="Message body..." 
              value={formData.body} 
              onChange={e => setFormData({...formData, body: e.target.value})} 
              className="input w-full mb-4 text-sm min-h-[150px] resize-y"
            />
            <div className="flex justify-end gap-2">
              <button onClick={handleCancel} className="btn btn-outline btn-sm">Cancel</button>
              <button onClick={handleSave} disabled={!formData.name || !formData.body} className="btn btn-primary btn-sm">
                <Save size={14} className="mr-2" /> Save
              </button>
            </div>
          </div>
        )}

        {templates.map(t => (
          editingId === t.id ? (
            <div key={t.id} className="card border-blue-500 shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">Edit Template</h3>
                <button onClick={handleCancel} className="text-muted hover:text-foreground"><X size={16}/></button>
              </div>
              <input 
                type="text" 
                placeholder="Template Name" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                className="input w-full mb-3 font-medium"
              />
              <input 
                type="text" 
                placeholder="Subject (Optional for Email)" 
                value={formData.subject} 
                onChange={e => setFormData({...formData, subject: e.target.value})} 
                className="input w-full mb-3 text-sm"
              />
              <textarea 
                placeholder="Message body..." 
                value={formData.body} 
                onChange={e => setFormData({...formData, body: e.target.value})} 
                className="input w-full mb-4 text-sm min-h-[150px] resize-y"
              />
              <div className="flex justify-end gap-2">
                <button onClick={handleCancel} className="btn btn-outline btn-sm">Cancel</button>
                <button onClick={handleSave} disabled={!formData.name || !formData.body} className="btn btn-primary btn-sm">
                  <Save size={14} className="mr-2" /> Save
                </button>
              </div>
            </div>
          ) : (
            <div key={t.id} className="card flex flex-col justify-between group hover:border-[var(--accent)] hover:shadow-md transition-all">
              <div>
                <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                  <h3 className="font-semibold text-lg line-clamp-1">{t.name}</h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(t)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded bg-slate-50">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded bg-slate-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {t.subject && (
                  <div className="text-sm font-medium mb-2 opacity-80 border-l-2 border-slate-200 pl-2 line-clamp-1">
                    Subj: {t.subject}
                  </div>
                )}
                <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap line-clamp-5">
                  {t.body}
                </div>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}
