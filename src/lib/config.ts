export const CONFIG = {
  // Capacity defaults
  DEFAULT_SALES_CAPACITY: 150,

  // Cadence rules (working days)
  CADENCE: {
    STEP_1_TO_2_DAYS: 3,
    STEP_2_TO_3_DAYS: 5,
    STEP_3_TO_FINAL_DAYS: 14,
    FINAL_TO_NO_REPLY_DAYS: 14,
  },

  // Platform limits
  REPLY_WINDOW_HOURS: {
    whatsapp: 24,
    instagram: 24, // up to 7 days if human agent enabled, keeping safe default
    facebook: 24,
  },

  // Lists
  SERVICES: [
    'Website',
    'Micro Automation',
    'End-to-End Automation',
    'Custom Dashboard',
    'Cold Outreach'
  ] as const,

  PLATFORMS: [
    'WhatsApp',
    'Instagram',
    'Facebook',
    'Email',
    'Phone',
    'Walk-in'
  ] as const,

  BUSINESS_CATEGORIES: {
    'Food & Drink': [
      'Cafe', 'Restaurant', 'Bakery', 'Takeaway', 'Pub / Bar'
    ],
    'Accommodation': [
      'Hotel', 'Boutique hotel', 'B&B / Guesthouse', 'Short-let / Airbnb host', 'Serviced apartments', 'Hostel'
    ],
    'Beauty & Wellness': [
      'Hair salon', 'Barber', 'Beauty, Nails & Lashes', 'Medical aesthetics', 'Spa', 'Fitness / Training studio'
    ],
    'Retail & Other': [
      'Fashion boutique', 'Florist', 'Other'
    ]
  },
  
  TIERS: ['1-2 star', '3 star', '4-5 star'] as const,
  COMPANY_TYPES: ['Limited company', 'Sole trader', 'Partnership', 'Unknown'] as const,
}

export type Service = typeof CONFIG.SERVICES[number]
export type Platform = typeof CONFIG.PLATFORMS[number]
