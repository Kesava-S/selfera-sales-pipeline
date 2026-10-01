/**
 * DEMO MODE sample data (local testing only).
 * 14 cafés and 10 hotels with chats, drafts and stages, plus every other lead
 * from the Marketing Outreach database as "Needs review".
 * Used only when NEXT_PUBLIC_DEMO_MODE=true and the app runs with `npm run dev`.
 * Changes made in the app are kept in memory until the dev server restarts.
 */

import { IMPORTED_LEADS } from './demoImported'

export const DEMO_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'demo@selfera.co.uk',
}

type Row = Record<string, any>

export type DemoStore = {
  profiles: Row[]
  businesses: Row[]
  opportunities: Row[]
  threads: Row[]
  messages: Row[]
  drafts: Row[]
  stage_changes: Row[]
  templates: Row[]
  cadence_rules: Row[]
  notifications: Row[]
  consultation_bookings: Row[]
  tasks: Row[]
}

let counter = 0
const id = (prefix: string) => {
  counter += 1
  return `${prefix}-${String(counter).padStart(4, '0')}-demo`
}

const ago = (days: number, hours = 0) =>
  new Date(Date.now() - days * 86400000 + hours * 3600000).toISOString()

const dateIn = (days: number) => {
  const d = new Date(Date.now() + days * 86400000)
  return d.toISOString().slice(0, 10)
}

type Msg = [direction: 'outbound' | 'inbound' | 'system', body: string, stepLabel: string | null, when: string]

type ThreadSpec = {
  platform: string
  status: string
  step: number
  next_due_on?: string | null
  last_outbound_at?: string | null
  last_inbound_at?: string | null
  paused_reason?: string | null
  messages?: Msg[]
  draft?: { step_label: string; body: string; subject?: string; status?: string; missing_fields?: string[] }
}

type CafeSpec = {
  business: Row
  opportunity: Row
  threads?: ThreadSpec[]
  changes?: Row[]
}

