-- Seed Templates
INSERT INTO templates (name, subject, body) VALUES
('Introductory Email', 'Welcome to Selfera', 'Hi {business_name}, we are excited to have you on board! Reply to this email to get started.'),
('Follow Up 1', 'Checking in - Selfera', 'Hi {business_name}, did you get a chance to review our previous email? Let me know if you have any questions.'),
('Follow Up 2', 'Final Check in - Selfera', 'Hi {business_name}, I haven''t heard back so I will assume this is not a priority right now. Feel free to reach out when you are ready!');

-- The guide says:
-- "Add a test lead with your own email, channel = Email, and a test lead with channel = WhatsApp."
-- We will insert test leads (note: assigned_to is left null, assuming it handles null)

INSERT INTO leads (business_name, email, channel, stage, next_follow_up) VALUES
('Test Company (Email)', 'kesav@example.com', 'Email', 'New', CURRENT_DATE),
('Test Company (WhatsApp)', '+447000000000', 'WhatsApp', 'New', CURRENT_DATE);
