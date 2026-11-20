import { describe, it, expect, vi } from 'vitest'
import { sendAdminNotification } from '@/lib/adminNotifications'

const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
const mockSchema = vi.fn().mockReturnValue({ from: mockFrom })

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    schema: mockSchema,
  }),
}))

describe('sendAdminNotification (src/lib/adminNotifications.ts)', () => {
  it('sets title as product name (Sales Pipeline) and preserves detail in message', async () => {
    mockInsert.mockClear()
    const res = await sendAdminNotification({
      title: 'Lead assigned: Apex Dental Clinic',
      message: 'New enquiry received from website',
      type: 'action_required',
      employeeId: 25,
      link: '/dashboard/lead-123',
    })

    expect(res.ok).toBe(true)
    expect(mockSchema).toHaveBeenCalledWith('shared')
    expect(mockFrom).toHaveBeenCalledWith('product_notifications')
    expect(mockInsert).toHaveBeenCalledWith({
      product_code: 'sales_pipeline',
      title: 'Sales Pipeline',
      message: 'Lead assigned: Apex Dental Clinic - New enquiry received from website',
      type: 'action_required',
      employee_id: 25,
      metadata: {
        channel: 'in_app',
        link: '/dashboard/lead-123',
        original_title: 'Lead assigned: Apex Dental Clinic',
      },
    })
  })

  it('uses Sales Pipeline as default title and message if only message is passed', async () => {
    mockInsert.mockClear()
    const res = await sendAdminNotification({
      message: 'System daily sync complete',
    })

    expect(res.ok).toBe(true)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        product_code: 'sales_pipeline',
        title: 'Sales Pipeline',
        message: 'System daily sync complete',
      })
    )
  })
})
