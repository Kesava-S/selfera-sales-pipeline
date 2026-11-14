import { describe, expect, it, vi } from 'vitest'
import { updateBusinessCategory, deleteBusinessCategory } from '@/app/dashboard/actions'

describe('Business Category Actions Validation', () => {
  it('rejects updating category with an empty name', async () => {
    const res = await updateBusinessCategory({
      oldName: 'Dental',
      name: '   ',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('Category name is required.')
    }
  })

  it('protects the General baseline category from modification', async () => {
    const res = await updateBusinessCategory({
      oldName: 'General',
      name: 'All Businesses',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('The General baseline category cannot be modified.')
    }
  })

  it('rejects deleting category with an empty name', async () => {
    const res = await deleteBusinessCategory({
      name: '   ',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('Category name is required.')
    }
  })

  it('protects the General baseline category from deletion', async () => {
    const res = await deleteBusinessCategory({
      name: 'General',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('The General baseline category cannot be deleted.')
    }
  })
})
