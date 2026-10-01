const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.thqtmbsnvsabcqsywgcu:Selfera%40123%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const { rows } = await client.query('SELECT id, full_name, email FROM "sales-pipe".profiles');
  console.table(rows);
  await client.end();
}
run();
