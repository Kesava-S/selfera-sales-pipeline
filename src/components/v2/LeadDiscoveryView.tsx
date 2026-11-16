'use client'

import React, { useMemo } from 'react'
import {
  Compass,
  Search,
  MapPin,
  Phone,
  Mail,
  Star,
  Square,
  Radio,
  Zap,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import type { ListCategory } from '@/lib/lists'
import type { DiscoveredProspect } from '@/app/dashboard/discovery/actions'

const CITIES = [
  'All Cities',
  'London',
  'Manchester',
  'Birmingham',
  'Leeds',
  'Edinburgh',
  'Bristol',
]

const SAMPLE_PROSPECTS: DiscoveredProspect[] = [
  {
    id: 'disc-1',
    business_name: 'The Crown & Thistle Boutique Inn',
    category: 'Hotel',
    business_type: 'Hotel',
    area: 'Edinburgh',
    address: '14 Claremont Crescent',
    postcode: 'EH7 4HX',
    phone: '+44 131 496 0321',
    whatsapp_number: '+447700900321',
    email: 'stay@crownandthistle.co.uk',
    existing_website: null,
    has_no_website: true,
    maps_link: 'https://maps.google.com/?q=The+Crown+Thistle+Edinburgh',
    google_rating: 4.6,
    google_reviews_count: 142,
    contact_name: 'Euan MacIntyre',
    opportunity_signal: 'No website detected',
    opportunity_pitch: 'Pitches Direct Booking Portal to eliminate 18% OTA commission.',
    source_provider: 'Google Places API',
  },
  {
    id: 'disc-2',
    business_name: 'Maison Gourmet Brasserie',
    category: 'Restaurant',
    business_type: 'Restaurant',
    area: 'London',
    address: '42 Marylebone High Street',
    postcode: 'W1U 5HD',
    phone: '+44 20 7946 0882',
    whatsapp_number: '+447700900882',
    email: 'info@maisongourmet.co.uk',
    existing_website: 'https://www.maisongourmet.co.uk',
    has_no_website: false,
    maps_link: 'https://maps.google.com/?q=Maison+Gourmet+London',
    google_rating: 4.8,
    google_reviews_count: 310,
    contact_name: 'Sophie Laurent',
    opportunity_signal: 'Missing automated table reservation system',
    opportunity_pitch: 'Pitches automated WhatsApp table booking agent and review accelerator.',
    source_provider: 'Google Places API',
  },
  {
    id: 'disc-3',
    business_name: 'Iron & Oak Strength Club',
    category: 'Gym',
    business_type: 'Gym',
    area: 'Manchester',
    address: '88 Deansgate',
    postcode: 'M3 2ER',
    phone: '+44 161 496 0419',
    whatsapp_number: '+447700900419',
    email: 'membership@ironandoakgym.com',
    existing_website: null,
    has_no_website: true,
    maps_link: 'https://maps.google.com/?q=Iron+Oak+Manchester',
    google_rating: 4.9,
    google_reviews_count: 185,
    contact_name: 'Marcus Vance',
    opportunity_signal: 'No direct sign-up funnel',
    opportunity_pitch: 'Pitches online membership onboarding and automated free trial booking.',
    source_provider: 'Local Directory Scraper',
  },
  {
    id: 'disc-4',
    business_name: 'Luxe Aesthetics & Skin Clinic',
    category: 'Salon',
    business_type: 'Salon',
    area: 'Birmingham',
    address: '12 Colmore Row',
    postcode: 'B3 2QD',
    phone: '+44 121 496 0773',
    whatsapp_number: '+447700900773',
    email: 'appointments@luxeaesthetics.co.uk',
    existing_website: 'https://www.luxeaesthetics.co.uk',
    has_no_website: false,
    maps_link: 'https://maps.google.com/?q=Luxe+Aesthetics+Birmingham',
    google_rating: 4.7,
    google_reviews_count: 88,
    contact_name: 'Dr. Chloe Wright',
    opportunity_signal: 'Manual appointment booking only',
    opportunity_pitch: 'Pitches 24/7 WhatsApp consultation scheduler and deposit collection.',
    source_provider: 'Google Places API',
  },
]

interface LeadDiscoveryViewProps {
  categories: ListCategory[]
  services: string[]
  existingBusinessCount: number
}

export function LeadDiscoveryView({
  categories,
  existingBusinessCount,
}: LeadDiscoveryViewProps) {
  const availableCategories = useMemo(() => {
    const fromProps = categories.map((c) => c.name)
    const combined = Array.from(new Set([...fromProps, 'Hotel', 'Restaurant', 'Cafe', 'Gym', 'Salon']))
    return ['All Categories', ...combined]
  }, [categories])

  return (
    <div className="relative -mx-4 sm:-mx-6 -mt-6 -mb-8 min-h-[calc(100dvh-58px)] overflow-hidden">
      {/* Blurred, Non-Accessible Page Background */}
      <div
        className="pointer-events-none select-none filter blur-[8px] opacity-30 p-4 sm:p-6 space-y-6"
        aria-hidden="true"
        tabIndex={-1}
      >
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lead Discovery</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Automated prospect sourcing and local business directory scraping engine.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500">Pipeline Leads: </span>
              <span className="text-sm font-bold text-slate-900">{existingBusinessCount}</span>
            </div>
          </div>
        </div>

        {/* 3 Value Highlights */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
              <Radio size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">Live Web & Maps Scraping</div>
              <div className="text-[11px] text-slate-500">Extracts local businesses and contact info across target cities.</div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Zap size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">Automation Gap Detection</div>
              <div className="text-[11px] text-slate-500">Identifies missing websites, low ratings, and booking friction.</div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">1-Click Pipeline Sync</div>
              <div className="text-[11px] text-slate-500">Pushes qualified prospects straight into your Needs Review stage.</div>
            </div>
          </div>
        </div>

        {/* Preview Search Bar & Table */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-bold text-slate-900">Prospect Directory Sandbox</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  readOnly
                  placeholder="Search business..."
                  className="h-9 w-44 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800"
                />
              </div>
              <select disabled className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700">
                {availableCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select disabled className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700">
                {CITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/70 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <Square size={16} className="text-slate-400" />
                <span>Select All ({SAMPLE_PROSPECTS.length})</span>
              </div>
              <div className="text-xs text-slate-500">Showing {SAMPLE_PROSPECTS.length} prospects</div>
            </div>

            <div className="divide-y divide-slate-100">
              {SAMPLE_PROSPECTS.map((p) => (
                <div key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Square size={16} className="mt-0.5 text-slate-300" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">{p.business_name}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {p.category}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <MapPin size={12} className="text-slate-400" />
                          {p.area}, {p.postcode}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        {p.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone size={12} className="text-slate-400" />
                            {p.phone}
                          </span>
                        )}
                        {p.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail size={12} className="text-slate-400" />
                            {p.email}
                          </span>
                        )}
                        {p.google_rating && (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                            {p.google_rating} ({p.google_reviews_count})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 opacity-60"
                  >
                    Push to Leads
                    <ArrowRight size={13} className="text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Overlay: Minimal Coming Soon Window without heavy descriptions or navigations */}
      <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-xs">
        <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 sm:p-8 shadow-xl text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Compass size={24} />
          </div>

          <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-900">
            Coming Soon
          </h2>

          <p className="mt-1.5 text-xs text-slate-500">
            Lead Discovery is currently under development.
          </p>
        </div>
      </div>
    </div>
  )
}
