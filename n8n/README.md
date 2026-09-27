# n8n Daily Sales Follow-up Workflow

This folder contains a partial export of the n8n workflow for the Sales Pipeline Dashboard.

## Setup Instructions

1. **Import the workflow**
   - In n8n, create a new workflow.
   - Click the options menu (three dots) in the top right and select **Import from File**.
   - Select `sales-follow-ups-daily.json`.

2. **Configure Environment Variables in n8n**
   - Ensure your n8n instance has the following environment variables configured, or replace the expressions in the HTTP Request nodes with your actual values:
     - `SUPABASE_URL`: Your Supabase Project URL
     - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (Do NOT use the anon key!)

3. **Complete the Workflow**
   - The imported JSON provides the basic structure: Schedule Trigger -> Get Leads -> Switch -> Final Check (Lost).
   - You need to complete the other branches of the Switch node:
     - **Branch 1 (Won):** Add a Supabase HTTP Request node to insert a task for an upsell reminder into the `tasks` table.
     - **Branch 2 (Email):** Add an Email Send node (SMTP or Gmail). Set the recipient to `{{$json["email"]}}`. After the email node, add a Supabase HTTP Request node calling `/rest/v1/rpc/record_outreach` with `p_action = 'sent'`.
     - **Branch 3 (Fallback/WhatsApp/Phone):** Add a Supabase HTTP Request node to insert a manual follow-up task into the `tasks` table with `task_type = 'sales_followup'`.

4. **Testing**
   - Use the test leads created by `seed.sql` to verify the logic.
   - You can execute the workflow manually in n8n using the "Execute Workflow" button to test the different branches.
