/**
 * Stable cross-workspace identifiers for system attributes.
 *
 * NEVER EDIT OR REGENERATE THESE VALUES. Each workspace gets its own attribute
 * rows with fresh ids, but the `key` is identical everywhere, so mapping and
 * enrichment code can find "the tenure attribute" in any workspace.
 *
 * uuid7 rather than a readable slug because entity_attribute is unique on
 * (entityId, key) and system attributes share that namespace with user-created
 * ones. A readable key like 'status' collides the day a user creates their own,
 * and adding a new system attribute in a later release would then break every
 * workspace that already has one. A uuid7 cannot collide, with no reserved-word
 * list to enforce.
 */

/** projected from market.advisor_search — read-only, never stored as cells */
export const ADVISOR_REFERENCE_ATTRIBUTES = {
  fullName: '01a04af1-e853-7637-aa81-a485f74a19fb', // advisor.full_name
  isActive: '01a04af1-e857-716a-80dc-61bd7cd57e23', // advisor.is_active
  currentFirmCrd: '01a04af1-e858-7eac-a721-7900d72df2fd', // advisor.current_firm_crd
  currentFirmName: '01a04af1-e859-748b-a87e-c8572d832bab', // advisor.current_firm_name
  currentFirmSince: '01a04af1-e85a-7d6a-81b7-aee56650f517', // advisor.current_firm_since
  currentFirmCount: '01a04af1-e85b-761e-bc11-9871fd42eabb', // advisor.current_firm_count
  tenureMonths: '01a04af1-e85c-7a7c-ab2d-cbf9f40fd445', // advisor.tenure_months
  experienceMonths: '01a04af1-e85d-7c88-ae36-b5e74f839dd8', // advisor.experience_months
  previousFirmCount: '01a04af1-e85e-7405-97bb-d1de59e7642f', // advisor.previous_firm_count
  avgPreviousTenureMonths: '01a04af1-e85f-7b81-b7d8-0182f77da866', // advisor.avg_previous_tenure_months
  examCodes: '01a04af1-e860-7738-9434-f0e62911037e', // advisor.exam_codes
  designations: '01a04af1-e861-7795-9161-33e4df3be154', // advisor.designations
  jurisdictions: '01a04af1-e862-7d05-8a31-2316338d1148', // advisor.jurisdictions
  jurisdictionCount: '01a04af1-e863-7c3c-838a-1a69c8dc118c', // advisor.jurisdiction_count
  disclosureStatus: '01a04af1-e864-76c3-9ab4-51ba5edb38c7', // advisor.disclosure_status
  disclosureCount: '01a04af1-e865-73ad-9b8e-724416f370aa', // advisor.disclosure_count
  ownsCurrentFirm: '01a04af1-e866-7767-9158-5d35c885927f', // advisor.owns_current_firm
  ownershipBand: '01a04af1-e867-7310-b18c-f14cb8861436', // advisor.ownership_band
  isControlPerson: '01a04af1-e868-7f9a-813c-d513f3a630d8', // advisor.is_control_person
  ownerTitle: '01a04af1-e869-796e-b14a-e1f43250f6fe', // advisor.owner_title
  city: '01a04af1-e86a-7bfd-9cc0-b5e59499506c', // advisor.city
  state: '01a04af1-e86b-7c1e-a40b-b38dd5ec2ebd', // advisor.state
  postalCode: '01a04af1-e86c-7afc-82ac-f3088261dbe4', // advisor.postal_code
  countryCode: '01a04af1-e86d-7439-a40c-b8b57794669f', // advisor.country_code
  lastMovedOn: '01a04af1-e86e-79bc-925f-157d941d1735', // advisor.last_moved_on
  lastDetectedOn: '01a04af1-e86f-7980-b56b-ad26075a76dc', // advisor.last_detected_on
  previousFirmCrd: '01a04af1-e870-7648-99e6-dcda8e1962ea', // advisor.previous_firm_crd
  moveCount_5y: '01a04af1-e871-7e0b-a52d-e69461f421df', // advisor.move_count_5y
  firmAum: '01a04af1-e872-7753-9e23-0d2f30a978f3', // advisor.firm_aum
  firmAumBand: '01a04af1-e873-7bdf-b318-f62acafe292a', // advisor.firm_aum_band
  firmClientCount: '01a04af1-e874-7707-aa95-c721825ed984', // advisor.firm_client_count
  firmEmployeeCount: '01a04af1-e876-70d1-b1d6-100cb3ee6660', // advisor.firm_employee_count
  firmAdvisorCount: '01a04af1-e877-74a6-8f94-7ac9705d8083', // advisor.firm_advisor_count
  firmAumPerAdvisor: '01a04af1-e878-7eba-9fc2-5f0cd2fe95d7', // advisor.firm_aum_per_advisor
  firmChannel: '01a04af1-e879-72b5-8610-ebe54e904fe3', // advisor.firm_channel
  firmState: '01a04af1-e87a-7c99-9206-693ca6b971b4', // advisor.firm_state
  firmDomain: '01a04af1-e87b-743e-89fe-e283c4829de1', // advisor.firm_domain
  advisorCrd: '01a04b01-339b-7ae4-bdff-2456b4573cec', // advisor.advisor_crd
  firstName: '01a04b01-339e-7ac6-b7ff-b2f3c0eaaaee', // advisor.first_name
  lastName: '01a04b01-339f-7b64-8aba-3961302e7522', // advisor.last_name
  previousFirmCrds: '01a04b01-33a1-711b-85d5-b804f2b9062e', // advisor.previous_firm_crds
  isUsWorkplace: '01a04b01-33a2-7157-ad2d-b5a0b52dc3cb', // advisor.is_us_workplace
  firmLinkedinUrl: '01a04b01-33a3-7b34-a396-7577332794d8', // advisor.firm_linkedin_url
  firmOfficeCount: '01a04b01-33a4-7ab2-a88e-a61bc9fe6490', // advisor.firm_office_count
  firmAumPerClient: '01a04b01-33a6-782c-8d73-2f8327cb645c', // advisor.firm_aum_per_client
  firmAumCagr_3y: '01a04b01-33a7-7f0c-9767-c053f950aff8', // advisor.firm_aum_cagr_3y
  firmIsSecRegistered: '01a04b01-33a8-79c1-86db-bec68bbf41ec', // advisor.firm_is_sec_registered
  firmIsEra: '01a04b01-33a9-7d89-b31a-942b990eeb63', // advisor.firm_is_era
  firmClientTypeCodes: '01a04b01-33aa-7105-a806-4b61392db029', // advisor.firm_client_type_codes
  firmServiceCodes: '01a04b01-33ab-791d-864e-768a3f9d6bbf', // advisor.firm_service_codes
  firmCustodianIds: '01a04b01-33ac-779a-a91c-6dade5bc006c', // advisor.firm_custodian_ids
  firmFundTypeCodes: '01a04b01-33ad-7b37-83d3-da88dee9265f', // advisor.firm_fund_type_codes
} as const;

