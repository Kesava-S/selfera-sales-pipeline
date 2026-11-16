const { Client } = require('pg');

async function seed() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('Connected to database. Starting transaction...');
  await client.query('BEGIN');

  try {
    const PROFILES = {
      admin: '5df6ec65-dbb4-418c-ab7a-c1034fcd80aa', // Admin
      kesav: 'de225853-f48f-49fe-8c9d-61c32a2d7254', // Kesav
      manikandan: 'f0736280-6801-40c5-b371-9808044f2a7d', // manikandan
      sakthivel: 'c50727b1-9a21-4fdf-aaee-f931522e7599', // sakthivel
      suresh: 'b53cfb84-c092-4775-96fa-9e7a28ca58a4', // suresh
      muthukumar: '4699b340-c7f5-449a-90e3-adb9c74b6fba', // Muthukumar (consultant)
    };

    const now = new Date();
    const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
    const daysAhead = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString();
    const dateAhead = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const leads = [
      // 1. Needs review (Ready / Approval Queue)
      {
        business: {
          business_name: 'The Grand Pavilion Hotel',
          category: 'Hotel',
          business_type: 'Hotel',
          tier: '4-5 star',
          room_count: 48,
          area: 'London',
          address: '12 Queens Gardens, Bayswater',
          postcode: 'W2 3BB',
          maps_link: 'https://maps.google.com/?q=The+Grand+Pavilion+Hotel+London',
          google_rating: 4.6,
          google_reviews_count: 320,
          phone: '+44 20 7946 0123',
          whatsapp_number: '+447700900123',
          email: 'info@grandpavilionhotel.co.uk',
          existing_website: 'https://www.grandpavilionhotel.co.uk',
          company_type: 'Limited company',
          contact_name: 'Alistair Finch',
        },
        opportunity: {
          stage: 'Needs review',
          services_pitched: ['Website', 'Custom Dashboard'],
          assigned_sales_id: PROFILES.kesav,
        },
        threads: [
          { platform: 'Email', status: 'Not contacted', step: 0, next_due_on: dateAhead(1) },
          { platform: 'WhatsApp', status: 'Not contacted', step: 0, next_due_on: dateAhead(1) },
        ],
      },

      // 2. Needs review (Missing Contact / Missing Data tab)
      {
        business: {
          business_name: 'Brambles Cafe & Bakery',
          category: 'Restaurant or cafe',
          business_type: 'Restaurant or cafe',
          tier: null,
          room_count: null,
          area: 'Manchester',
          address: '45 Northern Quarter',
          postcode: 'M1 1WR',
          maps_link: 'https://maps.google.com/?q=Brambles+Cafe+Manchester',
          google_rating: 4.4,
          google_reviews_count: 145,
          phone: null,
          whatsapp_number: null,
          email: null,
          existing_website: null,
          company_type: 'Sole trader',
          contact_name: 'Claire Jenkins',
        },
        opportunity: {
          stage: 'Needs review',
          services_pitched: ['Micro Automation'],
          assigned_sales_id: PROFILES.manikandan,
        },
        threads: [],
      },

      // 3. Active
      {
        business: {
          business_name: 'The Copper Kettle Alehouse',
          category: 'Pub',
          business_type: 'Pub',
          tier: null,
          room_count: null,
          area: 'Bristol',
          address: '8 King Street',
          postcode: 'BS1 4PB',
          maps_link: 'https://maps.google.com/?q=The+Copper+Kettle+Bristol',
          google_rating: 4.5,
          google_reviews_count: 210,
          phone: '+44 117 496 0789',
          whatsapp_number: '+447700900456',
          email: 'cheers@copperkettlealehouse.co.uk',
          existing_website: 'https://www.copperkettlealehouse.co.uk',
          company_type: 'Limited company',
          contact_name: 'Dave Morrison',
        },
        opportunity: {
          stage: 'Active',
          services_pitched: ['Website', 'Cold Outreach'],
          assigned_sales_id: PROFILES.sakthivel,
        },
        threads: [
          { platform: 'Email', status: 'Awaiting reply', step: 1, next_due_on: dateAhead(3), last_outbound_at: daysAgo(1) },
        ],
      },

      // 4. Active
      {
        business: {
          business_name: 'Mayfair Haven Serviced Suites',
          category: 'Property management',
          business_type: 'Property management',
          tier: '4-5 star',
          room_count: 22,
          area: 'London',
          address: '18 Curzon Street, Mayfair',
          postcode: 'W1J 5HT',
          maps_link: 'https://maps.google.com/?q=Mayfair+Haven+London',
          google_rating: 4.8,
          google_reviews_count: 88,
          phone: '+44 20 7946 0345',
          whatsapp_number: '+447700900789',
          email: 'concierge@mayfairhaven.co.uk',
          existing_website: 'https://www.mayfairhaven.co.uk',
          company_type: 'Limited company',
          contact_name: 'Eleanor Vance',
        },
        opportunity: {
          stage: 'Active',
          services_pitched: ['Micro Automation'],
          assigned_sales_id: PROFILES.suresh,
        },
        threads: [
          { platform: 'WhatsApp', status: 'Awaiting reply', step: 1, next_due_on: dateAhead(2), last_outbound_at: daysAgo(2) },
        ],
      },

      // 5. Interested
      {
        business: {
          business_name: 'Highland View Guesthouse',
          category: 'Hotel',
          business_type: 'Hotel',
          tier: '3 star',
          room_count: 14,
          area: 'Edinburgh',
          address: '24 Royal Terrace',
          postcode: 'EH7 5AH',
          maps_link: 'https://maps.google.com/?q=Highland+View+Guesthouse+Edinburgh',
          google_rating: 4.7,
          google_reviews_count: 195,
          phone: '+44 131 496 0890',
          whatsapp_number: '+447700900234',
          email: 'enquiries@highlandviewgh.co.uk',
          existing_website: 'https://www.highlandviewgh.co.uk',
          company_type: 'Sole trader',
          contact_name: 'Hamish MacLeod',
        },
        opportunity: {
          stage: 'Interested',
          services_pitched: ['End-to-End Automation'],
          assigned_sales_id: PROFILES.kesav,
        },
        threads: [
          { platform: 'Email', status: 'Replied', step: 2, last_inbound_at: daysAgo(1), last_outbound_at: daysAgo(2), last_reply_intent: 'Positive Interest' },
        ],
      },

      // 6. Interested
      {
        business: {
          business_name: 'Harbor Light Seafood Bistro',
          category: 'Restaurant or cafe',
          business_type: 'Restaurant or cafe',
          tier: null,
          room_count: null,
          area: 'Bristol',
          address: '14 Harbourside Promenade',
          postcode: 'BS1 5LL',
          maps_link: 'https://maps.google.com/?q=Harbor+Light+Seafood+Bristol',
          google_rating: 4.6,
          google_reviews_count: 412,
          phone: '+44 117 496 0123',
          whatsapp_number: '+447700900567',
          email: 'bookings@harborlightbistro.co.uk',
          existing_website: 'https://www.harborlightbistro.co.uk',
          company_type: 'Partnership',
          contact_name: 'Marcus Bell',
        },
        opportunity: {
          stage: 'Interested',
          services_pitched: ['Website', 'Micro Automation'],
          assigned_sales_id: PROFILES.manikandan,
        },
        threads: [
          { platform: 'WhatsApp', status: 'Replied', step: 2, last_inbound_at: daysAgo(1), last_outbound_at: daysAgo(3), last_reply_intent: 'Demo Request' },
        ],
      },

      // 7. Consultation
      {
        business: {
          business_name: 'The Rusty Anchor Tavern',
          category: 'Pub',
          business_type: 'Pub',
          tier: null,
          room_count: null,
          area: 'Liverpool',
          address: '22 Albert Dock',
          postcode: 'L3 4AA',
          maps_link: 'https://maps.google.com/?q=The+Rusty+Anchor+Liverpool',
          google_rating: 4.3,
          google_reviews_count: 180,
          phone: '+44 151 496 0567',
          whatsapp_number: '+447700900890',
          email: 'contact@rustyanchortavern.co.uk',
          existing_website: 'https://www.rustyanchortavern.co.uk',
          company_type: 'Limited company',
          contact_name: "Patrick O'Connor",
        },
        opportunity: {
          stage: 'Consultation',
          services_pitched: ['End-to-End Automation'],
          assigned_sales_id: PROFILES.sakthivel,
          assigned_consultant_id: PROFILES.muthukumar,
          consultation_at: daysAhead(1),
        },
        threads: [
          { platform: 'Email', status: 'Replied', step: 2, last_inbound_at: daysAgo(1), last_outbound_at: daysAgo(2) },
        ],
      },

      // 8. Consultation
      {
        business: {
          business_name: 'Vanguard Property Partners',
          category: 'Property management',
          business_type: 'Property management',
          tier: null,
          room_count: 35,
          area: 'Birmingham',
          address: '77 Colmore Row',
          postcode: 'B3 2AA',
          maps_link: 'https://maps.google.com/?q=Vanguard+Property+Partners+Birmingham',
          google_rating: 4.7,
          google_reviews_count: 64,
          phone: '+44 121 496 0234',
          whatsapp_number: '+447700900345',
          email: 'partners@vanguardproperty.co.uk',
          existing_website: 'https://www.vanguardproperty.co.uk',
          company_type: 'Limited company',
          contact_name: 'Victoria Cross',
        },
        opportunity: {
          stage: 'Consultation',
          services_pitched: ['Custom Dashboard', 'End-to-End Automation'],
          assigned_sales_id: PROFILES.suresh,
          assigned_consultant_id: PROFILES.muthukumar,
          consultation_at: daysAhead(2),
        },
        threads: [
          { platform: 'WhatsApp', status: 'Replied', step: 2, last_inbound_at: daysAgo(2), last_outbound_at: daysAgo(3) },
        ],
      },

      // 9. Won
      {
        business: {
          business_name: 'The Royal Oak Inn & Spa',
          category: 'Hotel',
          business_type: 'Hotel',
          tier: '4-5 star',
          room_count: 28,
          area: 'Oxford',
          address: '15 High Street',
          postcode: 'OX1 4DB',
          maps_link: 'https://maps.google.com/?q=Royal+Oak+Inn+Oxford',
          google_rating: 4.8,
          google_reviews_count: 530,
          phone: '+44 1865 496 0678',
          whatsapp_number: '+447700900678',
          email: 'welcome@royaloakoxford.co.uk',
          existing_website: 'https://www.royaloakoxford.co.uk',
          company_type: 'Limited company',
          contact_name: 'George Sterling',
        },
        opportunity: {
          stage: 'Won',
          services_pitched: ['Website', 'Micro Automation'],
          services_won: ['Website'],
          conversion_type: 'Narrowed',
          converted_through: 'Direct from outreach',
          won_at: daysAgo(3),
          assigned_sales_id: PROFILES.kesav,
        },
        threads: [
          { platform: 'Email', status: 'Replied', step: 2, last_inbound_at: daysAgo(4) },
        ],
      },

      // 10. Won
      {
        business: {
          business_name: 'Olive & Stone Pizzeria',
          category: 'Restaurant or cafe',
          business_type: 'Restaurant or cafe',
          tier: null,
          room_count: null,
          area: 'Leeds',
          address: '33 Briggate',
          postcode: 'LS1 6HD',
          maps_link: 'https://maps.google.com/?q=Olive+and+Stone+Pizza+Leeds',
          google_rating: 4.7,
          google_reviews_count: 610,
          phone: '+44 113 496 0345',
          whatsapp_number: '+447700900901',
          email: 'hello@olivestonepizza.co.uk',
          existing_website: 'https://www.olivestonepizza.co.uk',
          company_type: 'Limited company',
          contact_name: 'Matteo Rossi',
        },
        opportunity: {
          stage: 'Won',
          services_pitched: ['Micro Automation'],
          services_won: ['Micro Automation'],
          conversion_type: 'As pitched',
          converted_through: 'Consultation',
          won_at: daysAgo(7),
          assigned_sales_id: PROFILES.manikandan,
          assigned_consultant_id: PROFILES.muthukumar,
        },
        threads: [
          { platform: 'WhatsApp', status: 'Replied', step: 2, last_inbound_at: daysAgo(8) },
        ],
      },

      // 11. Went cold
      {
        business: {
          business_name: 'The Black Swan Public House',
          category: 'Pub',
          business_type: 'Pub',
          tier: null,
          room_count: null,
          area: 'York',
          address: '9 Peasholme Green',
          postcode: 'YO1 7PW',
          maps_link: 'https://maps.google.com/?q=The+Black+Swan+York',
          google_rating: 4.4,
          google_reviews_count: 290,
          phone: '+44 1904 496 0123',
          whatsapp_number: '+447700900112',
          email: 'info@blackswanyork.co.uk',
          existing_website: 'https://www.blackswanyork.co.uk',
          company_type: 'Partnership',
          contact_name: 'Arthur Pendelton',
        },
        opportunity: {
          stage: 'Went cold',
          services_pitched: ['Cold Outreach'],
          closed_at: daysAgo(10),
          assigned_sales_id: PROFILES.sakthivel,
        },
        threads: [
          { platform: 'Email', status: 'No reply', step: 3, last_outbound_at: daysAgo(12) },
        ],
      },

      // 12. Went cold
      {
        business: {
          business_name: 'Abbey Gate Letting Agents',
          category: 'Property management',
          business_type: 'Property management',
          tier: null,
          room_count: 45,
          area: 'Bath',
          address: '12 Milsom Street',
          postcode: 'BA1 1DE',
          maps_link: 'https://maps.google.com/?q=Abbey+Gate+Bath',
          google_rating: 4.1,
          google_reviews_count: 73,
          phone: '+44 1225 496 0789',
          whatsapp_number: '+447700900334',
          email: 'lettings@abbeygatebath.co.uk',
          existing_website: 'https://www.abbeygatebath.co.uk',
          company_type: 'Limited company',
          contact_name: 'Simon Thorne',
        },
        opportunity: {
          stage: 'Went cold',
          services_pitched: ['Micro Automation'],
          closed_at: daysAgo(14),
          assigned_sales_id: PROFILES.suresh,
        },
        threads: [
          { platform: 'WhatsApp', status: 'No reply', step: 3, last_outbound_at: daysAgo(15) },
        ],
      },

      // 13. No response
      {
        business: {
          business_name: 'Lakeside Country House Hotel',
          category: 'Hotel',
          business_type: 'Hotel',
          tier: '3 star',
          room_count: 18,
          area: 'Windermere',
          address: '5 Lake Road',
          postcode: 'LA23 1AD',
          maps_link: 'https://maps.google.com/?q=Lakeside+Country+House+Windermere',
          google_rating: 4.5,
          google_reviews_count: 174,
          phone: '+44 1539 496 0456',
          whatsapp_number: '+447700900556',
          email: 'stay@lakesidecountryhouse.co.uk',
          existing_website: 'https://www.lakesidecountryhouse.co.uk',
          company_type: 'Limited company',
          contact_name: 'Fiona Gallagher',
        },
        opportunity: {
          stage: 'No response',
          services_pitched: ['Website'],
          closed_at: daysAgo(20),
          assigned_sales_id: PROFILES.kesav,
        },
        threads: [
          { platform: 'Email', status: 'No reply', step: 4, last_outbound_at: daysAgo(22) },
        ],
      },

      // 14. No response
      {
        business: {
          business_name: 'The Daily Grind Espresso Bar',
          category: 'Restaurant or cafe',
          business_type: 'Restaurant or cafe',
          tier: null,
          room_count: null,
          area: 'Newcastle',
          address: '88 Grey Street',
          postcode: 'NE1 6AF',
          maps_link: 'https://maps.google.com/?q=The+Daily+Grind+Newcastle',
          google_rating: 4.6,
          google_reviews_count: 320,
          phone: '+44 191 496 0678',
          whatsapp_number: '+447700900778',
          email: 'coffee@dailygrindespresso.co.uk',
          existing_website: 'https://www.dailygrindespresso.co.uk',
          company_type: 'Sole trader',
          contact_name: 'Liam Henderson',
        },
        opportunity: {
          stage: 'No response',
          services_pitched: ['Cold Outreach'],
          closed_at: daysAgo(25),
          assigned_sales_id: PROFILES.manikandan,
        },
        threads: [
          { platform: 'Instagram', status: 'No reply', step: 4, last_outbound_at: daysAgo(26) },
        ],
      },

      // 15. Declined
      {
        business: {
          business_name: 'The Old Crown Tavern',
          category: 'Pub',
          business_type: 'Pub',
          tier: null,
          room_count: null,
          area: 'Chester',
          address: '11 Eastgate Street',
          postcode: 'CH1 1LG',
          maps_link: 'https://maps.google.com/?q=The+Old+Crown+Chester',
          google_rating: 4.2,
          google_reviews_count: 140,
          phone: '+44 1244 496 0234',
          whatsapp_number: '+447700900990',
          email: 'landlord@oldcrowntavern.co.uk',
          existing_website: 'https://www.oldcrowntavern.co.uk',
          company_type: 'Sole trader',
          contact_name: 'Robert Hayes',
        },
        opportunity: {
          stage: 'Declined',
          services_pitched: ['Custom Dashboard'],
          closed_at: daysAgo(5),
          assigned_sales_id: PROFILES.sakthivel,
        },
        threads: [
          { platform: 'Email', status: 'Opted out', step: 2, last_outbound_at: daysAgo(6) },
        ],
      },

      // 16. Declined
      {
        business: {
          business_name: 'Cityscape Executive Lets',
          category: 'Property management',
          business_type: 'Property management',
          tier: null,
          room_count: 25,
          area: 'Sheffield',
          address: '52 West Street',
          postcode: 'S1 4EP',
          maps_link: 'https://maps.google.com/?q=Cityscape+Executive+Lets+Sheffield',
          google_rating: 4.3,
          google_reviews_count: 52,
          phone: '+44 114 496 0890',
          whatsapp_number: '+447700900223',
          email: 'hello@cityscapelets.co.uk',
          existing_website: 'https://www.cityscapelets.co.uk',
          company_type: 'Limited company',
          contact_name: 'Rachel Adams',
        },
        opportunity: {
          stage: 'Declined',
          services_pitched: ['Micro Automation'],
          closed_at: daysAgo(8),
          assigned_sales_id: PROFILES.suresh,
        },
        threads: [
          { platform: 'WhatsApp', status: 'Opted out', step: 1, last_outbound_at: daysAgo(9) },
        ],
      },

      // 17. Do not contact
      {
        business: {
          business_name: 'Beacon Hill Country Lodge',
          category: 'Hotel',
          business_type: 'Hotel',
          tier: '3 star',
          room_count: 16,
          area: 'Guildford',
          address: '7 Beacon Hill Road',
          postcode: 'GU2 7PX',
          maps_link: 'https://maps.google.com/?q=Beacon+Hill+Lodge+Guildford',
          google_rating: 3.9,
          google_reviews_count: 42,
          phone: '+44 1483 496 0123',
          whatsapp_number: '+447700900445',
          email: 'reception@beaconhilllodge.co.uk',
          existing_website: 'https://www.beaconhilllodge.co.uk',
          company_type: 'Sole trader',
          contact_name: 'Graham Ward',
          off_target_at: daysAgo(2),
          off_target_reason: 'not_a_fit',
          off_target_noticed: 'outreach',
          off_target_note: 'Permanently closed or no longer trading',
        },
        opportunity: {
          stage: 'Do not contact',
          services_pitched: ['Website'],
          closed_at: daysAgo(2),
          assigned_sales_id: PROFILES.admin,
        },
        threads: [
          { platform: 'Email', status: 'Opted out', step: 1, last_outbound_at: daysAgo(3) },
        ],
      },

      // 18. Do not contact
      {
        business: {
          business_name: 'Saffron Lounge Brasserie',
          category: 'Restaurant or cafe',
          business_type: 'Restaurant or cafe',
          tier: null,
          room_count: null,
          area: 'Cardiff',
          address: '19 Mill Lane',
          postcode: 'CF10 1FL',
          maps_link: 'https://maps.google.com/?q=Saffron+Lounge+Cardiff',
          google_rating: 4.1,
          google_reviews_count: 98,
          phone: '+44 29 2094 6012',
          whatsapp_number: '+447700900667',
          email: 'manager@saffronloungecardiff.co.uk',
          existing_website: 'https://www.saffronloungecardiff.co.uk',
          company_type: 'Limited company',
          contact_name: 'Tariq Mahmood',
          off_target_at: daysAgo(4),
          off_target_reason: 'unrelated',
          off_target_noticed: 'campaign',
          off_target_note: 'Requested removal from all marketing',
        },
        opportunity: {
          stage: 'Do not contact',
          services_pitched: ['Cold Outreach'],
          closed_at: daysAgo(4),
          assigned_sales_id: PROFILES.kesav,
        },
        threads: [
          { platform: 'WhatsApp', status: 'Opted out', step: 1, last_outbound_at: daysAgo(5) },
        ],
      },
    ];

    console.log(`Inserting ${leads.length} leads...`);

    for (let i = 0; i < leads.length; i++) {
      const item = leads[i];
      const b = item.business;
      const o = item.opportunity;

      // 1. Insert business
      const bRes = await client.query(
        `INSERT INTO "sales-pipe".businesses (
          business_name, category, business_type, tier, room_count, area, address, postcode,
          maps_link, google_rating, google_reviews_count, phone, whatsapp_number, email,
          existing_website, company_type, contact_name, off_target_at, off_target_reason,
          off_target_noticed, off_target_note
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21
        ) RETURNING id`,
        [
          b.business_name,
          b.category,
          b.business_type,
          b.tier || null,
          b.room_count || null,
          b.area || null,
          b.address || null,
          b.postcode || null,
          b.maps_link || null,
          b.google_rating || null,
          b.google_reviews_count || null,
          b.phone || null,
          b.whatsapp_number || null,
          b.email || null,
          b.existing_website || null,
          b.company_type || 'Unknown',
          b.contact_name || null,
          b.off_target_at || null,
          b.off_target_reason || null,
          b.off_target_noticed || null,
          b.off_target_note || null,
        ]
      );

      const businessId = bRes.rows[0].id;

      // 2. Insert opportunity
      const oRes = await client.query(
        `INSERT INTO "sales-pipe".opportunities (
          business_id, stage, services_pitched, services_won, conversion_type, converted_through,
          assigned_sales_id, assigned_consultant_id, consultation_at, won_at, closed_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11
        ) RETURNING id`,
        [
          businessId,
          o.stage,
          o.services_pitched,
          o.services_won || null,
          o.conversion_type || null,
          o.converted_through || null,
          o.assigned_sales_id || null,
          o.assigned_consultant_id || null,
          o.consultation_at || null,
          o.won_at || null,
          o.closed_at || null,
        ]
      );

      const oppId = oRes.rows[0].id;

      // 3. Insert threads
      for (const t of item.threads) {
        await client.query(
          `INSERT INTO "sales-pipe".threads (
            opportunity_id, platform, status, step, next_due_on,
            last_outbound_at, last_inbound_at, last_reply_intent
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8
          )`,
          [
            oppId,
            t.platform,
            t.status || 'Not contacted',
            t.step || 0,
            t.next_due_on || null,
            t.last_outbound_at || null,
            t.last_inbound_at || null,
            t.last_reply_intent || null,
          ]
        );
      }

      console.log(`[${i + 1}/${leads.length}] Inserted: ${b.business_name} (${b.business_type}) -> ${o.stage}`);
    }

    await client.query('COMMIT');
    console.log('\nAll 18 anonymous leads successfully committed to database!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding leads, transaction rolled back:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
