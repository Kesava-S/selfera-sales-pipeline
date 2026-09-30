# Selfera Sales Pipeline — Comprehensive System Specification & Architecture Manual

> **Document Purpose:** Complete, authoritative reference guide for the Selfera Sales Pipeline repository. Designed to onboard senior engineers, architects, or AI assistants (e.g. Claude) with zero prior knowledge into full mastery of the codebase, business domain, database schema, automation workflows, and strict engineering constraints.

---

## Table of Contents

1. [Executive Summary & Core Mission](#1-executive-summary--core-mission)
2. [High-Level Architecture & System Boundaries](#2-high-level-architecture--system-boundaries)
3. [Technology Stack & Dependency Matrix](#3-technology-stack--dependency-matrix)
4. [Database Architecture & Data Models (`"sales-pipe"` Schema)](#4-database-architecture--data-models-sales-pipe-schema)
5. [The Outreach Cadence Engine & Working-Day Rules](#5-the-outreach-cadence-engine--working-day-rules)
6. [Automated Outreach Engine: n8n Daily Workflow](#6-automated-outreach-engine-n8n-daily-workflow)
7. [Commercial Service Catalog & Service Pivot Mechanics](#7-commercial-service-catalog--service-pivot-mechanics)
8. [Application Routes, Pages & Component Hierarchy](#8-application-routes-pages--component-hierarchy)
9. [Design System, Styling & UX Architecture](#9-design-system-styling--ux-architecture)
10. [Strict Engineering Rules, Constraints & Conventions](#10-strict-engineering-rules-constraints--conventions)
11. [Operational Setup, Environment Configuration & Deployment](#11-operational-setup-environment-configuration--deployment)

---

## 1. Executive Summary & Core Mission

### 1.1 What is Selfera Sales Pipeline?
**Selfera Sales Pipeline** is an enterprise-grade, high-velocity CRM, multi-channel outreach engine, and sales progression tracker purpose-built for modern B2B agencies and SaaS companies. It manages the complete lifecycle of corporate prospect accounts from initial lead capture through automated multi-step outreach, multi-contact management, live service offering pivots, deal closure, and post-sale upsell cadences.

### 1.2 Key Differentiators
1. **Multi-Channel Cadence Execution:** Native tracking and execution across **Email**, **WhatsApp**, **Instagram**, **Phone**, and **Walk-in** channels.
2. **Company-Centric Account Aggregation:** Multiple contact persons, deals, and service offerings are consolidated under a single company account card, eliminating duplicate work and disjointed communication.
3. **PECR Legal Compliance Engine:** Embedded UK Privacy and Electronic Communications Regulations (PECR) safeguards. Automated cold email sequences are strictly restricted to UK Corporate Bodies (Limited companies, LLPs, PLCs). Sole traders and partnerships are systematically flagged and routed to manual, personal outreach channels (WhatsApp, Phone, Walk-in).
4. **Service Pivot History Engine:** Commercial services change during client discovery. Selfera maintains an immutable history of service changes (`Initial Service` &rarr; `Current Service` &rarr; `Agreed Service`), recording rationale, pricing shifts, and timestamps.
5. **The Database "Golden Rule":** To guarantee 100% data integrity between manual salesperson UI actions and automated background cron jobs (n8n), **all progression logic, working-day calculations, and stage transitions reside strictly in the PostgreSQL stored procedure `record_outreach`**. Neither frontend UI code nor n8n computes stages or dates independently.

---

## 2. High-Level Architecture & System Boundaries

```
 +-----------------------------------------------------------------------------------+
 |                                   CLIENT TIER                                     |
 |  Next.js 16.3.6 (Turbopack) / React 19.2.8 / Custom Vanilla CSS Design System     |
 |                                                                                   |
 |  [Today's Queue]     [Company Workspace]     [Lead Cockpit]     [Services Catalog]|
 |        /                 /company             /leads/detail          /services    |
 +-----------------------------------------------------------------------------------+
           |                                                      |
    (Server Actions / SSR)                               (Browser Supabase Client)
           |                                                      |
           v                                                      v
 +-----------------------------------------------------------------------------------+
 |                              APPLICATION / API TIER                               |
 |   Supabase SSR Client (@supabase/ssr)       Supabase Client (@supabase/supabase-js)|
 +-----------------------------------------------------------------------------------+
                                           |
                              (Secure REST / RPC Calls)
                                           |
                                           v
 +-----------------------------------------------------------------------------------+
 |                               PERSISTENCE TIER                                    |
 |                   Supabase PostgreSQL (Schema: "sales-pipe")                      |
 |                                                                                   |
 |   Tables: leads, tasks, services, lead_service_history, templates, activity_log   |
 |   Views:  leads_due_today                                                         |
 |   RPC:    record_outreach(), add_working_days(), record_service_pivot()           |
 +-----------------------------------------------------------------------------------+
                                           ^
                                           |
                               (Daily 09:00 Cron Trigger)
                                           |
 +-----------------------------------------------------------------------------------+
 |                              BACKGROUND AUTOMATION                                |
 |                                 n8n Engine                                        |
 |   1. Polls view: leads_due_today                                                  |
 |   2. Evaluates PECR rules & channels                                              |
 |   3. Sends automated emails (SMTP / Gmail)                                        |
 |   4. Generates manual tasks for WhatsApp / Instagram / Phone                      |
 |   5. Invokes stored procedure: record_outreach(p_action = 'sent')                 |
 +-----------------------------------------------------------------------------------+
```

---

## 3. Technology Stack & Dependency Matrix

| Category | Package / Tool | Version | Purpose & Architectural Justification |
| :--- | :--- | :--- | :--- |
| **Framework** | `next` | `16.3.6` | Next.js App Router with Turbopack compilation. Full SSR, Server Components, and Server Actions. |
| **UI Library** | `react`, `react-dom` | `19.2.8` | React 19 concurrent features, client/server boundary segregation. |
| **Database Client** | `@supabase/supabase-js` | `^2.117.2` | Core Postgres client communicating with the `"sales-pipe"` schema. |
| **Server Auth/Cookies**| `@supabase/ssr` | `^0.12.7` | Next.js App Router cookie handling for server components and routes. |
| **Database Driver** | `pg`, `@types/pg` | `^8.23.0` | Node.js PostgreSQL client for raw migration scripts and administrative tasks. |
| **Icons** | `lucide-react` | `^1.48.0` | High-fidelity, consistent SVG iconography. |
| **CSV Parser** | `papaparse` | `^5.7.0` | In-browser and server-side CSV stream processing for bulk lead imports. |
| **Styling** | Vanilla CSS (`globals.css`) | Native | Custom CSS design tokens, HSL variables, glassmorphism. **Tailwind CSS is prohibited**. |
| **Language** | TypeScript | `^5` | Strict static typing across database entities, UI components, and API payloads. |

---

## 4. Database Architecture & Data Models (`"sales-pipe"` Schema)

All tables, views, stored procedures, and triggers are encapsulated in the dedicated PostgreSQL schema `"sales-pipe"`.

```
                    +---------------------------+
                    |       sales-pipe.leads    |
                    +---------------------------+
                    | id (PK, UUID)             |<------------------+
                    | lead_code (LD-XXXX)       |                   |
                    | business_name             |                   |
                    | company_type              |                   |
                    | channel                   |                   |
                    | stage                     |                   |
                    | follow_up_count           |                   |
                    | next_follow_up            |                   |
                    | initial_service           |                   |
                    | current_service           |                   |
                    | agreed_service            |                   |
                    +---------------------------+                   |
                       |                     |                      |
            1:N        |         1:N         |         1:N          |
     +-----------------+                     +-------------+        |
     |                                                     |        |
     v                                                     v        |
+---------------------------+             +---------------------------+
|       sales-pipe.tasks    |             |  lead_service_history     |
+---------------------------+             +---------------------------+
| id (PK, UUID)             |             | id (PK, UUID)             |
| lead_id (FK -> leads.id)  |             | lead_id (FK -> leads.id)  |
| title                     |             | from_service              |
| description               |             | to_service                |
| due_date                  |             | reason                    |
| status (open/completed)   |             | notes                     |
| task_type                 |             | changed_by                |
+---------------------------+             +---------------------------+
     |
     | 1:N
     v
+---------------------------+
|   sales-pipe.activity_log |
+---------------------------+
| id (PK, UUID)             |
| lead_id (FK -> leads.id)  |
| action_type (sent/note)   |
| details                   |
| created_by                |
| created_at                |
+---------------------------+
```

### 4.1 Schema Definitions

#### Table: `leads`
Represents an individual prospect contact associated with a business account.
```sql
CREATE TABLE "sales-pipe".leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_code VARCHAR(20) UNIQUE NOT NULL,
    business_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    instagram_handle TEXT,
    company_type TEXT NOT NULL DEFAULT 'limited' CHECK (company_type IN ('limited', 'sole_trader', 'partnership')),
    channel TEXT NOT NULL DEFAULT 'Email' CHECK (channel IN ('Email', 'WhatsApp', 'Instagram', 'Phone', 'Walk-in')),
    stage TEXT NOT NULL DEFAULT 'New' CHECK (stage IN ('New', 'Contacted', 'Replied', 'Interested', 'Won', 'Lost', 'Do not contact')),
    follow_up_count INTEGER NOT NULL DEFAULT 0 CHECK (follow_up_count >= 0),
    next_follow_up DATE,
    assigned_to TEXT DEFAULT 'sales-1',
    initial_service TEXT DEFAULT 'Website Services',
    current_service TEXT DEFAULT 'Website Services',
    agreed_service TEXT,
    service_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Table: `tasks`
Daily action queue tasks for sales representatives and automated cadences.
```sql
CREATE TABLE "sales-pipe".tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES "sales-pipe".leads(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to TEXT,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
    task_type TEXT NOT NULL DEFAULT 'sales_followup' CHECK (task_type IN ('sales_followup', 'general')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Table: `services`
Commercial services offered by the agency.
```sql
CREATE TABLE "sales-pipe".services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('Web & Design', 'Automation & AI', 'Data & Analytics', 'Consulting & Strategy', 'Marketing & Outreach')),
    price NUMERIC(10, 2),
    deliverables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Table: `lead_service_history`
Full audit history of every service pivot/transition.
```sql
CREATE TABLE "sales-pipe".lead_service_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES "sales-pipe".leads(id) ON DELETE CASCADE,
    from_service TEXT NOT NULL,
    to_service TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('client_requested', 'budget_constraint', 'upsell_opportunity', 'technical_pivot', 'packaged_combo', 'other')),
    notes TEXT,
    changed_by TEXT NOT NULL DEFAULT 'sales-1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Table: `templates`
Outreach message templates with variable interpolation.
```sql
CREATE TABLE "sales-pipe".templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'All' CHECK (channel IN ('All', 'Email', 'WhatsApp', 'Instagram', 'SMS', 'Facebook')),
    step INTEGER CHECK (step IN (0, 1, 2, 3)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.2 Stored Procedures & Views

#### Function: `"sales-pipe".add_working_days(start_date DATE, days_to_add INT) RETURNS DATE`
Calculates business days skipping Saturdays and Sundays.
```sql
CREATE OR REPLACE FUNCTION "sales-pipe".add_working_days(start_date DATE, days_to_add INT)
RETURNS DATE AS $$
DECLARE
    cur_date DATE := start_date;
    added INT := 0;
BEGIN
    WHILE added < days_to_add LOOP
        cur_date := cur_date + INTERVAL '1 day';
        IF EXTRACT(ISODOW FROM cur_date) < 6 THEN
            added := added + 1;
        END IF;
    END LOOP;
    RETURN cur_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### Core Function: `"sales-pipe".record_outreach`
The central hub for all state mutations.
```sql
CREATE OR REPLACE FUNCTION "sales-pipe".record_outreach(
    p_lead_id UUID,
    p_action TEXT,
    p_task_id UUID DEFAULT NULL,
    p_details TEXT DEFAULT NULL,
    p_reply_channel TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_lead RECORD;
    v_next_date DATE;
    v_new_stage TEXT;
    v_channel TEXT;
BEGIN
    SELECT * INTO v_lead FROM "sales-pipe".leads WHERE id = p_lead_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;

    v_channel := COALESCE(p_reply_channel, v_lead.channel);

    IF p_action = 'sent' THEN
        v_new_stage := 'Contacted';
        IF v_lead.follow_up_count = 0 THEN
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 3);
        ELSIF v_lead.follow_up_count = 1 THEN
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 5);
        ELSIF v_lead.follow_up_count = 2 THEN
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 14);
        END IF;
        
        UPDATE "sales-pipe".leads 
        SET stage = v_new_stage,
            channel = v_channel,
            follow_up_count = follow_up_count + 1,
            next_follow_up = v_next_date
        WHERE id = p_lead_id;

        INSERT INTO "sales-pipe".activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'sent', COALESCE(p_details, 'Message sent via ' || v_channel), 'sales-1');

    ELSIF p_action = 'no_reply_final' THEN
        UPDATE "sales-pipe".leads SET stage = 'Lost', next_follow_up = NULL WHERE id = p_lead_id;
        INSERT INTO "sales-pipe".activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'system', 'Final check: no reply. Marked as lost.', 'system');

    ELSIF p_action IN ('replied', 'interested', 'won', 'lost', 'do_not_contact', 'new') THEN
        IF p_action = 'new' THEN
            v_new_stage := 'New';
            v_next_date := CURRENT_DATE;
        ELSIF p_action = 'replied' THEN
            v_new_stage := 'Replied';
            v_next_date := NULL;
        ELSIF p_action = 'interested' THEN
            v_new_stage := 'Interested';
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 2);
        ELSIF p_action = 'won' THEN
            v_new_stage := 'Won';
            v_next_date := CURRENT_DATE + INTERVAL '30 days';
        ELSIF p_action = 'lost' THEN
            v_new_stage := 'Lost';
            v_next_date := NULL;
        ELSIF p_action = 'do_not_contact' THEN
            v_new_stage := 'Do not contact';
            v_next_date := NULL;
        END IF;

        UPDATE "sales-pipe".leads 
        SET stage = v_new_stage,
            channel = v_channel,
            next_follow_up = v_next_date
        WHERE id = p_lead_id;

        INSERT INTO "sales-pipe".activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'note', 'Stage updated to ' || v_new_stage, 'sales-1');
    END IF;

    -- Mark task completed if provided
    IF p_task_id IS NOT NULL THEN
        UPDATE "sales-pipe".tasks SET status = 'completed' WHERE id = p_task_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### View: `"sales-pipe".leads_due_today`
Polled daily by n8n.
```sql
CREATE OR REPLACE VIEW "sales-pipe".leads_due_today AS
SELECT * FROM "sales-pipe".leads
WHERE next_follow_up <= CURRENT_DATE
  AND stage NOT IN ('Replied', 'Lost', 'Do not contact');
```

---

## 5. The Outreach Cadence Engine & Working-Day Rules

### 5.1 Cadence Lifecycle Progression Table

```
   [New Prospect]
         |
         | (Step 0: Initial Outreach sent)
         v
   [Contacted (Step 1/3)]  ---- next_follow_up = CURRENT_DATE + 3 working days
         |
         | (Step 1 sent)
         v
   [Contacted (Step 2/3)]  ---- next_follow_up = CURRENT_DATE + 5 working days
         |
         | (Step 2 sent)
         v
   [Contacted (Step 3/3)]  ---- next_follow_up = CURRENT_DATE + 14 working days (Final Check)
         |
    +----+-----------------------+------------------------+
    | No reply after 14 days     | Client responds        | Client requests STOP
    v                            v                        v
 [Lost]                      [Replied]              [Do not contact]
                                 |                  (PECR opt-out enforced)
                                 v (Expresses interest)
                            [Interested]  ---- next_follow_up = CURRENT_DATE + 2 working days
                                 |
                                 v (Deal closed)
                               [Won]      ---- next_follow_up = CURRENT_DATE + 30 days (Upsell)
```

### 5.2 Dynamic Variable Interpolation
Templates support mustache-style parameter interpolation executed via `src/lib/templateUtils.ts`:
- `{{business_name}}` &rarr; Replaced with lead's corporate name
- `{{service}}` &rarr; Replaced with `current_service` or fallback `initial_service`
- `{{sender_name}}` &rarr; Replaced with assigned sales rep name (`Kesav / Admin`)
- `{{channel}}` &rarr; Replaced with primary communication channel
- `{{email}}`, `{{phone}}`, `{{instagram_handle}}` &rarr; Contact credentials

---

## 6. Automated Outreach Engine: n8n Daily Workflow

The daily background automation workflow is defined in `n8n/sales-follow-ups-daily.json`.

### 6.1 Execution Flow
1. **Schedule Trigger**: Fires Monday to Friday at 09:00 UK time (`Europe/London`).
2. **Fetch Leads**: Queries `GET /rest/v1/leads_due_today` using the Supabase `service_role` key.
3. **Switch & Evaluate Rules**:
   - **Case A (`follow_up_count == 3`)**: Final check elapsed without answer &rarr; calls `record_outreach(p_action = 'no_reply_final')`. Stage moves to `Lost`.
   - **Case B (`stage == 'Won'`)**: Creates an internal task for 30-day upsell check-in.
   - **Case C (`channel == 'Email' AND email != '' AND company_type == 'limited'`)**:
     - Pulls active email template for the corresponding cadence step.
     - Sends email via SMTP or Gmail node.
     - Invokes `record_outreach(p_action = 'sent', p_details = 'Email sent (auto)')`.
   - **Case D (WhatsApp, Instagram, Phone, Sole Trader)**:
     - n8n **never** sends automated WhatsApp or Instagram messages directly.
     - Inserts a task into `"sales-pipe".tasks` with `task_type = 'sales_followup'`, assigned to the sales rep, with direct protocol action links (`https://wa.me/...`, `https://instagram.com/...`).

---

## 7. Commercial Service Catalog & Service Pivot Mechanics

### 7.1 Data Fields on Lead
- `initial_service`: The entry service pitched during first contact.
- `current_service`: The actively quoted/discussed service package.
- `agreed_service`: The formal signed service package (auto-populated when marked `Won`).

### 7.2 Service Pivot Flow
When a sales discussion shifts (e.g. from *Website Services* to *Website Services + AI Automation*):
1. User clicks **Pivot Service** on the Lead Detail page.
2. Form opens `ChangeServiceModal.tsx` requiring:
   - `New Target Service` (selected from active catalog in `services` table)
   - `Transition Reason` (`client_requested`, `budget_constraint`, `upsell_opportunity`, `technical_pivot`, `packaged_combo`)
   - `Internal Pivot Notes`
3. Executed via `src/lib/serviceUtils.ts -> recordServicePivot()`:
   - Updates `leads.current_service`
   - Inserts audit entry in `lead_service_history`
   - Appends audit entry into `activity_log` with visual `[Service Pivot]` milestone tag.

---

## 8. Detailed Module Specifications

This section breaks down each core functional module across the application, detailing its architectural responsibility, user interactions, database queries, component composition, and state lifecycle.

```
                              APPLICATION MODULE MAP
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                             │
  │   [Module 1: Today's Queue]  ───────►  [Module 2: Company Workspace]        │
  │   Route: /                             Route: /company?name=...             │
  │   (Account Cards & Due Badges)         (Multi-Contact & Account Actions)    │
  │                 │                                    │                      │
  │                 └─────────────────┐  ┌───────────────┘                      │
  │                                   ▼  ▼                                      │
  │                      [Module 3: Lead Cockpit]                               │
  │                      Route: /leads/detail?id=...                            │
  │                      (Pipeline Stepper, Cadence & Notes)                    │
  │                                   │                                         │
  │            ┌──────────────────────┼──────────────────────┐                  │
  │            ▼                      ▼                      ▼                  │
  │   [Module 4: Directory]  [Module 5: Services]  [Module 6: Templates]        │
  │   Route: /leads          Route: /services      Route: /templates            │
  │   (Full CRM Table)       (Catalog & Pivots)    (Outreach Composer)          │
  │                                                                             │
  └─────────────────────────────────────────────────────────────────────────────┘
```

---

### 8.1 Module 1: Today's Sales Queue & Accounts Directory (`/`)

- **Primary Route:** `/` (`src/app/page.tsx`)
- **Main Client View:** `TodayTasksView.tsx` (`src/components/TodayTasksView.tsx`)
- **Key Subcomponents:** `CompanyTasksModal.tsx`, `AddLeadModal.tsx`, `ReplyChannelModal.tsx`, `SendFollowupModal.tsx`

#### Architectural Role & Business Value
The root dashboard serves as the daily operating command center for the sales rep. Instead of presenting a raw, unorganized list of disconnected tasks, it aggregates the entire sales pipeline into **company/business accounts**, allowing reps to see exactly which companies have outreach due today versus which have scheduled cadences in the future.

#### Data Fetching & State Lifecycle
- **Server Load (`page.tsx`):**
  - Concurrently queries:
    1. `tasks`: All open tasks ordered by `due_date ASC`, populated with related lead records (`leads(*)`).
    2. `leads`: All registered prospect leads ordered by `created_at DESC`.
  - Injects `initialTasks` and `initialLeads` into `TodayTasksView`.
- **Client Grouping Memo (`companyGroups`):**
  - Iterates over all registered businesses in `leads` so **every company appears as a card**.
  - Attaches open tasks to each matching company.
  - Sorts companies by action urgency:
    1. Companies with tasks due **Today** or overdue.
    2. Companies ordered by earliest **Next Due Date** (`nextDueDate`).
    3. Companies that are completed / up-to-date (`All caught up`).

#### UI Elements & User Interactions
1. **Top Metric Summary Cards:**
   - **Total Companies:** Total unique businesses registered in the CRM.
   - **Pending Tasks:** Total tasks due on or before today (`isDueTodayOrOverdue(t.due_date)`).
   - **Sales Follow-ups:** Count of active cadence tasks due today (`task_type = 'sales_followup'`).
   - **Completed Today:** Count of tasks completed during today's session.
2. **Company Account Cards Grid:**
   - **Building Icon & Name:** Corporate entity title. Clicking the card navigates directly to `/company?name=[EncodedName]`.
   - **Leads Count Badge:** E.g., `2 Leads` or `1 Lead` under that company.
   - **Dynamic Action Status Badge:**
     - **If Tasks Due Today:** Amber button displaying `<Clock /> [X] Task Today`. Clicking this button opens `CompanyTasksModal`, isolating only today's tasks for that business and highlighting the target lead.
     - **If Future Scheduled Date:** Clean badge displaying `<Calendar /> Next: [FormattedDate]` (e.g. `Next: 2 Oct 2026`).
     - **If All Tasks Complete:** Neutral badge displaying `<CheckCircle /> All caught up` (e.g., for replied or closed accounts).
   - **Card Footer:** Subtitle "Action leads" and navigation link: `View Leads (X) ->`.
3. **Empty State:** If zero tasks or companies exist, renders `You're completely caught up!` with quick buttons to create a new lead or browse all leads.

---

### 8.2 Module 2: Company Workspace & Multi-Contact Manager (`/company`)

- **Primary Route:** `/company?name=[EncodedName]` (`src/app/company/page.tsx`)
- **Main Client View:** `CompanyLeadsView.tsx` (`src/components/CompanyLeadsView.tsx`)
- **Key Subcomponents:** `CompanyTasksModal.tsx`, `SendFollowupModal.tsx`, `ReplyChannelModal.tsx`, `ConfirmModal.tsx`

#### Architectural Role & Business Value
B2B sales frequently involve pitching different service packages or contacting multiple decision-makers (e.g. Founder, Marketing Director, Operations Lead) at the same target company. The **Company Workspace** aggregates all contacts under that corporate banner.

#### Data Fetching & Features
- Fetches all leads matching `business_name = companyName` (case-insensitive ILIKE match).
- Queries open tasks specifically linked to any of this company's leads.
- **Header Overview Bar:**
  - Displays company title, total registered contacts, primary outreach channels in use, and active pitched services.
  - **Company Tasks Trigger:** If tasks are due today, renders an amber clickable banner opening the company's tasks modal.
  - **Pitch Service / Add Contact Button:** Opens `AddLeadModal` pre-populated with the company's name, allowing instant creation of a second contact or service proposal.
- **Contact Cards List:**
  - Each contact person is rendered with:
    - Custom ID (`LD-XXXX`) and primary channel icon.
    - Direct communication links:
      - **WhatsApp:** Opens `https://wa.me/[Phone]?text=...` with pre-filled cadence copy.
      - **Email:** Direct `mailto:[Email]?subject=...&body=...` link.
      - **Instagram:** Direct link to `@handle` profile.
      - **Phone:** Click-to-call `tel:[Phone]`.
    - Pipeline Stage Badge with inline stage switching triggers.
    - Cadence Progress Badge: `Step X/3 • Next: [Date]`.
    - Active Service Offering Badge with pivot indicators.
    - Quick actions: **Choose Template & Send Follow-up**, **Mark Sent**, **Replied**, **Interested**.

---

### 8.3 Module 3: Lead Overview Cockpit (`/leads/detail`)

- **Primary Route:** `/leads/detail?id=[UUID]` (`src/app/leads/detail/page.tsx`)
- **Main Client View:** `LeadDetailView.tsx` (`src/components/LeadDetailView.tsx`)
- **Key Subcomponents:** `ChangeServiceModal.tsx`, `EditLeadModal.tsx`, `ReplyChannelModal.tsx`, `ConfirmModal.tsx`

#### Architectural Role & Business Value
The single source of truth for an individual lead. Contains all granular metadata, interactive stage progression, cadence actions, live interaction logging, and service pivot history.

#### Core Subsections & Mechanics
1. **Interactive Visual Pipeline Stepper:**
   - Visual button bar: `[New]` &rarr; `[Contacted]` &rarr; `[Replied]` &rarr; `[Interested]` &rarr; `[Won Deal]` + `[Lost]` + `[Opt-out]`.
   - Clicking any stage immediately updates the lead state and runs **automated task reconciliation**:
     - Moving to `Replied`, `Lost`, or `Do not contact` automatically marks all prior open cadence tasks as `completed`.
     - Moving to `Interested` completes older cadence tasks and automatically schedules an **Interested Follow-up** task at `+2 working days`.
     - Moving to `Won` marks older cadence tasks as `completed`, auto-populates `agreed_service = current_service`, and schedules an **Upsell Check-in** task at `+30 calendar days`.
2. **Contact Details Panel:**
   - Displays email, phone, Instagram handle, and company type.
   - Includes inline quick-edit modal trigger (`EditLeadModal`) and primary channel selector.
3. **Cadence Outreach Panel:**
   - Primary action: **Choose Template & Send Follow-up** (opens `SendFollowupModal`).
   - Displays live status: `Current: Step X/3 • Due: [Date]`.
   - Dynamic contextual alerts (e.g. `High interest lead. Follow-up reminder active.` when Interested).
4. **Service Offering & Pivot Panel:**
   - Displays current service pitch alongside initial service.
   - **Pivot Service Button:** Opens `ChangeServiceModal` to record a formal pivot with rationale.
   - **View Offering Button:** Displays full service description and deliverables breakdown.
5. **Log Interaction Note:**
   - Freeform text input allowing sales reps to record meeting minutes, call takeaways, or objection details.
   - Submits directly to `"sales-pipe".activity_log` attributed to `sales-1`.
6. **Activity Timeline:**
   - Chronological stream of all milestone events: message transmissions, stage updates, service pivots, and staff notes with relative and absolute timestamps.

---

### 8.4 Module 4: All Leads CRM Directory (`/leads`)

- **Primary Route:** `/leads` (`src/app/leads/page.tsx`)
- **Main Client View:** `LeadsView.tsx` (`src/components/LeadsView.tsx`)
- **Key Subcomponents:** `AddLeadModal.tsx`, `EditLeadModal.tsx`, `ConfirmModal.tsx`

#### Architectural Role & Business Value
The tabular CRM view for filtering, sorting, inspecting, and managing large volumes of prospect accounts.

#### Capabilities & User Workflows
- **Real-time Search:** Multi-attribute filtering matching business name, contact email, phone number, or custom lead code (`LD-XXXX`).
- **Faceted Filters:**
  - Filter by **Stage** (`New`, `Contacted`, `Replied`, `Interested`, `Won`, `Lost`, `Do not contact`).
  - Filter by **Primary Channel** (`Email`, `WhatsApp`, `Instagram`, `Phone`, `Walk-in`).
  - Filter by **Pitched Service**.
- **Data Table Columns:**
  - `Lead ID` (clickable link to `/leads/detail?id=...`)
  - `Company & Contact` (business name, contact person, email, phone)
  - `Channel` (colored channel pill)
  - `Stage` (stage pill matching design system colors)
  - `Cadence Step` (`Step 0/3`, `Step 1/3`, etc.)
  - `Next Action` (formatted working date)
  - `Active Service` (`ServiceBadge` with pivot indicator)
  - `Actions` (Edit, Delete, Open cockpit)
- **Top Actions:** Quick buttons for **+ New Lead** and **Import CSV**.

---

### 8.5 Module 5: Commercial Services Catalog (`/services`)

- **Primary Route:** `/services` (`src/app/services/page.tsx`)
- **Main Client View:** `ServicesView.tsx` (`src/components/ServicesView.tsx`)
- **Key Subcomponents:** `ServiceModal.tsx`, `ConfirmModal.tsx`

#### Architectural Role & Business Value
Maintains the agency's commercial offering catalog. Leads and pivots strictly draw from this catalog, ensuring consistent naming, deliverables, and pricing across the entire sales team.

#### Features & Mechanics
- **Top KPI Stat Cards:**
  - **Active Services:** Total live commercial offerings.
  - **Total Pipeline Value:** Cumulative potential deal value based on catalog pricing.
  - **Service Categories:** Number of distinct disciplines (`Web & Design`, `Automation & AI`, `Data & Analytics`, etc.).
  - **Active Pitches:** Count of leads currently being pitched active catalog offerings.
- **Service Cards Grid:**
  - Each card showcases:
    - Service Name and Category badge.
    - Starting price / fee structure.
    - Comprehensive commercial scope & description.
    - Deliverables checklist chips.
    - Quick actions: **Edit Service** and **Delete Service**.
- **Service Creation & Editing (`ServiceModal.tsx`):**
  - Custom form with fields: Service Name, Category, Price, Description, and Deliverables tag manager.
  - **Custom Validation:** Suppresses browser defaults (`noValidate`), displaying inline validation errors if required fields are missing or invalid.

---

### 8.6 Module 6: Outreach Templates Engine (`/templates`)

- **Primary Route:** `/templates` (`src/app/templates/page.tsx`)
- **Main Client View:** `TemplatesView.tsx` (`src/components/TemplatesView.tsx`)
- **Key Subcomponents:** `TemplateModal.tsx`

#### Architectural Role & Business Value
Standardizes high-converting outreach copy across all reps and automated cadences, supporting multi-channel messaging and dynamic variable replacement.

#### Features & Mechanics
- **Multi-Channel Tabs:** Filter templates by `All`, `Email`, `WhatsApp`, `Instagram`, `SMS`, or `Facebook`.
- **Cadence Step Grouping:** Groups templates by cadence step (`Step 0: Initial Outreach`, `Step 1: First Follow-up`, `Step 2: Second Follow-up`, `Step 3: Final Break-up / Check`).
- **Dynamic Variable Toolbar:** Reps can click variable chips (`{{business_name}}`, `{{service}}`, `{{sender_name}}`, `{{channel}}`, `{{email}}`) to insert them into template subject or body copy.
- **Interactive Live Preview:** Side-by-side simulation demonstrating how the template resolves when merged with live lead data.
- **Template Editor (`TemplateModal.tsx`):** Real-time editor with syntax insertion, channel selector, cadence step mapping, and validation.

---

### 8.7 Module 7: Lead Ingestion & Bulk CSV Import

- **Components:** `AddLeadModal.tsx`, `AddLeadView.tsx`, `/leads/import` (`src/app/leads/import/page.tsx`)
- **Library:** `papaparse`

#### Manual Lead Capture (`AddLeadModal.tsx`)
- Accessible globally from any screen via `AddLeadModalProvider`.
- Fields:
  - `Business Name` with smart autocomplete (`CompanyAutocompleteInput.tsx`) to avoid creating accidental duplicate companies.
  - `Company Type` (`Limited Company`, `Sole Trader`, `Partnership`) enforcing PECR rules.
  - `Primary Channel` (`Email`, `WhatsApp`, `Instagram`, `Phone`, `Walk-in`).
  - `Initial Service Pitch` (populated directly from active `services` catalog).
  - `Contact Credentials` (Email, Phone, Instagram handle).
- **Auto-Task Generation:** Creating a new lead automatically creates its initial cadence task (`Send First Outreach`) due today in `"sales-pipe".tasks`.

#### Bulk CSV Import (`/leads/import`)
- Stream-parses CSV uploads using PapaParse.
- Auto-maps headers (`Business Name`, `Email`, `Phone`, `Channel`, `Service`).
- Previews valid versus invalid rows with inline error flagging.
- Batch inserts records into `"sales-pipe".leads` with corresponding initial tasks.

---

### 8.8 Module 8: Follow-up Composer & Execution (`SendFollowupModal.tsx`)

- **Component:** `SendFollowupModal.tsx` (`src/components/SendFollowupModal.tsx`)

#### Features & Protocol Launchers
When a salesperson clicks **Choose Template & Send Follow-up**:
1. Modal pre-selects the optimal template matching the lead's current cadence step and channel.
2. Interpolates live variables (`{{business_name}}`, `{{service}}`, etc.).
3. Provides one-click action execution:
   - **Send via WhatsApp:** Formats URL `https://wa.me/[Phone]?text=[EncodedMessage]` and launches WhatsApp Desktop / Web.
   - **Send via Email:** Formats `mailto:[Email]?subject=[Subject]&body=[Body]` and opens local mail client.
   - **Send via Instagram:** Copies outreach pitch to clipboard and launches `@handle` profile.
4. Clicking **Mark as Sent**:
   - Executes stored procedure `"sales-pipe".record_outreach(p_action = 'sent')`.
   - Advances cadence count by +1 and automatically schedules next working-day date.
   - Closes current task.

---

### 8.9 Module 9: Service Pivoting Engine (`ChangeServiceModal.tsx`)

- **Component:** `ChangeServiceModal.tsx` (`src/components/ChangeServiceModal.tsx`)
- **Utility:** `src/lib/serviceUtils.ts`

#### Architectural Mechanics
Sales conversations frequently uncover that a prospect needs a different solution than initially pitched.
1. The rep opens `ChangeServiceModal`.
2. Selects new offering from live `services` table.
3. Selects standard categorization reason:
   - `client_requested` &rarr; Prospect asked for alternative scope
   - `budget_constraint` &rarr; Down-sold to accessible tier
   - `upsell_opportunity` &rarr; Upgraded to comprehensive automation suite
   - `technical_pivot` &rarr; Shifted due to infrastructure constraints
   - `packaged_combo` &rarr; Bundled multiple offerings
4. Writes internal rationale notes.
5. Saves atomically:
   - Updates `leads.current_service`.
   - Writes immutable entry in `lead_service_history`.
   - Appends audit milestone to `activity_log`.
   - Updates UI badge to show pivot indicators (`Initial Service -> Current Service`).

---

---

## 9. Design System, Styling & UX Architecture

### 9.1 Core Palette & CSS Variables (`src/app/globals.css`)
```css
:root {
  --background: #f8fafc;
  --foreground: #0f172a;
  --primary: #4f46e5;
  --primary-hover: #4338ca;
  --secondary: #64748b;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --card-bg: #ffffff;
  --card-border: #e2e8f0;
  --muted: #64748b;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
}
```

### 9.2 Key UX Conventions
- **No Tailwind CSS**: Pure semantic classes (`.btn`, `.btn-primary`, `.btn-secondary`, `.card`, `.badge`, `.input-field`, `.stat-card`).
- **Zero Emojis**: Emojis are strictly banned from UI labels, badges, buttons, and system logs. All visual cues use `lucide-react` icons.
- **Top-Right Floating Toasts**: Notifications are globally anchored to the viewport top-right (`top: 1.25rem`, `right: 1.75rem`, `z-index: 9999`) with subtle shadow and smooth fade-in animations.
- **Custom In-UI Form Validation**: Native browser validation tooltips are suppressed via `noValidate`. Custom errors are displayed inline beneath inputs with red borders and concise text.

---

## 10. Strict Engineering Rules, Constraints & Conventions

1. **NO GIT COMMITS OR PUSHES**:
   - Under no circumstances should automated agents run `git commit` or `git push`. The repository owner manually manages Git commits and version history.
2. **NO TAILWIND CSS**:
   - Do not import or inject Tailwind utility classes. Maintain the custom Vanilla CSS token architecture in `globals.css`.
3. **NEVER DELETE OR MUTATE AGENTS.md**:
   - `AGENTS.md` contains Next.js 16 breaking change guards written by Turbopack. Do not remove or alter this block.
4. **DATABASE-DRIVEN CADENCE**:
   - Never compute cadence increments or dates in React client code. Always execute `"sales-pipe".record_outreach` stored procedure.
5. **PECR COLD OUTREACH ENFORCEMENT**:
   - Automated cold emails must only be sent to UK Limited companies (`company_type = 'limited'`). Sole traders and personal contacts must remain manual tasks.

---

## 11. Operational Setup, Environment Configuration & Deployment

### 11.1 Environment Variables (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_SUPABASE_SCHEMA=sales-pipe

# Private Database Connection (Migrations / Admin tasks only; never in client bundle)
DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-for-n8n-only>
```

### 11.2 Verification Commands
```bash
# Run local development server (Turbopack)
npm run dev

# Execute strict TypeScript and production build verification
npm run build

# Start production server
npm start
```
