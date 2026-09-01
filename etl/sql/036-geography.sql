-- Normalises the principal country name to an ISO 3166-1 alpha-2 code.
--
-- firm_addresses.principal_country_code is null on all 338,022 source rows, so
-- country_code arrived empty and every country filter matched nothing. The raw
-- name is a closed vocabulary of 94 values plus "Other".
--
-- "Other" maps to NULL: it is the source saying it does not know, and a code
-- would turn that into a false fact. country_raw is kept either way.

begin;

create temp table _country_code on commit drop as
select * from (values
  ('Argentina','AR'), ('Armenia','AM'), ('Australia','AU'), ('Austria','AT'),
  ('Bahamas, The','BS'), ('Bahrain','BH'), ('Barbados','BB'), ('Belgium','BE'),
  ('Bermuda','BM'), ('Bolivia','BO'), ('Brazil','BR'), ('British Virgin Islands','VG'),
  ('Canada','CA'), ('Cayman Islands','KY'), ('Chile','CL'), ('China','CN'),
  ('Colombia','CO'), ('Comoros','KM'), ('Costa Rica','CR'), ('Croatia','HR'),
  ('Cyprus','CY'), ('Czech Republic','CZ'), ('Denmark','DK'), ('Dominican Republic','DO'),
  ('Ecuador','EC'), ('El Salvador','SV'), ('Estonia','EE'), ('Ethiopia','ET'),
  ('Finland','FI'), ('France','FR'), ('Georgia/Gruzinskaya','GE'), ('Germany','DE'),
  ('Ghana','GH'), ('Gibraltar','GI'), ('Greece','GR'), ('Grenada','GD'),
  ('Guam','GU'), ('Guatemala','GT'), ('Guernsey','GG'), ('Honduras','HN'),
  ('Hong Kong','HK'), ('Hungary','HU'), ('India','IN'), ('Indonesia','ID'),
  ('Ireland','IE'), ('Isle of Man','IM'), ('Israel','IL'), ('Italy','IT'),
  ('Jamaica','JM'), ('Japan','JP'), ('Jersey','JE'), ('Kenya','KE'),
  ('Korea, South','KR'), ('Liechtenstein','LI'), ('Lithuania','LT'), ('Luxembourg','LU'),
  ('Macau','MO'), ('Malaysia','MY'), ('Malta','MT'), ('Mauritius','MU'),
  ('Mexico','MX'), ('Monaco','MC'), ('Mongolia','MN'), ('Netherlands','NL'),
  ('New Zealand','NZ'), ('Nigeria','NG'), ('Norway','NO'), ('Oman','OM'),
  ('Panama','PA'), ('Peru','PE'), ('Portugal','PT'), ('Qatar','QA'),
  ('Romania','RO'), ('Russia','RU'), ('Saint Lucia','LC'), ('Saudi Arabia','SA'),
  ('Senegal','SN'), ('Singapore','SG'), ('Slovakia','SK'), ('South Africa','ZA'),
  ('Spain','ES'), ('Sweden','SE'), ('Switzerland','CH'), ('Taiwan,  Republic of China','TW'),
  ('Thailand','TH'), ('Trinidad and Tobago','TT'), ('Turkey','TR'), ('Ukraine','UA'),
  ('United Arab Emirates','AE'), ('United Kingdom','GB'), ('United States','US'),
  ('Uruguay','UY'), ('Venezuela','VE'), ('Vietnam','VN')
) as t(country_raw, country_code);

update market.firm_fact_identity fi
   set country_code = c.country_code
  from _country_code c
 where c.country_raw = fi.country_raw
   and fi.country_code is distinct from c.country_code;

commit;
