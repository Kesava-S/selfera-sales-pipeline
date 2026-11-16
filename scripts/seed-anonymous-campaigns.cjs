const { Client } = require('pg');

async function seedCampaigns() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('Connected to database. Starting campaign seeding transaction...');
  await client.query('BEGIN');

  try {
    const PROFILES = {
      admin: '5df6ec65-dbb4-418c-ab7a-c1034fcd80aa',
      kesav: 'de225853-f48f-49fe-8c9d-61c32a2d7254',
      manikandan: 'f0736280-6801-40c5-b371-9808044f2a7d',
    };

    const now = new Date();
    const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
    const daysAhead = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch businesses to link
    const bizRes = await client.query(
      `SELECT b.id, b.business_name, b.email, b.whatsapp_number, b.contact_name, b.category, b.business_type,
              o.id as opportunity_id,
              (SELECT t.id FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.platform = 'Email' LIMIT 1) as email_thread_id,
              (SELECT t.id FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.platform = 'WhatsApp' LIMIT 1) as wa_thread_id
       FROM "sales-pipe".businesses b
       LEFT JOIN "sales-pipe".opportunities o ON o.business_id = b.id
       ORDER BY b.business_name`
    );

    const businesses = bizRes.rows;
    console.log(`Found ${businesses.length} businesses to link with campaigns.`);

    const byName = {};
    businesses.forEach((b) => {
      byName[b.business_name] = b;
    });

    // 2. Insert Email Databases
    console.log('Inserting Email Databases...');
    const emailDb1Res = await client.query(
      `INSERT INTO "sales-pipe".email_databases (
        name, description, contact_count, contacts, created_by
      ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        'UK Independent Boutique Hotels & Inns',
        'Verified general managers and reservation desks across England and Scotland.',
        5,
        JSON.stringify([
          { name: 'The Grand Pavilion Hotel', email: 'info@grandpavilionhotel.co.uk', contact: 'Alistair Finch' },
          { name: 'Highland View Guesthouse', email: 'enquiries@highlandviewgh.co.uk', contact: 'Hamish MacLeod' },
          { name: 'The Royal Oak Inn & Spa', email: 'welcome@royaloakoxford.co.uk', contact: 'George Sterling' },
          { name: 'Lakeside Country House Hotel', email: 'stay@lakesidecountryhouse.co.uk', contact: 'Fiona Gallagher' },
          { name: 'Beacon Hill Country Lodge', email: 'reception@beaconhilllodge.co.uk', contact: 'Graham Ward' },
        ]),
        PROFILES.admin,
      ]
    );
    const emailDb1Id = emailDb1Res.rows[0].id;

    const emailDb2Res = await client.query(
      `INSERT INTO "sales-pipe".email_databases (
        name, description, contact_count, contacts, created_by
      ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        'High-Footfall Gastropubs & Dining Venues',
        'Active dining rooms and pubs in Bristol, Manchester, and Leeds.',
        4,
        JSON.stringify([
          { name: 'The Copper Kettle Alehouse', email: 'cheers@copperkettlealehouse.co.uk', contact: 'Dave Morrison' },
          { name: 'Harbor Light Seafood Bistro', email: 'bookings@harborlightbistro.co.uk', contact: 'Marcus Bell' },
          { name: 'Olive & Stone Pizzeria', email: 'hello@olivestonepizza.co.uk', contact: 'Matteo Rossi' },
          { name: 'The Rusty Anchor Tavern', email: 'contact@rustyanchortavern.co.uk', contact: "Patrick O'Connor" },
        ]),
        PROFILES.kesav,
      ]
    );
    const emailDb2Id = emailDb2Res.rows[0].id;

    // 3. Insert WhatsApp Databases
    console.log('Inserting WhatsApp Databases...');
    const waDb1Res = await client.query(
      `INSERT INTO "sales-pipe".whatsapp_databases (
        name, description, contact_count, contacts, created_by
      ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        'Direct Mobile Contacts - Hospitality Venues',
        'Direct mobile and WhatsApp lines for pub landlords and restaurant managers.',
        5,
        JSON.stringify([
          { name: 'Olive & Stone Pizzeria', phone: '+447700900901', contact: 'Matteo Rossi' },
          { name: 'Harbor Light Seafood Bistro', phone: '+447700900567', contact: 'Marcus Bell' },
          { name: 'The Copper Kettle Alehouse', phone: '+447700900456', contact: 'Dave Morrison' },
          { name: 'The Daily Grind Espresso Bar', phone: '+447700900778', contact: 'Liam Henderson' },
          { name: 'Saffron Lounge Brasserie', phone: '+447700900667', contact: 'Tariq Mahmood' },
        ]),
        PROFILES.admin,
      ]
    );
    const waDb1Id = waDb1Res.rows[0].id;

    const waDb2Res = await client.query(
      `INSERT INTO "sales-pipe".whatsapp_databases (
        name, description, contact_count, contacts, created_by
      ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        'Serviced Accommodation Property Operators',
        'UK property managers and serviced suite operators with active portfolios.',
        4,
        JSON.stringify([
          { name: 'Mayfair Haven Serviced Suites', phone: '+447700900789', contact: 'Eleanor Vance' },
          { name: 'Vanguard Property Partners', phone: '+447700900345', contact: 'Victoria Cross' },
          { name: 'Abbey Gate Letting Agents', phone: '+447700900334', contact: 'Simon Thorne' },
          { name: 'Cityscape Executive Lets', phone: '+447700900223', contact: 'Rachel Adams' },
        ]),
        PROFILES.manikandan,
      ]
    );
    const waDb2Id = waDb2Res.rows[0].id;

    // 4. Insert Email Campaigns
    console.log('Inserting Email Campaigns...');

    // Email Campaign 1: Sent
    const emailCamp1Res = await client.query(
      `INSERT INTO "sales-pipe".email_campaigns (
        name, subject, preheader, body, service, target_category, target_stage,
        status, recipient_count, recipients, sent_at, database_id, database_name, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
      [
        'Q4 Hospitality Direct Booking Sprint',
        'Direct bookings without OTA commissions for {{business_name}}',
        'How independent UK hotels and venues are saving 18% on OTA fees',
        'Hi {{contact_name}},\n\nWe love what you have built at {{business_name}} in {{area}}.\n\nMost independent boutique stays we partner with were losing between 15% and 22% of revenue to Booking.com and Expedia. We build direct booking websites and automated guest WhatsApp systems that convert guests directly.\n\nWould you be open to a 10-minute walkthrough this Thursday?\n\nBest regards,\nSelfera Marketing Team',
        'Website',
        'Hotel',
        'All',
        'sent',
        5,
        JSON.stringify([
          { name: 'The Grand Pavilion Hotel', email: 'info@grandpavilionhotel.co.uk', contact: 'Alistair Finch' },
          { name: 'Highland View Guesthouse', email: 'enquiries@highlandviewgh.co.uk', contact: 'Hamish MacLeod' },
          { name: 'The Royal Oak Inn & Spa', email: 'welcome@royaloakoxford.co.uk', contact: 'George Sterling' },
          { name: 'Lakeside Country House Hotel', email: 'stay@lakesidecountryhouse.co.uk', contact: 'Fiona Gallagher' },
          { name: 'Beacon Hill Country Lodge', email: 'reception@beaconhilllodge.co.uk', contact: 'Graham Ward' },
        ]),
        daysAgo(4),
        emailDb1Id,
        'UK Independent Boutique Hotels & Inns',
        PROFILES.admin,
        daysAgo(5),
      ]
    );
    const emailCamp1Id = emailCamp1Res.rows[0].id;

    // Email Campaign 2: Sent
    const emailCamp2Res = await client.query(
      `INSERT INTO "sales-pipe".email_campaigns (
        name, subject, preheader, body, service, target_category, target_stage,
        status, recipient_count, recipients, sent_at, database_id, database_name, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
      [
        'Dining & Pub Table Turnaround Campaign',
        'Quick question regarding peak table bookings at {{business_name}}',
        'Eliminate table no-shows and automate weekend reservations',
        'Hi {{contact_name}},\n\nWith weekend covers peaking across {{area}}, table no-shows can cost a busy kitchen thousands each month.\n\nOur micro-automation handles automatic 24-hour WhatsApp reminders and one-click deposit confirmations directly from your booking diary.\n\nCould I send over a 2-minute video showing how it works?\n\nCheers,\nSelfera Marketing Team',
        'Micro Automation',
        'Restaurant or cafe',
        'All',
        'sent',
        4,
        JSON.stringify([
          { name: 'The Copper Kettle Alehouse', email: 'cheers@copperkettlealehouse.co.uk', contact: 'Dave Morrison' },
          { name: 'Harbor Light Seafood Bistro', email: 'bookings@harborlightbistro.co.uk', contact: 'Marcus Bell' },
          { name: 'Olive & Stone Pizzeria', email: 'hello@olivestonepizza.co.uk', contact: 'Matteo Rossi' },
          { name: 'The Rusty Anchor Tavern', email: 'contact@rustyanchortavern.co.uk', contact: "Patrick O'Connor" },
        ]),
        daysAgo(2),
        emailDb2Id,
        'High-Footfall Gastropubs & Dining Venues',
        PROFILES.kesav,
        daysAgo(3),
      ]
    );
    const emailCamp2Id = emailCamp2Res.rows[0].id;

    // Email Campaign 3: Draft
    await client.query(
      `INSERT INTO "sales-pipe".email_campaigns (
        name, subject, preheader, body, service, target_category, target_stage,
        status, recipient_count, recipients, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        'Serviced Accommodation Guest Automation Outreach',
        'Streamline your short-let guest check-ins & key codes',
        'Contactless guest check-in automation for property managers',
        'Hi {{contact_name}},\n\nManaging check-ins across multiple properties in {{area}} takes hours of manual coordination.\n\nOur custom automation delivers automated check-in guides, key codes, and checkout notices to guests on their preferred channel.\n\nLet us know if you would like a demo.\n\nBest,\nSelfera Marketing',
        'End-to-End Automation',
        'Property management',
        'Active',
        'draft',
        4,
        JSON.stringify([
          { name: 'Mayfair Haven Serviced Suites', email: 'concierge@mayfairhaven.co.uk' },
          { name: 'Vanguard Property Partners', email: 'partners@vanguardproperty.co.uk' },
          { name: 'Abbey Gate Letting Agents', email: 'lettings@abbeygatebath.co.uk' },
          { name: 'Cityscape Executive Lets', email: 'hello@cityscapelets.co.uk' },
        ]),
        PROFILES.admin,
        daysAgo(1),
      ]
    );

    // Email Campaign 4: Scheduled
    await client.query(
      `INSERT INTO "sales-pipe".email_campaigns (
        name, subject, preheader, body, service, target_category, target_stage,
        status, recipient_count, recipients, scheduled_at, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        'Winter Low-Season Footfall Campaign',
        'Exclusive winter marketing automation sprint for {{business_name}}',
        'Boost corporate bookings and weekday footfall',
        'Hi {{contact_name}},\n\nAs we enter the winter quarter, we are running automated re-engagement campaigns for leading venues in {{area}} to fill mid-week capacity.\n\nReply to this email if you would like to see the case study.\n\nWarm regards,\nSelfera Marketing',
        'Cold Outreach',
        'All',
        'All',
        'scheduled',
        8,
        JSON.stringify([
          { name: 'The Grand Pavilion Hotel', email: 'info@grandpavilionhotel.co.uk' },
          { name: 'Highland View Guesthouse', email: 'enquiries@highlandviewgh.co.uk' },
          { name: 'Harbor Light Seafood Bistro', email: 'bookings@harborlightbistro.co.uk' },
          { name: 'Olive & Stone Pizzeria', email: 'hello@olivestonepizza.co.uk' },
          { name: 'The Copper Kettle Alehouse', email: 'cheers@copperkettlealehouse.co.uk' },
          { name: 'The Rusty Anchor Tavern', email: 'contact@rustyanchortavern.co.uk' },
          { name: 'Mayfair Haven Serviced Suites', email: 'concierge@mayfairhaven.co.uk' },
          { name: 'Vanguard Property Partners', email: 'partners@vanguardproperty.co.uk' },
        ]),
        daysAhead(3),
        PROFILES.admin,
        daysAgo(1),
      ]
    );

    // 5. Insert WhatsApp Campaigns
    console.log('Inserting WhatsApp Campaigns...');

    // WhatsApp Campaign 1: Sent
    const waCamp1Res = await client.query(
      `INSERT INTO "sales-pipe".whatsapp_campaigns (
        name, message, template_name, service, status, recipient_count, recipients,
        sent_at, database_id, database_name, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        'VIP Dining WhatsApp Broadcast',
        'Hello {{contact_name}}! We noticed {{business_name}} has stellar local reviews on Google. Are you currently using automated WhatsApp booking confirmations for weekend reservations? We help dining spots cut no-shows by up to 65% with zero extra staff time.',
        'dining_table_reminder',
        'Micro Automation',
        'sent',
        5,
        JSON.stringify([
          { name: 'Olive & Stone Pizzeria', phone: '+447700900901', contact: 'Matteo Rossi' },
          { name: 'Harbor Light Seafood Bistro', phone: '+447700900567', contact: 'Marcus Bell' },
          { name: 'The Copper Kettle Alehouse', phone: '+447700900456', contact: 'Dave Morrison' },
          { name: 'The Daily Grind Espresso Bar', phone: '+447700900778', contact: 'Liam Henderson' },
          { name: 'Saffron Lounge Brasserie', phone: '+447700900667', contact: 'Tariq Mahmood' },
        ]),
        daysAgo(3),
        waDb1Id,
        'Direct Mobile Contacts - Hospitality Venues',
        PROFILES.admin,
        daysAgo(4),
      ]
    );
    const waCamp1Id = waCamp1Res.rows[0].id;

    // WhatsApp Campaign 2: Sent
    const waCamp2Res = await client.query(
      `INSERT INTO "sales-pipe".whatsapp_campaigns (
        name, message, template_name, service, status, recipient_count, recipients,
        sent_at, database_id, database_name, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        'Property Manager Automated Guest Concierge',
        'Hi {{contact_name}}, managing multiple serviced suites in {{area}}? Our automated guest concierge handles check-in guides, WiFi credentials, and maintenance tickets automatically via WhatsApp.',
        'property_guest_concierge',
        'End-to-End Automation',
        'sent',
        4,
        JSON.stringify([
          { name: 'Mayfair Haven Serviced Suites', phone: '+447700900789', contact: 'Eleanor Vance' },
          { name: 'Vanguard Property Partners', phone: '+447700900345', contact: 'Victoria Cross' },
          { name: 'Abbey Gate Letting Agents', phone: '+447700900334', contact: 'Simon Thorne' },
          { name: 'Cityscape Executive Lets', phone: '+447700900223', contact: 'Rachel Adams' },
        ]),
        daysAgo(1),
        waDb2Id,
        'Serviced Accommodation Property Operators',
        PROFILES.manikandan,
        daysAgo(2),
      ]
    );
    const waCamp2Id = waCamp2Res.rows[0].id;

    // WhatsApp Campaign 3: Draft
    await client.query(
      `INSERT INTO "sales-pipe".whatsapp_campaigns (
        name, message, template_name, service, status, recipient_count, recipients,
        created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        'Weekend Specials Alert for Pubs',
        'Hi {{contact_name}}, ready for the weekend rush at {{business_name}}? Here is a quick blueprint for automated Sunday Roast table bookings via WhatsApp.',
        'pub_weekend_event',
        'Website',
        'draft',
        3,
        JSON.stringify([
          { name: 'The Black Swan Public House', phone: '+447700900112' },
          { name: 'The Old Crown Tavern', phone: '+447700900990' },
          { name: 'The Rusty Anchor Tavern', phone: '+447700900890' },
        ]),
        PROFILES.admin,
        daysAgo(1),
      ]
    );

    // WhatsApp Campaign 4: Scheduled
    await client.query(
      `INSERT INTO "sales-pipe".whatsapp_campaigns (
        name, message, template_name, service, status, recipient_count, recipients,
        scheduled_at, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        'Hospitality Direct Outreach Sprint',
        'Hi {{contact_name}}, quick heads-up on our new automation sprint for local hospitality businesses in {{area}}.',
        'hospitality_monthly_check',
        'Cold Outreach',
        'scheduled',
        6,
        JSON.stringify([
          { name: 'The Grand Pavilion Hotel', phone: '+447700900123' },
          { name: 'Highland View Guesthouse', phone: '+447700900234' },
          { name: 'The Royal Oak Inn & Spa', phone: '+447700900678' },
          { name: 'Lakeside Country House Hotel', phone: '+447700900556' },
          { name: 'The Copper Kettle Alehouse', phone: '+447700900456' },
          { name: 'Vanguard Property Partners', phone: '+447700900345' },
        ]),
        daysAhead(2),
        PROFILES.admin,
        daysAgo(1),
      ]
    );

    // 6. Insert Email Campaign Recipients & Replies
    console.log('Inserting Email Recipients and Replies...');

    // Email Camp 1 Recipients
    const e1Targets = [
      { name: 'The Grand Pavilion Hotel', status: 'sent', deliv: 'delivered' },
      { name: 'Highland View Guesthouse', status: 'sent', deliv: 'read', replied: true },
      { name: 'The Royal Oak Inn & Spa', status: 'sent', deliv: 'read' },
      { name: 'Lakeside Country House Hotel', status: 'sent', deliv: 'delivered' },
      { name: 'Beacon Hill Country Lodge', status: 'sent', deliv: 'read', optOut: true },
    ];

    for (const t of e1Targets) {
      const b = byName[t.name];
      if (!b) continue;

      const rRes = await client.query(
        `INSERT INTO "sales-pipe".campaign_recipients (
          campaign_id, business_id, email, phone, business_name, contact_name,
          channel, status, delivery_status, sent_at, delivered_at, read_at, replied_at, opted_out_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
        [
          emailCamp1Id,
          b.id,
          b.email,
          b.whatsapp_number,
          b.business_name,
          b.contact_name,
          'email',
          t.status,
          t.deliv,
          daysAgo(4),
          daysAgo(4),
          daysAgo(3),
          t.replied ? daysAgo(3) : null,
          t.optOut ? daysAgo(3) : null,
        ]
      );
      const recipientId = rRes.rows[0].id;

      if (t.replied) {
        await client.query(
          `INSERT INTO "sales-pipe".campaign_replies (
            channel, from_address, subject, body, campaign_id, recipient_id,
            business_id, opportunity_id, thread_id, status, intent, intent_matched, received_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            'email',
            b.email,
            'Re: Direct bookings without OTA commissions for Highland View Guesthouse',
            'Hi there, thanks for reaching out. We are currently paying a small fortune to Booking.com and Expedia each month. Would love to see a demo of your direct booking engine and how it fits with our current diary. Best, Hamish',
            emailCamp1Id,
            recipientId,
            b.id,
            b.opportunity_id,
            b.email_thread_id,
            'in_leads',
            'interested',
            'interested',
            daysAgo(3),
          ]
        );
      }

      if (t.optOut) {
        await client.query(
          `INSERT INTO "sales-pipe".campaign_replies (
            channel, from_address, subject, body, campaign_id, recipient_id,
            business_id, opportunity_id, thread_id, status, intent, intent_matched, received_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            'email',
            b.email,
            'Re: Direct bookings without OTA commissions',
            'Please remove us from your mailing list. The lodge is currently closing for refurbishment.',
            emailCamp1Id,
            recipientId,
            b.id,
            b.opportunity_id,
            b.email_thread_id,
            'dismissed',
            'opt_out',
            'opt_out',
            daysAgo(3),
          ]
        );
      }
    }

    // Email Camp 2 Recipients
    const e2Targets = [
      { name: 'The Copper Kettle Alehouse', status: 'sent', deliv: 'delivered' },
      { name: 'Harbor Light Seafood Bistro', status: 'sent', deliv: 'read', replied: true },
      { name: 'Olive & Stone Pizzeria', status: 'sent', deliv: 'read' },
      { name: 'The Rusty Anchor Tavern', status: 'sent', deliv: 'delivered' },
    ];

    for (const t of e2Targets) {
      const b = byName[t.name];
      if (!b) continue;

      const rRes = await client.query(
        `INSERT INTO "sales-pipe".campaign_recipients (
          campaign_id, business_id, email, phone, business_name, contact_name,
          channel, status, delivery_status, sent_at, delivered_at, read_at, replied_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [
          emailCamp2Id,
          b.id,
          b.email,
          b.whatsapp_number,
          b.business_name,
          b.contact_name,
          'email',
          t.status,
          t.deliv,
          daysAgo(2),
          daysAgo(2),
          daysAgo(1),
          t.replied ? daysAgo(1) : null,
        ]
      );
      const recipientId = rRes.rows[0].id;

      if (t.replied) {
        await client.query(
          `INSERT INTO "sales-pipe".campaign_replies (
            channel, from_address, subject, body, campaign_id, recipient_id,
            business_id, opportunity_id, thread_id, status, intent, intent_matched, received_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            'email',
            b.email,
            'Re: Quick question regarding peak table bookings at Harbor Light Seafood Bistro',
            'Hello! We lose quite a few covers to Friday night no-shows. How does your automated reminder system work? Can we set a 24-hour deposit policy through it? Marcus',
            emailCamp2Id,
            recipientId,
            b.id,
            b.opportunity_id,
            b.email_thread_id,
            'new',
            'question',
            'question',
            daysAgo(1),
          ]
        );
      }
    }

    // 7. Insert WhatsApp Campaign Recipients & Replies
    console.log('Inserting WhatsApp Recipients and Replies...');

    // WhatsApp Camp 1 Recipients
    const wa1Targets = [
      { name: 'Olive & Stone Pizzeria', status: 'sent', deliv: 'read', replied: true },
      { name: 'Harbor Light Seafood Bistro', status: 'sent', deliv: 'delivered' },
      { name: 'The Copper Kettle Alehouse', status: 'sent', deliv: 'read' },
      { name: 'The Daily Grind Espresso Bar', status: 'sent', deliv: 'delivered' },
      { name: 'Saffron Lounge Brasserie', status: 'sent', deliv: 'read', optOut: true },
    ];

    for (const t of wa1Targets) {
      const b = byName[t.name];
      if (!b) continue;

      const rRes = await client.query(
        `INSERT INTO "sales-pipe".campaign_recipients (
          whatsapp_campaign_id, business_id, email, phone, business_name, contact_name,
          channel, status, delivery_status, sent_at, delivered_at, read_at, replied_at, opted_out_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
        [
          waCamp1Id,
          b.id,
          b.email,
          b.whatsapp_number,
          b.business_name,
          b.contact_name,
          'whatsapp',
          t.status,
          t.deliv,
          daysAgo(3),
          daysAgo(3),
          daysAgo(2),
          t.replied ? daysAgo(2) : null,
          t.optOut ? daysAgo(2) : null,
        ]
      );
      const recipientId = rRes.rows[0].id;

      if (t.replied) {
        await client.query(
          `INSERT INTO "sales-pipe".campaign_replies (
            channel, from_address, subject, body, whatsapp_campaign_id, recipient_id,
            business_id, opportunity_id, thread_id, status, intent, intent_matched, received_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            'whatsapp',
            b.whatsapp_number,
            'WhatsApp Message Reply',
            'Sounds very interesting. Friday no-shows are a big headache for our kitchen. What is the pricing setup for a single restaurant team?',
            waCamp1Id,
            recipientId,
            b.id,
            b.opportunity_id,
            b.wa_thread_id,
            'in_leads',
            'interested',
            'interested',
            daysAgo(2),
          ]
        );
      }

      if (t.optOut) {
        await client.query(
          `INSERT INTO "sales-pipe".campaign_replies (
            channel, from_address, subject, body, whatsapp_campaign_id, recipient_id,
            business_id, opportunity_id, thread_id, status, intent, intent_matched, received_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            'whatsapp',
            b.whatsapp_number,
            'WhatsApp Message Reply',
            'STOP',
            waCamp1Id,
            recipientId,
            b.id,
            b.opportunity_id,
            b.wa_thread_id,
            'dismissed',
            'opt_out',
            'opt_out',
            daysAgo(2),
          ]
        );
      }
    }

    // WhatsApp Camp 2 Recipients
    const wa2Targets = [
      { name: 'Mayfair Haven Serviced Suites', status: 'sent', deliv: 'read' },
      { name: 'Vanguard Property Partners', status: 'sent', deliv: 'read', replied: true },
      { name: 'Abbey Gate Letting Agents', status: 'sent', deliv: 'delivered' },
      { name: 'Cityscape Executive Lets', status: 'sent', deliv: 'delivered' },
    ];

    for (const t of wa2Targets) {
      const b = byName[t.name];
      if (!b) continue;

      const rRes = await client.query(
        `INSERT INTO "sales-pipe".campaign_recipients (
          whatsapp_campaign_id, business_id, email, phone, business_name, contact_name,
          channel, status, delivery_status, sent_at, delivered_at, read_at, replied_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [
          waCamp2Id,
          b.id,
          b.email,
          b.whatsapp_number,
          b.business_name,
          b.contact_name,
          'whatsapp',
          t.status,
          t.deliv,
          daysAgo(1),
          daysAgo(1),
          daysAgo(1),
          t.replied ? daysAgo(1) : null,
        ]
      );
      const recipientId = rRes.rows[0].id;

      if (t.replied) {
        await client.query(
          `INSERT INTO "sales-pipe".campaign_replies (
            channel, from_address, subject, body, whatsapp_campaign_id, recipient_id,
            business_id, opportunity_id, thread_id, status, intent, intent_matched, received_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            'whatsapp',
            b.whatsapp_number,
            'WhatsApp Message Reply',
            'Hi! Can this guest concierge integrate directly with our channel manager or do we need to set up a custom webhook for each unit?',
            waCamp2Id,
            recipientId,
            b.id,
            b.opportunity_id,
            b.wa_thread_id,
            'new',
            'question',
            'question',
            daysAgo(1),
          ]
        );
      }
    }

    await client.query('COMMIT');
    console.log('\nSuccessfully seeded all email and WhatsApp campaigns, databases, recipients, and replies!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding campaigns, transaction rolled back:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedCampaigns();