/** projected from market.firm_search */
export const FIRM_REFERENCE_ATTRIBUTES = {
  firmName: '01a04af1-e87c-763c-8cfc-d7ace0e3f69d', // firm.firm_name
  domain: '01a04af1-e87d-7c84-8908-bf4e2576d445', // firm.domain
  city: '01a04af1-e87e-73eb-bebf-9cb72da085a9', // firm.city
  state: '01a04af1-e87f-724d-96e0-ccfeaa2332d7', // firm.state
  channelCode: '01a04af1-e880-70a5-9528-70887fe726c2', // firm.channel_code
  isSecRegistered: '01a04af1-e881-779d-8b02-fddf778514c5', // firm.is_sec_registered
  isEra: '01a04af1-e882-7665-a76b-d0e64da63532', // firm.is_era
  regulatoryAum: '01a04af1-e883-7382-8352-6ab966c4c158', // firm.regulatory_aum
  aumBand: '01a04af1-e884-7ae9-9066-89f4d96f2caa', // firm.aum_band
  clientCount: '01a04af1-e885-7ee6-8bc6-ae10c013d04f', // firm.client_count
  employeeCount: '01a04af1-e886-7d9d-aab9-ed679f4db5aa', // firm.employee_count
  advisorCount: '01a04af1-e887-703a-897b-2574528425ec', // firm.advisor_count
  aumPerAdvisor: '01a04af1-e888-7097-856c-c8799b7ef4df', // firm.aum_per_advisor
  aumPerClient: '01a04af1-e889-7f5f-8bb8-ab8bad855866', // firm.aum_per_client
  aumCagr_3y: '01a04af1-e88a-7260-b668-928b4a2042c0', // firm.aum_cagr_3y
  clientTypeCodes: '01a04af1-e88b-7de0-b7cc-94c5441236a9', // firm.client_type_codes
  serviceCodes: '01a04af1-e88c-7e02-94eb-b1fbd27b2190', // firm.service_codes
  custodianIds: '01a04af1-e88d-72e4-965b-3376645b7de5', // firm.custodian_ids
  fundTypeCodes: '01a04af1-e88e-7319-ba87-80d550b49cb3', // firm.fund_type_codes
  advisorsGained_90d: '01a04af1-e88f-7e5a-82a7-d53b0bf127c8', // firm.advisors_gained_90d
  advisorsLost_90d: '01a04af1-e890-7ec9-86f0-3c306e68131b', // firm.advisors_lost_90d
  netAdvisorFlow_90d: '01a04af1-e891-7c10-a3f6-b23da87b2629', // firm.net_advisor_flow_90d
  firmCrd: '01a04b01-33ae-7239-852a-db7bfe98009a', // firm.firm_crd
  secNumber: '01a04b01-33af-7732-a226-752b57ab105b', // firm.sec_number
  linkedinUrl: '01a04b01-33b0-7c98-ba71-adcafc25486d', // firm.linkedin_url
  socialPlatforms: '01a04b01-33b1-72ab-a851-9fa843dad52f', // firm.social_platforms
  primaryRegistrationType: '01a04b01-33b2-7098-8921-0e6ce83211a7', // firm.primary_registration_type
  discretionaryAum: '01a04b01-33b3-74e1-97f4-49987f5beb73', // firm.discretionary_aum
  nonDiscretionaryAum: '01a04b01-33b4-74bb-95da-cfafc0934278', // firm.non_discretionary_aum
  advisoryEmployeeCount: '01a04b01-33b5-758e-8fe1-caed77619511', // firm.advisory_employee_count
  officeCount: '01a04b01-33b6-78b1-94be-12ec83774dd8', // firm.office_count
  aumPerEmployee: '01a04b01-33b7-79ad-aa41-b5018a70a07b', // firm.aum_per_employee
  aumPercentile: '01a04b01-33b8-77a5-88ae-4661fe8f2d76', // firm.aum_percentile
  aumPerAdvisorPercentile: '01a04b01-33b9-74e1-b270-8999d69033d0', // firm.aum_per_advisor_percentile
  aumCagr_1y: '01a04b01-33ba-7505-a1b5-6442a48912c2', // firm.aum_cagr_1y
  aumCagr_5y: '01a04b01-33bb-78eb-9ffa-e69bcc30de12', // firm.aum_cagr_5y
  employeeCagr_3y: '01a04b01-33bc-7da9-9e81-81506b15cbfa', // firm.employee_cagr_3y
  assetCategoryCodes: '01a04b01-33bd-7ac0-a357-2c258d285fcf', // firm.asset_category_codes
  topCustodianId: '01a04b01-33be-73f8-ba62-8a5c1c1eef56', // firm.top_custodian_id
  topCustodianAum: '01a04b01-33bf-7d10-92f8-675710df68e9', // firm.top_custodian_aum
  fundCount: '01a04b01-33c0-7010-9e8d-976294a69799', // firm.fund_count
  totalFundGav: '01a04b01-33c2-72bd-b4fc-b12d9898066b', // firm.total_fund_gav
  affiliatedCrds: '01a04b01-33c3-7814-90b6-a04deca18058', // firm.affiliated_crds
  ownerCount: '01a04b01-33c4-7dbc-a935-abe4cb5164e8', // firm.owner_count
  ownerAdvisorCount: '01a04b01-33c5-7ea8-83cc-1026e438e77c', // firm.owner_advisor_count
  ownershipConcentration: '01a04b01-33c6-7bd7-8b69-455518ea15f5', // firm.ownership_concentration
  firstFilingDate: '01a04b01-33c7-78a8-8e7b-65e707ec5421', // firm.first_filing_date
  latestFilingDate: '01a04b01-33c8-74f1-8a84-d444c7f73926', // firm.latest_filing_date
  filingCount: '01a04b01-33c9-75ee-bd36-dbfa5fcf3628', // firm.filing_count
} as const;

/** recruiter-authored columns every workspace starts with */
export const ADVISOR_WORKFLOW_ATTRIBUTES = {
  recruitingStatus: '01a04af1-e893-709c-ad70-83d534bb6626',
  owner: '01a04af1-e894-72fc-a100-c9c4e76f6228',
  notes: '01a04af1-e896-701c-a597-f99bb7745162',
  lastContactedAt: '01a04af1-e897-7928-be24-a5f7d61493c5',
  priority: '01a04af1-e898-75d8-9961-0089bbc827c9',
} as const;

export const FIRM_WORKFLOW_ATTRIBUTES = {
  targetStatus: '01a04af1-e899-7108-9a6a-17cf9912e318',
  owner: '01a04af1-e89a-7c9a-9291-048169d76d0c',
  notes: '01a04af1-e89b-715b-ba16-37c5bd05fbd5',
} as const;
