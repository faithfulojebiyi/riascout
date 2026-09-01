-- Full reload. Truncates market fact and identity tables in dependency order.
-- Dimensions are NOT touched — they are seeded from prisma/seed/dimensions.ts.

begin;

delete from pg.market.advisor_location;
delete from pg.market.advisor_registration;
delete from pg.market.advisor_employment;
delete from pg.market.advisor_exam;
delete from pg.market.advisor_designation;
delete from pg.market.advisor_disclosure_flag;
delete from pg.market.advisor_name;
delete from pg.market.advisor_derived;

delete from pg.market.firm_fact_identity;
delete from pg.market.firm_fact_metrics;
delete from pg.market.firm_fact_registration;
delete from pg.market.firm_fact_derived;
delete from pg.market.firm_fact_client_type;
delete from pg.market.firm_fact_service;
delete from pg.market.firm_fact_asset_allocation;
delete from pg.market.firm_fact_office;
delete from pg.market.firm_fact_custodian;
delete from pg.market.firm_fact_private_fund;
delete from pg.market.firm_fact_affiliation;
delete from pg.market.firm_fact_owner;
delete from pg.market.firm_web_presence;
delete from pg.market.firm_registration_event;
delete from pg.market.firm_email_pattern;
delete from pg.market.firm_domain;
delete from pg.market.firm_name_observation;
delete from pg.market.filing;

delete from pg.market.advisor;
delete from pg.market.firm;

commit;