function buildStore(): DemoStore {
  const store: DemoStore = {
    profiles: [
      { id: DEMO_USER.id, full_name: 'Kesav (Demo)', role: 'admin', capacity: 150, is_active: true, created_at: ago(60) },
      { id: '00000000-0000-4000-8000-000000000002', full_name: 'Sales Demo', role: 'sales', capacity: 150, is_active: true, created_at: ago(40) },
      { id: '00000000-0000-4000-8000-000000000003', full_name: 'Consultant Demo', role: 'consultant', capacity: 150, is_active: true, created_at: ago(40) },
    ],
    businesses: [],
    opportunities: [],
    threads: [],
    messages: [],
    drafts: [],
    stage_changes: [],
    templates: [],
    cadence_rules: [
      { id: id('cad'), step_name: 'Follow up 1', days_delay: 3, description: 'Working days after First contact before Follow-up 1', created_at: ago(30), updated_at: ago(30) },
      { id: id('cad'), step_name: 'Follow up 2', days_delay: 5, description: 'Working days after Follow-up 1 before Follow-up 2', created_at: ago(30), updated_at: ago(30) },
      { id: id('cad'), step_name: 'Follow up 3', days_delay: 14, description: 'Working days after Follow-up 2 before the Final check', created_at: ago(30), updated_at: ago(30) },
      { id: id('cad'), step_name: 'Went Cold', days_delay: 14, description: 'Working days after the Final check before No response', created_at: ago(30), updated_at: ago(30) },
    ],
    notifications: [],
    consultation_bookings: [],
    tasks: [],
  }

  const add = (spec: CafeSpec, index: number) => {
    const bizId = id('biz')
    const oppId = id('opp')
    store.businesses.push({
      id: bizId,
      business_code: `SAMPLE-${String(index).padStart(2, '0')}`,
      category: 'Food & Drink',
      business_type: 'Cafe',
      tier: null,
      room_count: null,
      maps_link: null,
      phone: null,
      whatsapp_number: null,
      email: null,
      instagram: null,
      facebook: null,
      existing_website: null,
      company_type: 'Unknown',
      contact_name: null,
      notes: null,
      archived: false,
      created_at: spec.opportunity.created_at || ago(1),
      updated_at: ago(0),
      ...spec.business,
    })
    store.opportunities.push({
      id: oppId,
      opportunity_code: `OP-${String(index).padStart(4, '0')}`,
      business_id: bizId,
      services_won: null,
      conversion_type: null,
      converted_through: null,
      demo_link: null,
      assigned_sales_id: null,
      assigned_consultant_id: null,
      consultation_at: null,
      source_opportunity_id: null,
      won_at: null,
      closed_at: null,
      upsell_reminder_on: null,
      created_at: ago(1),
      updated_at: ago(0),
      ...spec.opportunity,
    })
    for (const t of spec.threads || []) {
      const threadId = id('thr')
      store.threads.push({
        id: threadId,
        opportunity_id: oppId,
        platform: t.platform,
        status: t.status,
        step: t.step,
        next_due_on: t.next_due_on ?? null,
        last_outbound_at: t.last_outbound_at ?? null,
        last_inbound_at: t.last_inbound_at ?? null,
        paused_reason: t.paused_reason ?? null,
        external_thread_id: null,
        created_at: spec.opportunity.created_at || ago(1),
      })
      for (const [direction, body, step_label, when] of t.messages || []) {
        store.messages.push({
          id: id('msg'),
          thread_id: threadId,
          direction,
          body,
          subject: null,
          template_id: null,
          step_label,
          send_method: direction === 'outbound' ? 'manual' : direction === 'inbound' ? 'webhook' : null,
          delivery_status: direction === 'outbound' ? 'sent' : null,
          created_at: when,
        })
      }
      if (t.draft) {
        store.drafts.push({
          id: id('drf'),
          thread_id: threadId,
          template_id: null,
          subject: t.draft.subject ?? null,
          missing_fields: t.draft.missing_fields ?? null,
          status: t.draft.status ?? 'ready',
          due_on: dateIn(0),
          created_at: ago(0),
          step_label: t.draft.step_label,
          body: t.draft.body,
        })
      }
    }
    for (const c of spec.changes || []) {
      store.stage_changes.push({ id: id('stg'), opportunity_id: oppId, from_services: null, to_services: null, changed_by: DEMO_USER.id, ...c })
    }
  }

  const cafes: CafeSpec[] = [
    {
      business: { business_name: 'Café NOVA Bistro', area: 'East Twickenham', address: '424 Richmond Rd, East Twickenham', postcode: 'TW1 2EB', google_rating: 4.9, google_reviews_count: 653, phone: '07453 302323', whatsapp_number: '07453 302323', instagram: 'cafenovabistro', notes: 'Open Mon to Fri 7am to 5pm, Sat and Sun 8am to 5pm. Website demo built.' },
      opportunity: { services_pitched: ['Website'], stage: 'Active', created_at: ago(3) },
      threads: [
        {
          platform: 'WhatsApp', status: 'Awaiting reply', step: 1, next_due_on: dateIn(0), last_outbound_at: ago(3),
          messages: [['outbound', "Hi, I'm Kesav from Selfera. Love what you've built at Café NOVA Bistro, 4.9 stars from 653 reviews is brilliant. I noticed you don't have a website yet, so I made a free demo for you. Happy to send the link?", 'First contact', ago(3)]],
          draft: { step_label: 'Follow-up 1', body: 'Hi again, just checking you saw my message about the free website demo for Café NOVA Bistro. Happy to send the link whenever suits you.' },
        },
        {
          platform: 'Instagram', status: 'Awaiting reply', step: 1, next_due_on: dateIn(0), last_outbound_at: ago(3),
          messages: [['outbound', "Hi Café NOVA Bistro team, I'm Kesav from Selfera. I made a free website demo for you. Would you like to see it?", 'First contact', ago(3)]],
          draft: { step_label: 'Follow-up 1', body: 'Hi again, just checking you saw my message about the free website demo. Happy to send it over.' },
        },
      ],
    },
    {
      business: { business_name: 'Wild Thing Colombian Coffee', area: 'West Ealing', address: '148 Broadway, West Ealing', postcode: 'W13 0TL', google_rating: 4.9, google_reviews_count: 174, phone: '07710 580743', whatsapp_number: '07710 580743', instagram: 'wildthing.coffee', contact_name: 'Mauricio' },
      opportunity: { services_pitched: ['Website', 'Micro Automation'], stage: 'Consultation', consultation_at: ago(-2), created_at: ago(8) },
      threads: [
        {
          platform: 'WhatsApp', status: 'Replied', step: 1, last_outbound_at: ago(6, 1), last_inbound_at: ago(5),
          messages: [
            ['outbound', "Hi Mauricio, I'm Kesav from Selfera. I made a free website demo for Wild Thing, with your menu and the tea of the day. Would you like to see it?", 'First contact', ago(8)],
            ['inbound', 'Hi Kesav, yes please send it over. Looks interesting.', null, ago(6)],
            ['outbound', 'Great, here it is. We can also automate your online orders. Would a 20 minute call work this week?', 'Reply', ago(6, 1)],
            ['inbound', 'Sure, I booked a slot on your website.', null, ago(5)],
            ['system', 'Consultation booked from the website.', null, ago(5, 0.1)],
          ],
        },
        { platform: 'Instagram', status: 'Paused', step: 1, paused_reason: 'Replied on WhatsApp', last_outbound_at: ago(8), messages: [['outbound', "Hi Wild Thing team, I'm Kesav from Selfera. I made a free website demo for you. Can I send the link?", 'First contact', ago(8)]] },
      ],
      changes: [
        { from_stage: 'Active', to_stage: 'Interested', reason: 'Replied on WhatsApp', created_at: ago(6) },
        { from_stage: 'Interested', to_stage: 'Consultation', reason: 'Booked on website', created_at: ago(5) },
      ],
    },
    {
      business: { business_name: 'Mooca Café', area: 'Richmond', address: '7 Golden Ct, Richmond', postcode: 'TW9 1EU', google_rating: 4.7, google_reviews_count: 438, phone: '020 3345 1530', instagram: 'mooca_cafe_richmond' },
      opportunity: { services_pitched: ['Website'], stage: 'Interested', created_at: ago(6) },
      threads: [
        {
          platform: 'Instagram', status: 'Replied', step: 1, last_outbound_at: ago(6), last_inbound_at: ago(1),
          messages: [
            ['outbound', "Hi Mooca team, I'm Kesav from Selfera. I made a free website demo for Mooca Café. Would you like to see it?", 'First contact', ago(6)],
            ['inbound', 'Hi, how much would it cost?', null, ago(1)],
          ],
        },
        { platform: 'Phone', status: 'Paused', step: 0, paused_reason: 'Replied on Instagram' },
      ],
      changes: [{ from_stage: 'Active', to_stage: 'Interested', reason: 'Asked about price on Instagram', created_at: ago(1) }],
    },
    {
      business: { business_name: 'Rich Café', area: 'East Twickenham', address: '435 Richmond Rd, East Twickenham', postcode: 'TW1 2EF', google_rating: 4.7, google_reviews_count: 304, phone: '020 4568 5234' },
      opportunity: { services_pitched: ['Website'], stage: 'Needs review', created_at: ago(1) },
    },
    {
      business: { business_name: 'QBrü Coffee', area: 'Richmond', address: '96 Kew Rd, Richmond', postcode: 'TW9 2PQ', google_rating: 4.5, google_reviews_count: 140, phone: '020 8940 0733', instagram: 'qbrucoffee' },
      opportunity: { services_pitched: ['Website'], stage: 'Active', created_at: ago(6) },
      threads: [
        {
          platform: 'Instagram', status: 'Awaiting reply', step: 2, next_due_on: dateIn(2), last_outbound_at: ago(2),
          messages: [
            ['outbound', "Hi QBrü team, I'm Kesav from Selfera. I made a free website demo for QBrü Coffee. Would you like to see it?", 'First contact', ago(6)],
            ['outbound', 'Hi again, just checking you saw my message about the free demo. No pressure at all.', 'Follow-up 1', ago(2)],
          ],
        },
      ],
    },
    {
      business: { business_name: 'Cafe Milano', area: 'Richmond', address: '8 Lichfield Ct, Sheen Rd, Richmond', postcode: 'TW9 1AS', google_rating: 4.8, google_reviews_count: 117, phone: '020 3659 4410', facebook: 'Cafe-Milano-Richmond' },
      opportunity: { services_pitched: ['Website'], stage: 'Active', created_at: ago(12) },
      threads: [
        {
          platform: 'Facebook', status: 'Awaiting reply', step: 3, next_due_on: dateIn(10), last_outbound_at: ago(4),
          messages: [
            ['outbound', "Hi Cafe Milano, I'm Kesav from Selfera. I made a free website demo for you. Would you like to see it?", 'First contact', ago(12)],
            ['outbound', 'Hi again, just checking you saw my message about the free demo.', 'Follow-up 1', ago(9)],
            ['outbound', 'Last nudge from me. The demo is ready whenever you want a look.', 'Follow-up 2', ago(4)],
          ],
        },
      ],
    },
    {
      business: { business_name: 'Cafe Nano', area: 'Richmond', address: '76 Sheen Rd, Richmond', postcode: 'TW9 1UF', google_rating: 4.8, google_reviews_count: 92, phone: '07514 953005', whatsapp_number: '07514 953005', email: 'orders@partyplatter.co.uk', instagram: 'cafenano', facebook: 'Cafenanorichmond', existing_website: 'Wix site', notes: 'Has a basic Wix site. Also runs party platters.' },
      opportunity: { services_pitched: ['Website', 'Micro Automation'], stage: 'Active', created_at: ago(0) },
      threads: [
        { platform: 'WhatsApp', status: 'Not contacted', step: 0, next_due_on: dateIn(0), draft: { step_label: 'First contact', body: "Hi, I'm Kesav from Selfera. I love Cafe Nano and your party platters. I made a free demo of a new website with online platter orders. Can I send you the link?" } },
        { platform: 'Email', status: 'Not contacted', step: 0, next_due_on: dateIn(0), draft: { step_label: 'First contact', subject: 'A free website demo for Cafe Nano', status: 'needs_data', missing_fields: ['company_type'], body: "Hi there,\n\nI'm Kesav from Selfera. I made a free demo of a new website for Cafe Nano, with online orders for your party platters. Would you like to see it?\n\nKesav\nSelfera\nReply STOP and I won't contact you again." } },
        { platform: 'Instagram', status: 'Not contacted', step: 0, next_due_on: dateIn(0), draft: { step_label: 'First contact', body: "Hi Cafe Nano team, I'm Kesav from Selfera. I made a free website demo for you with platter orders built in. Would you like to see it?" } },
        { platform: 'Facebook', status: 'Not contacted', step: 0, next_due_on: dateIn(0), draft: { step_label: 'First contact', body: "Hi Cafe Nano, I'm Kesav from Selfera. I made a free website demo for you. Would you like to see it?" } },
      ],
    },
    {
      business: { business_name: 'Café Torelli', area: 'Kew', address: '131 Kew Rd, Richmond', postcode: 'TW9 2PN', google_rating: 4.4, google_reviews_count: 63, instagram: 'cafetorellikew' },
      opportunity: { services_pitched: ['Website'], stage: 'No response', closed_at: ago(1), created_at: ago(30) },
      threads: [
        {
          platform: 'Instagram', status: 'No reply', step: 4, last_outbound_at: ago(1),
          messages: [
            ['outbound', "Hi Café Torelli, I'm Kesav from Selfera. I made a free website demo for you. Would you like to see it?", 'First contact', ago(30)],
            ['outbound', 'Hi again, just checking you saw my message.', 'Follow-up 1', ago(26)],
            ['outbound', 'Last nudge from me. The demo is ready whenever you want a look.', 'Follow-up 2', ago(19)],
            ['outbound', "I'll leave it here. If you ever want the demo, just message me.", 'Final check', ago(1)],
            ['system', 'No reply after the final check. Moved to No response.', null, ago(1, 0.1)],
          ],
        },
      ],
      changes: [{ from_stage: 'Active', to_stage: 'No response', reason: 'No reply after the final check', created_at: ago(1) }],
    },
    {
      business: { business_name: 'Magnolia Cafe', area: 'Twickenham', address: 'Cambridge Gardens Park, Twickenham', postcode: 'TW1 2TY', google_rating: 4.8, google_reviews_count: 67, phone: '07435 263633', whatsapp_number: '07435 263633', instagram: 'magnoliatreecafe' },
      opportunity: { services_pitched: ['Website'], services_won: ['Website', 'Micro Automation'], conversion_type: 'Expanded', converted_through: 'Consultation', stage: 'Won', won_at: ago(2), upsell_reminder_on: dateIn(28), created_at: ago(15) },
      threads: [
        {
          platform: 'WhatsApp', status: 'Replied', step: 1, last_outbound_at: ago(15), last_inbound_at: ago(13),
          messages: [
            ['outbound', "Hi, I'm Kesav from Selfera. I made a free website demo for Magnolia Cafe. Would you like to see it?", 'First contact', ago(15)],
            ['inbound', "Yes! We've wanted a website for ages.", null, ago(13)],
            ['system', 'Won: Website + Micro Automation (converted through Consultation).', null, ago(2)],
          ],
        },
        { platform: 'Instagram', status: 'Paused', step: 0, paused_reason: 'Replied on WhatsApp' },
      ],
      changes: [
        { from_stage: 'Active', to_stage: 'Interested', reason: 'Replied on WhatsApp', created_at: ago(13) },
        { from_stage: 'Interested', to_stage: 'Consultation', reason: 'Handed over', created_at: ago(10) },
        { from_stage: 'Consultation', to_stage: 'Won', from_services: ['Website'], to_services: ['Website', 'Micro Automation'], reason: 'Added booking automation after the call', created_at: ago(2) },
      ],
    },
    {
      business: { business_name: "Eileen's at Buccleuch Gardens", area: 'Richmond', address: 'Petersham Rd, Richmond', postcode: 'TW10 6UX', google_rating: 4.7, google_reviews_count: 207, notes: 'No phone or socials found yet. Walk-in only.' },
      opportunity: { services_pitched: ['Website'], stage: 'Needs review', created_at: ago(1) },
    },
    {
      business: { business_name: "Mike's Cafe", area: 'Notting Hill', address: '12 Blenheim Cres', postcode: 'W11 1NN', google_rating: 4.6, google_reviews_count: 1065, phone: '020 7229 3757', instagram: 'mikescafeportobello' },
      opportunity: { services_pitched: ['Website'], stage: 'Went cold', created_at: ago(25) },
      threads: [
        {
          platform: 'Instagram', status: 'Replied', step: 1, last_outbound_at: ago(18), last_inbound_at: ago(22),
          messages: [
            ['outbound', "Hi Mike's Cafe, I'm Kesav from Selfera. I made a free website demo for you. Would you like to see it?", 'First contact', ago(25)],
            ['inbound', 'Maybe, send it over.', null, ago(22)],
            ['outbound', 'Here you go. Happy to walk you through it on a quick call.', 'Reply', ago(22, 2)],
            ['outbound', 'Hi, just checking if you had a chance to look at the demo?', 'Follow-up 1', ago(18)],
          ],
        },
      ],
      changes: [
        { from_stage: 'Active', to_stage: 'Interested', reason: 'Replied on Instagram', created_at: ago(22) },
        { from_stage: 'Interested', to_stage: 'Went cold', reason: 'No reply after our follow-up', created_at: ago(4) },
      ],
    },
    {
      business: { business_name: 'BNB Cafe and Bar', area: 'Notting Hill', address: '219 Westbourne Park Rd', postcode: 'W11 1EA', google_rating: 4.6, google_reviews_count: 835, phone: '020 7243 9223' },
      opportunity: { services_pitched: ['End-to-End Automation'], stage: 'Active', created_at: ago(2) },
      threads: [
        { platform: 'Phone', status: 'Awaiting reply', step: 1, next_due_on: dateIn(1), last_outbound_at: ago(2), messages: [['outbound', 'Called. Spoke to staff, the manager is in on Thursday. Call back then.', 'First contact', ago(2)]] },
      ],
    },
    {
      business: { business_name: 'Cafe de Fred', area: 'Earls Court', address: '10A Earls Ct Rd', postcode: 'W8 6EA', google_rating: 4.8, google_reviews_count: 728, phone: '07960 722425', whatsapp_number: '07960 722425', instagram: 'cafe_defred', notes: 'Email orders@cafedefred.co.uk not verified.' },
      opportunity: { services_pitched: ['Website'], stage: 'Declined', closed_at: ago(3), created_at: ago(9) },
      threads: [
        {
          platform: 'WhatsApp', status: 'Replied', step: 1, last_outbound_at: ago(9), last_inbound_at: ago(3),
          messages: [
            ['outbound', "Hi, I'm Kesav from Selfera. I made a free website demo for Cafe de Fred. Would you like to see it?", 'First contact', ago(9)],
            ['inbound', "Thanks but we're happy with Instagram for now.", null, ago(3)],
          ],
        },
        { platform: 'Instagram', status: 'Paused', step: 0, paused_reason: 'Replied on WhatsApp' },
      ],
      changes: [{ from_stage: 'Active', to_stage: 'Declined', reason: 'Happy with Instagram for now', created_at: ago(3) }],
    },
    {
      business: { business_name: 'St Clair Cafe', area: 'Notting Hill', address: '98 Portland Rd', postcode: 'W11 4QL', google_rating: 4.8, google_reviews_count: 121, instagram: 'st.clair.cafe' },
      opportunity: { services_pitched: ['Custom Dashboard'], stage: 'Active', created_at: ago(3) },
      threads: [
        {
          platform: 'Instagram', status: 'Awaiting reply', step: 1, next_due_on: dateIn(0), last_outbound_at: ago(3),
          messages: [['outbound', "Hi St Clair team, I'm Kesav from Selfera. We build simple dashboards that show your daily sales and stock in one place. Would a quick demo be useful?", 'First contact', ago(3)]],
          draft: { step_label: 'Follow-up 1', body: 'Hi again, just checking you saw my message about the dashboard demo. Happy to show you in 10 minutes.' },
        },
      ],
    },
  ]

  cafes.forEach((c, i) => add(c, i + 1))

  // Hotels from the Marketing Outreach database (Hotels tab). Room counts not known, so left empty.
  const acc = { category: 'Accommodation' }
  const emailSign = "\n\nKesav\nSelfera\nReply STOP and I won't contact you again."
  const hotels: CafeSpec[] = [
    {
      business: { ...acc, business_name: 'Hotel 1843', business_type: 'Hotel', area: 'Reading', postcode: 'RG1', google_rating: 3.9, google_reviews_count: 138, phone: '0118 950 3925', email: 'info@1843reading.com', existing_website: '1843reading.com', notes: 'Part of Hamlet Hotels (small group).' },
      opportunity: { services_pitched: ['End-to-End Automation'], stage: 'Active', created_at: ago(3) },
      threads: [
        {
          platform: 'Email', status: 'Awaiting reply', step: 1, next_due_on: dateIn(0), last_outbound_at: ago(3),
          messages: [['outbound', "Hi Hotel 1843 team,\n\nI'm Kesav from Selfera. We help independent hotels automate booking confirmations, pre-arrival messages and review requests, so the front desk spends less time on email. Would a short call be useful?" + emailSign, 'First contact', ago(3)]],
          draft: { step_label: 'Follow-up 1', subject: 'Re: Saving your front desk time', body: 'Hi again,\n\nJust checking you saw my note about automating guest messages at Hotel 1843. Happy to show a quick example.' + emailSign },
        },
        { platform: 'Phone', status: 'Awaiting reply', step: 1, next_due_on: dateIn(0), last_outbound_at: ago(3), messages: [['outbound', 'Called reception. Manager not in, asked to call back later in the week.', 'First contact', ago(3)]] },
      ],
    },
    {
      business: { ...acc, business_name: 'The Selwyn Hotel', business_type: 'Hotel', area: 'Richmond', postcode: 'TW9', google_rating: 4.6, google_reviews_count: 301, phone: '020 7167 3165', email: 'hello@theselwyn.com', existing_website: 'theselwyn.com' },
      opportunity: { services_pitched: ['Micro Automation'], stage: 'Interested', created_at: ago(7) },
      threads: [
        {
          platform: 'Email', status: 'Replied', step: 1, last_outbound_at: ago(7), last_inbound_at: ago(1),
          messages: [
            ['outbound', "Hi Selwyn team,\n\nI'm Kesav from Selfera. We set up small automations for hotels, like automatic review requests after checkout. Would that be useful for you?" + emailSign, 'First contact', ago(7)],
            ['inbound', 'Hi Kesav, the review requests sound interesting. What would it cost and how long to set up?', null, ago(1)],
          ],
        },
      ],
      changes: [{ from_stage: 'Active', to_stage: 'Interested', reason: 'Asked about price by email', created_at: ago(1) }],
    },
    {
      business: { ...acc, business_name: 'Kew Gardens Hotel', business_type: 'Hotel', area: 'Kew', postcode: 'TW9', google_rating: 4.3, google_reviews_count: 883, phone: '020 8940 2220', email: 'enquiries@kewgardenshotel.com', existing_website: 'kewgardenshotel.com' },
      opportunity: { services_pitched: ['Custom Dashboard'], stage: 'Consultation', consultation_at: ago(-1), created_at: ago(10) },
      threads: [
        {
          platform: 'Email', status: 'Replied', step: 1, last_outbound_at: ago(8), last_inbound_at: ago(6),
          messages: [
            ['outbound', "Hi Kew Gardens Hotel team,\n\nI'm Kesav from Selfera. We build simple dashboards that show bookings, occupancy and reviews in one place. Would a quick demo help?" + emailSign, 'First contact', ago(10)],
            ['outbound', 'Hi again, just checking you saw my message about the dashboard demo.' + emailSign, 'Follow-up 1', ago(8)],
            ['inbound', 'Yes, we would like to see it. Can we do a call next week?', null, ago(6)],
            ['system', 'Consultation booked from the website.', null, ago(5)],
          ],
        },
        { platform: 'Phone', status: 'Paused', step: 0, paused_reason: 'Replied on Email' },
      ],
      changes: [
        { from_stage: 'Active', to_stage: 'Interested', reason: 'Replied by email', created_at: ago(6) },
        { from_stage: 'Interested', to_stage: 'Consultation', reason: 'Booked on website', created_at: ago(5) },
      ],
    },
    {
      business: { ...acc, business_name: 'The Boathouse London', business_type: 'Boutique hotel', tier: '4-5 star', area: 'Paddington', postcode: 'W2', google_rating: 4.8, google_reviews_count: 128, phone: '07528 515363', whatsapp_number: '07528 515363', email: 'info@boathouselondon.co.uk', existing_website: 'boathouselondon.co.uk' },
      opportunity: { services_pitched: ['Micro Automation'], stage: 'Active', created_at: ago(0) },
      threads: [
        { platform: 'WhatsApp', status: 'Not contacted', step: 0, next_due_on: dateIn(0), draft: { step_label: 'First contact', body: "Hi, I'm Kesav from Selfera. Lovely reviews for The Boathouse. We set up small automations for hotels, like pre-arrival messages and review requests. Could I send you a quick example?" } },
        { platform: 'Email', status: 'Not contacted', step: 0, next_due_on: dateIn(0), draft: { step_label: 'First contact', subject: 'Small automations for The Boathouse', status: 'needs_data', missing_fields: ['company_type'], body: "Hi Boathouse team,\n\nI'm Kesav from Selfera. We set up small automations for boutique hotels, like pre-arrival messages and review requests. Would a quick example be useful?" + emailSign } },
      ],
    },
    {
      business: { ...acc, business_name: 'Le Sorelle', business_type: 'B&B / Guesthouse', area: 'Isle of Dogs', postcode: 'E14', google_rating: 4.8, google_reviews_count: 140, phone: '07703 661259', whatsapp_number: '07703 661259', email: 'reservations-lesorelle@outlook.com', existing_website: 'lesorelleriverbarge.com', notes: 'Barge B&B.' },
      opportunity: { services_pitched: ['Micro Automation'], stage: 'Active', created_at: ago(6) },
      threads: [
        {
          platform: 'WhatsApp', status: 'Awaiting reply', step: 2, next_due_on: dateIn(3), last_outbound_at: ago(2),
          messages: [
            ['outbound', "Hi, I'm Kesav from Selfera. Le Sorelle looks lovely. We automate booking confirmations and check-in messages for small B&Bs. Would that help?", 'First contact', ago(6)],
            ['outbound', 'Hi again, just checking you saw my message. Happy to share a quick example.', 'Follow-up 1', ago(2)],
          ],
        },
      ],
    },
    {
      business: { ...acc, business_name: "Juliette's Guest House", business_type: 'B&B / Guesthouse', area: 'Bayswater', postcode: 'W2', google_rating: 4.3, google_reviews_count: 92, phone: '020 7792 2401', existing_website: 'julietts-guest.nhotel.online', notes: 'No email found.' },
      opportunity: { services_pitched: ['Cold Outreach'], stage: 'Needs review', created_at: ago(1) },
    },
    {
      business: { ...acc, business_name: 'Grand Hotel Bellevue', business_type: 'Hotel', area: 'Paddington', postcode: 'W2', google_rating: 4.3, google_reviews_count: 146, phone: '020 3089 2527', email: 'stay@grandhotelbellevuelondon.com', existing_website: 'grandhotelbellevuelondon.com' },
      opportunity: { services_pitched: ['End-to-End Automation'], stage: 'No response', closed_at: ago(1), created_at: ago(29) },
      threads: [
        {
          platform: 'Email', status: 'No reply', step: 4, last_outbound_at: ago(1),
          messages: [
            ['outbound', "Hi Grand Hotel Bellevue team,\n\nI'm Kesav from Selfera. We automate guest messages and bookings for independent hotels. Would a short call be useful?" + emailSign, 'First contact', ago(29)],
            ['outbound', 'Hi again, just checking you saw my note.' + emailSign, 'Follow-up 1', ago(25)],
            ['outbound', 'A last nudge from me. Happy to share an example whenever suits.' + emailSign, 'Follow-up 2', ago(18)],
            ['outbound', "I'll leave it here. If it's ever useful, just reply to this email." + emailSign, 'Final check', ago(1)],
            ['system', 'No reply after the final check. Moved to No response.', null, ago(1, 0.1)],
          ],
        },
      ],
      changes: [{ from_stage: 'Active', to_stage: 'No response', reason: 'No reply after the final check', created_at: ago(1) }],
    },
    {
      business: { ...acc, business_name: 'Jubilee Hotel Victoria', business_type: 'Hotel', area: 'Pimlico', postcode: 'SW1V', google_rating: 4.5, google_reviews_count: 309, phone: '020 8243 8630', email: 'stay@jubileehotel.co.uk', existing_website: 'jubileehotel.co.uk' },
      opportunity: { services_pitched: ['Micro Automation'], services_won: ['Micro Automation', 'Custom Dashboard'], conversion_type: 'Expanded', converted_through: 'Consultation', stage: 'Won', won_at: ago(3), upsell_reminder_on: dateIn(27), created_at: ago(20) },
      threads: [
        {
          platform: 'Email', status: 'Replied', step: 1, last_outbound_at: ago(20), last_inbound_at: ago(17),
          messages: [
            ['outbound', "Hi Jubilee Hotel team,\n\nI'm Kesav from Selfera. We set up small automations for hotels, like review requests and pre-arrival emails. Would that help?" + emailSign, 'First contact', ago(20)],
            ['inbound', 'Yes, we have been meaning to sort this out. Can we talk?', null, ago(17)],
            ['system', 'Won: Micro Automation + Custom Dashboard (converted through Consultation).', null, ago(3)],
          ],
        },
      ],
      changes: [
        { from_stage: 'Active', to_stage: 'Interested', reason: 'Replied by email', created_at: ago(17) },
        { from_stage: 'Interested', to_stage: 'Consultation', reason: 'Handed over', created_at: ago(14) },
        { from_stage: 'Consultation', to_stage: 'Won', from_services: ['Micro Automation'], to_services: ['Micro Automation', 'Custom Dashboard'], reason: 'Added a bookings dashboard after the call', created_at: ago(3) },
      ],
    },
    {
      business: { ...acc, business_name: 'Richmond Hill Hotel', business_type: 'Hotel', area: 'Richmond', postcode: 'TW10', google_rating: 4.2, google_reviews_count: 1266, phone: '020 8940 2247', email: 'info@richmondhill.co.uk', existing_website: 'richmondhill-hotel.co.uk' },
      opportunity: { services_pitched: ['Custom Dashboard'], stage: 'Declined', closed_at: ago(2), created_at: ago(9) },
      threads: [
        {
          platform: 'Email', status: 'Replied', step: 1, last_outbound_at: ago(9), last_inbound_at: ago(2),
          messages: [
            ['outbound', "Hi Richmond Hill Hotel team,\n\nI'm Kesav from Selfera. We build simple dashboards that show bookings, occupancy and reviews in one place. Would a quick demo help?" + emailSign, 'First contact', ago(9)],
            ['inbound', 'Thanks, but we already use a system for this.', null, ago(2)],
          ],
        },
      ],
      changes: [{ from_stage: 'Active', to_stage: 'Declined', reason: 'Already has a system', created_at: ago(2) }],
    },
    {
      business: { ...acc, business_name: 'Abbey House Hotel', business_type: 'Hotel', area: 'Reading', postcode: 'RG30', google_rating: 3.5, google_reviews_count: 83, phone: '0118 961 5973', email: 'bookings@theabbeyhousehotel.co.uk', existing_website: 'theabbeyhousehotel.co.uk' },
      opportunity: { services_pitched: ['Cold Outreach'], stage: 'Active', created_at: ago(2) },
      threads: [
        {
          platform: 'Email', status: 'Awaiting reply', step: 1, next_due_on: dateIn(1), last_outbound_at: ago(2),
          messages: [['outbound', "Hi Abbey House team,\n\nI'm Kesav from Selfera. We run outreach campaigns that bring corporate and group bookings to independent hotels. Would that be useful for you?" + emailSign, 'First contact', ago(2)]],
        },
      ],
    },
  ]
  hotels.forEach((h, i) => add(h, cafes.length + i + 1))

  // Everything else from the spreadsheet: imported, waiting for review
  IMPORTED_LEADS.forEach(({ service, ...business }, i) =>
    add({ business, opportunity: { services_pitched: [service], stage: 'Needs review', created_at: ago(1) } }, cafes.length + hotels.length + i + 1)
  )

  // Templates: Website, 4 platforms x 4 steps
  const steps: [string, string][] = [
    ['First contact', "Hi {business_name}, I'm {sender_name} from Selfera. I made a free website demo for you. Would you like to see it?"],
    ['Follow-up 1', 'Hi again, just checking you saw my message about the free website demo for {business_name}.'],
    ['Follow-up 2', 'Last nudge from me. The demo for {business_name} is ready whenever you want a look.'],
    ['Final check', "I'll leave it here. If you ever want the demo, just message me."],
  ]
  for (const platform of ['WhatsApp', 'Instagram', 'Facebook', 'Email']) {
    for (const [step, body] of steps) {
      store.templates.push({
        id: id('tpl'),
        name: `Website · ${platform} · ${step}`,
        platform,
        step,
        services: ['Website'],
        business_types: [],
        subject: platform === 'Email' ? `A free website demo for {business_name}` : null,
        body: platform === 'Email' ? `${body}\n\n{sender_name}\nSelfera\nReply STOP and I won't contact you again.` : body,
        whatsapp_template_name: null,
        is_active: true,
        updated_at: ago(5),
      })
    }
  }

  // One unmatched booking so the admin box has something to show
  store.consultation_bookings.push({
    id: id('bkg'),
    name: 'Sam',
    business_name: 'Unknown café (booked from website)',
    email: null,
    phone: null,
    booked_for: ago(-3),
    message: 'Interested in a website',
    matched_opportunity_id: null,
    match_status: 'unmatched',
    created_at: ago(0),
  })

  return store
}

// Bump this when the sample data changes, so a running dev server reloads it
const DEMO_DATA_VERSION = 3

const g = globalThis as unknown as { __selferaDemoStore?: DemoStore; __selferaDemoVersion?: number }

export function getDemoStore(): DemoStore {
  if (!g.__selferaDemoStore || g.__selferaDemoVersion !== DEMO_DATA_VERSION) {
    g.__selferaDemoStore = buildStore()
    g.__selferaDemoVersion = DEMO_DATA_VERSION
  }
  return g.__selferaDemoStore
}
