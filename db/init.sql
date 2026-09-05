-- Lou's Place Referral Navigator — canonical schema + demo seed
CREATE TABLE services (
  id serial PRIMARY KEY,
  name text NOT NULL,
  service_types text[] NOT NULL,
  description text,
  suburb text,
  address text,
  latitude double precision,
  longitude double precision,
  eligibility text,
  minimum_age integer,
  maximum_age integer,
  children_allowed boolean,
  opening_hours text,
  walk_in_allowed boolean,
  appointment_required boolean,
  referral_required boolean,
  phone text,
  email text,
  website text,
  source_url text,
  source_type text NOT NULL DEFAULT 'sample',
  last_verified_at timestamptz,
  verification_due_at timestamptz,
  verification_status text NOT NULL DEFAULT 'unverified',
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE source_fixtures (
  service_id integer PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
  content text NOT NULL,
  fixture_url text
);

CREATE TABLE verification_runs (
  id serial PRIMARY KEY,
  trigger text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  services_checked integer NOT NULL DEFAULT 0,
  matches integer NOT NULL DEFAULT 0,
  changes_detected integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  latency_ms integer
);

CREATE TABLE verification_changes (
  id serial PRIMARY KEY,
  service_id integer NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  field text NOT NULL,
  stored_value text,
  extracted_value text,
  source_url text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  verification_run_id integer REFERENCES verification_runs(id) ON DELETE SET NULL
);

CREATE TABLE referral_searches (
  id serial PRIMARY KEY,
  query text,
  parsed_criteria jsonb,
  corrected_criteria jsonb,
  result_ids integer[],
  selected_service_id integer,
  selected_after_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eval_results (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  result JSONB NOT NULL,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE import_runs (
  id serial PRIMARY KEY,
  filename text,
  imported_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  errors jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---- Sample services (clearly labelled, inner Sydney) ----
INSERT INTO services (name, service_types, description, suburb, address, latitude, longitude, eligibility, children_allowed, opening_hours, walk_in_allowed, appointment_required, referral_required, phone, email, website, source_url, last_verified_at, verification_due_at, verification_status, internal_notes) VALUES
('Redfern Women''s Refuge', ARRAY['emergency_accommodation'], 'Safe crisis accommodation for women escaping violence or homelessness.', 'Redfern', '12 Pitt Street, Redfern NSW 2016', -33.893, 151.205, 'Women aged 18+ experiencing homelessness or domestic violence', true, '24 hours, 7 days', true, false, false, '02 9699 0001', 'contact@refuge-example.org', 'https://example.org/redfern-womens-refuge', 'https://example.org/redfern-womens-refuge', now() - interval '3 days', now() + interval '11 days', 'verified', 'Sample record for MVP demo'),
('Waterloo Crisis Accommodation', ARRAY['emergency_accommodation'], 'Crisis beds for women, agency referral preferred.', 'Waterloo', '8 Raglan Street, Waterloo NSW 2017', -33.900, 151.210, 'Women aged 18+ in crisis; agency referral preferred', true, '24 hours, 7 days', true, false, true, '02 9699 0002', 'contact@waterloo-crisis-example.org', 'https://example.org/waterloo-crisis-accommodation', 'https://example.org/waterloo-crisis-accommodation', now() - interval '2 days', now() + interval '12 days', 'verified', 'Sample record for MVP demo'),
('Sanctuary House Emergency Beds', ARRAY['emergency_accommodation'], 'Overnight crisis beds for single women.', 'Surry Hills', '45 Crown Street, Surry Hills NSW 2010', -33.886, 151.212, 'Single women aged 18+, no children', false, '24 hours, 7 days', true, false, false, '02 9699 0003', 'info@sanctuaryhouse-example.org', 'https://example.org/sanctuary-house', 'https://example.org/sanctuary-house', now() - interval '10 days', now() + interval '4 days', 'verified', 'Sample record for MVP demo'),
('Western Sydney Women''s Refuge', ARRAY['emergency_accommodation'], 'Refuge accommodation for women and children in western Sydney.', 'Parramatta', '3 Macquarie Street, Parramatta NSW 2150', -33.814, 151.001, 'Women and children escaping domestic violence in western Sydney', true, '24 hours, 7 days', false, false, true, '02 9699 0004', 'contact@wswr-example.org', 'https://example.org/western-sydney-womens-refuge', 'https://example.org/western-sydney-womens-refuge', now() - interval '1 day', now() + interval '13 days', 'verified', 'Sample record for MVP demo'),
('Staying Home Safely', ARRAY['transitional_housing'], 'Support for women leaving violence who can safely remain in their own home.', 'Glebe', '20 St Johns Road, Glebe NSW 2037', -33.879, 151.185, 'Women leaving DFV assessed as safe to stay in their home', true, 'Mon–Fri 9am–5pm', false, true, false, '02 9699 0005', 'info@stayinghome-example.org', 'https://example.org/staying-home-safely', 'https://example.org/staying-home-safely', now() - interval '6 days', now() + interval '8 days', 'verified', 'Sample record for MVP demo'),
('Inner City DFV Support Service', ARRAY['dfv_service'], 'Case support, safety planning and referrals for women experiencing DFV.', 'Redfern', '56 Lawson Street, Redfern NSW 2016', -33.892, 151.206, 'Women experiencing domestic or family violence', true, 'Mon–Fri 9am–5pm', true, false, false, '02 9699 0006', 'info@icdfv-example.org', 'https://example.org/inner-city-dfv-support', 'https://example.org/inner-city-dfv-support', now() - interval '5 days', now() + interval '9 days', 'verified', 'Sample record for MVP demo'),
('Crisis Support Line — DFV', ARRAY['dfv_service'], '24/7 telephone counselling and information about DFV services.', 'Surry Hills', 'Phone only', -33.886, 151.212, 'Anyone affected by domestic or family violence', NULL, '24 hours, 7 days', false, false, false, '1800 000 007', 'info@crisisline-example.org', 'https://example.org/dfv-crisis-line', 'https://example.org/dfv-crisis-line', now() - interval '4 days', now() + interval '10 days', 'verified', 'Sample record for MVP demo'),
('Bankstown DFV Case Support', ARRAY['dfv_service'], 'DFV case work, safety planning and outreach in Canterbury-Bankstown.', 'Bankstown', '14 Jacobs Avenue, Bankstown NSW 2200', -33.917, 151.030, 'Women in the Canterbury-Bankstown area', true, 'Mon–Fri 8:30am–4:30pm', false, true, false, '02 9699 0008', 'info@bankstowndfv-example.org', 'https://example.org/bankstown-dfv-case-support', 'https://example.org/bankstown-dfv-case-support', now() - interval '8 days', now() + interval '6 days', 'verified', 'Sample record for MVP demo'),
('Redfern Community Food Bank', ARRAY['food_assistance'], 'Free groceries and fresh food for households doing it tough.', 'Redfern', '119 Redfern Street, Redfern NSW 2016', -33.892, 151.207, 'Low-income households in inner Sydney', true, 'Mon–Sat 9am–12pm', true, false, false, '02 9699 1234', 'info@redfernfoodbank-example.org', 'https://example.org/redfern-community-food-bank', 'https://example.org/redfern-community-food-bank', now() - interval '21 days', now() - interval '7 days', 'needs_review', 'Sample record for MVP demo; phone drift seeded for demo'),
('Waterloo Food Distribution Centre', ARRAY['food_assistance'], 'Weekly food hampers, no questions asked.', 'Waterloo', '22 Cope Street, Waterloo NSW 2017', -33.900, 151.208, 'Anyone needing food relief', true, 'Mon, Wed, Fri 10am–2pm', true, false, false, '02 9699 0010', 'info@waterloofood-example.org', 'https://example.org/waterloo-food-distribution', 'https://example.org/waterloo-food-distribution', now() - interval '2 days', now() + interval '12 days', 'verified', 'Sample record for MVP demo'),
('Marrickville Meals Program', ARRAY['food_assistance'], 'Free cooked meals and food parcels in the inner west.', 'Marrickville', '304 Illawarra Road, Marrickville NSW 2204', -33.898, 151.147, 'Anyone in the inner west needing meals', true, 'Tue, Thu 11am–1pm', true, false, false, '02 9699 0011', 'info@marrickvillevelseals-example.org', 'https://example.org/marrickville-meals', 'https://example.org/marrickville-meals', now() - interval '12 days', now() + interval '2 days', 'verified', 'Sample record for MVP demo'),
('Ashfield Emergency Relief Hampers', ARRAY['food_assistance'], 'Food hampers by appointment for Ashfield households.', 'Ashfield', '9 Alt Street, Ashfield NSW 2131', -33.886, 151.127, 'Households in the Ashfield area, ID required', NULL, 'Mon–Fri 9am–3pm', false, true, false, '02 9699 0012', 'info@ashfieldrelief-example.org', 'https://example.org/ashfield-relief-hampers', 'https://example.org/ashfield-relief-hampers', now() - interval '30 days', now() - interval '16 days', 'unverified', 'Sample record for MVP demo'),
('Redfern Legal Centre', ARRAY['legal_assistance'], 'Free legal advice: tenancy, fines, family law, DFV matters.', 'Redfern', '73 Pitt Street, Redfern NSW 2016', -33.893, 151.207, 'Low-income residents of inner Sydney', NULL, 'Mon–Fri 9am–5pm (Tue until 7pm)', false, true, false, '02 9699 0013', 'info@redfernlegal-example.org', 'https://example.org/redfern-legal-centre', 'https://example.org/redfern-legal-centre', now() - interval '25 days', now() - interval '11 days', 'needs_review', 'Sample record; hours drift seeded for demo'),
('Sydney Women''s Legal Advice', ARRAY['legal_assistance'], 'Free legal advice for women on family law, DFV and tenancy.', 'Surry Hills', '86 Foveaux Street, Surry Hills NSW 2010', -33.886, 151.211, 'Women with family law, DFV or tenancy questions', NULL, 'Mon–Fri 9am–1pm', false, true, false, '02 9699 0014', 'info@swla-example.org', 'https://example.org/sydney-womens-legal-advice', 'https://example.org/sydney-womens-legal-advice', now() - interval '7 days', now() + interval '7 days', 'verified', 'Sample record for MVP demo'),
('Tenancy Advocacy Service', ARRAY['legal_assistance'], 'Advice and advocacy for renters facing eviction.', 'Newtown', '210 King Street, Newtown NSW 2042', -33.897, 151.178, 'Renters at risk of eviction in inner Sydney', NULL, 'Mon–Fri 9:30am–4pm', false, true, false, '02 9699 0015', 'info@tenancyadvocacy-example.org', 'https://example.org/tenancy-advocacy', 'https://example.org/tenancy-advocacy', now() - interval '9 days', now() + interval '5 days', 'verified', 'Sample record for MVP demo'),
('Campbelltown Community Legal', ARRAY['legal_assistance'], 'Free legal advice clinics for south-west Sydney.', 'Campbelltown', '12 Dumaresq Street, Campbelltown NSW 2560', -34.065, 150.814, 'South-west Sydney residents, free advice', NULL, 'Mon–Fri 9am–4pm', true, false, false, '02 9699 0016', 'info@campbelltownlegal-example.org', 'https://example.org/campbelltown-community-legal', 'https://example.org/campbelltown-community-legal', now() - interval '15 days', now() - interval '1 day', 'unverified', 'Sample record for MVP demo'),
('Sydney Women''s Health Clinic', ARRAY['health_service'], 'Bulk-billed women''s health services and counselling.', 'Redfern', '34 Cope Street, Redfern NSW 2016', -33.893, 151.206, 'Women aged 18+, bulk-billed, Medicare card needed', true, 'Mon–Fri 8:30am–5pm', false, true, false, '02 9699 0017', 'info@sydneywomenshealth-example.org', 'https://example.org/sydney-womens-health-clinic', 'https://example.org/sydney-womens-health-clinic', now() - interval '5 days', now() + interval '9 days', 'verified', 'Sample record for MVP demo'),
('Newtown Community Health Nursing', ARRAY['health_service'], 'Drop-in nursing, wound care and health checks.', 'Newtown', '15 Enmore Road, Newtown NSW 2042', -33.897, 151.176, 'Anyone in the inner west', true, 'Mon–Fri 9am–5pm', true, false, false, '02 9699 0018', 'info@newtownnursing-example.org', 'https://example.org/newtown-community-nursing', 'https://example.org/newtown-community-nursing', now() - interval '11 days', now() + interval '3 days', 'verified', 'Sample record for MVP demo'),
('Bankstown Women''s Health Service', ARRAY['health_service'], 'Women''s health nursing, counselling and groups.', 'Bankstown', '26 Restwell Street, Bankstown NSW 2200', -33.917, 151.031, 'Women in Bankstown and surrounding suburbs', true, 'Mon–Fri 9am–5pm', false, true, false, '02 9699 0019', 'info@bankstownwhs-example.org', 'https://example.org/bankstown-womens-health', 'https://example.org/bankstown-womens-health', now() - interval '6 days', now() + interval '8 days', 'verified', 'Sample record for MVP demo'),
('Financial Counselling & Centrelink Help', ARRAY['centrelink_support'], 'Help with Centrelink claims, debts and appeals.', 'Redfern', '61 Gibbons Street, Redfern NSW 2016', -33.893, 151.204, 'Anyone with Centrelink debts or payment problems', NULL, 'Mon–Fri 9am–5pm', false, true, false, '02 9699 0020', 'info@fcch-example.org', 'https://example.org/financial-counselling-help', 'https://example.org/financial-counselling-help', now() - interval '3 days', now() + interval '11 days', 'verified', 'Sample record for MVP demo'),
('Waterloo Welfare Rights Service', ARRAY['centrelink_support'], 'Advocacy on Centrelink payments and penalties.', 'Waterloo', '31 Raglan Street, Waterloo NSW 2017', -33.900, 151.209, 'Concession card holders in inner Sydney', NULL, 'Tue, Thu 9:30am–3pm', false, true, false, '02 9699 0021', 'info@welfarerights-example.org', 'https://example.org/waterloo-welfare-rights', 'https://example.org/waterloo-welfare-rights', now() - interval '18 days', now() - interval '4 days', 'unverified', 'Sample record for MVP demo'),
('Parramatta Centrelink Help Desk', ARRAY['centrelink_support'], 'Drop-in help filling in Centrelink forms.', 'Parramatta', '90 Church Street, Parramatta NSW 2150', -33.814, 151.002, 'Anyone needing help with payments', NULL, 'Mon–Fri 9am–4pm', true, false, false, '02 9699 0022', 'info@pchd-example.org', 'https://example.org/parra-centrelink-desk', 'https://example.org/parra-centrelink-desk', now() - interval '25 days', now() - interval '11 days', 'unverified', 'Sample record for MVP demo'),
('Inner City Emergency Relief', ARRAY['financial_assistance'], 'Help with bills, vouchers and small emergency payments.', 'Surry Hills', '501 Crown Street, Surry Hills NSW 2010', -33.886, 151.212, 'People in financial crisis in inner Sydney', NULL, 'Mon–Fri 10am–3pm', true, false, false, '02 9699 0023', 'info@icer-example.org', 'https://example.org/inner-city-emergency-relief', 'https://example.org/inner-city-emergency-relief', now() - interval '40 days', now() - interval '26 days', 'unverified', 'Sample record for MVP demo'),
('Blacktown Financial Counselling', ARRAY['financial_assistance'], 'Free financial counselling for western Sydney households.', 'Blacktown', '7 Main Street, Blacktown NSW 2148', -33.771, 150.906, 'Western Sydney households in financial stress', NULL, 'Mon–Fri 9am–5pm', false, true, false, '02 9699 0024', 'info@bfc-example.org', 'https://example.org/blacktown-financial-counselling', 'https://example.org/blacktown-financial-counselling', now() - interval '2 days', now() + interval '12 days', 'verified', 'Sample record for MVP demo'),
('Glebe Emergency Relief Program', ARRAY['financial_assistance'], 'Bill help and food vouchers for Glebe residents.', 'Glebe', '2 Bridge Road, Glebe NSW 2037', -33.879, 151.184, 'Anyone in the Glebe area needing bill help', NULL, 'Mon, Wed, Fri 10am–1pm', true, false, false, '02 9699 0025', 'info@gerp-example.org', 'https://example.org/glebe-emergency-relief', 'https://example.org/glebe-emergency-relief', now() - interval '55 days', now() - interval '41 days', 'unverified', 'Sample record for MVP demo'),
('Second Step Housing for Women', ARRAY['transitional_housing'], 'Medium-term housing for women leaving refuge.', 'Marrickville', '40 Warren Road, Marrickville NSW 2204', -33.898, 151.148, 'Women leaving refuge ready for medium-term housing', true, 'Mon–Fri 9am–5pm', false, true, true, '02 9699 0026', 'info@secondstep-example.org', 'https://example.org/second-step-housing', 'https://example.org/second-step-housing', now() - interval '4 days', now() + interval '10 days', 'verified', 'Sample record for MVP demo');

-- ---- Local source fixtures (stand-ins for official service pages) ----
INSERT INTO source_fixtures (service_id, content, fixture_url)
SELECT id,
  name || E'\nCommunity service directory listing (sample source)\n' ||
  'Address: ' || address || E'\n' ||
  'Opening hours: ' || opening_hours || E'\n' ||
  'Phone: ' || phone || E'\n' ||
  'Eligibility: ' || eligibility || E'\n' ||
  'Children welcome: ' || CASE children_allowed WHEN true THEN 'yes' WHEN false THEN 'no' ELSE 'unknown' END || E'\n' ||
  'Walk-ins: ' || CASE walk_in_allowed WHEN true THEN 'welcome' WHEN false THEN 'not accepted' ELSE 'not stated' END || E'\n' ||
  'Referral needed: ' || CASE referral_required WHEN true THEN 'yes' WHEN false THEN 'no' ELSE 'not stated' END,
  source_url
FROM services;

-- Seeded drift: fixture shows new values, stored values are stale → flagged for review
UPDATE source_fixtures SET content = replace(content, 'Phone: 02 9699 1234', 'Phone: 02 9698 8765') WHERE service_id = 9;
UPDATE source_fixtures SET content = replace(content, 'Opening hours: Mon–Fri 9am–5pm (Tue until 7pm)', 'Opening hours: Mon–Fri 9am–3pm') WHERE service_id = 13;

INSERT INTO verification_changes (service_id, field, stored_value, extracted_value, source_url, status, detected_at) VALUES
  (9, 'phone', '02 9699 1234', '02 9698 8765', 'https://example.org/redfern-community-food-bank', 'pending', now() - interval '1 day'),
  (13, 'opening_hours', 'Mon–Fri 9am–5pm (Tue until 7pm)', 'Mon–Fri 9am–3pm', 'https://example.org/redfern-legal-centre', 'pending', now() - interval '2 days');
