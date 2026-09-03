import { z } from 'zod';

import { crdSchema } from '@system/schema/utils.js';

/**
 * Every route keys on the CRD rather than a record id. market carries no
 * workspace_id and prospecting already exposes it to any authenticated user, so
 * this adds no reach; it also means these tabs work for a firm nobody has saved.
 */
const FirmRequestSchema = z.object({ firmCrd: crdSchema });

/**
 * Money is numeric(20,2) and overflows a double at cent precision, so it crosses
 * the wire as a decimal string. Nullable everywhere: regulatory_aum is null on
 * roughly a quarter of filings, and "not reported" is not "$0".
 */
const money = z.string().nullable();
const count = z.number().int().nullable();

export const GetFirmMetricsSeriesSchema = FirmRequestSchema.meta({
  id: 'GetFirmMetricsSeries',
});

const FirmMetricsPointSchema = z
  .object({
    filingId: z.string(),
    submittedAt: z.string().nullable(),
    filingType: z.string().nullable(),
    regulatoryAum: money,
    discretionaryAum: money,
    nonDiscretionaryAum: money,
    employeeCount: count,
    advisoryEmployeeCount: count,
    discretionaryAccountCount: count,
    nonDiscretionaryAccountCount: count,
    accountCount: count,
    officeCount: count,
  })
  .meta({ id: 'FirmMetricsPoint' });

export const GetFirmMetricsSeriesResponseSchema = z
  .object({
    /**
     * Change points, not filings. The median firm files 8 times and reports 3
     * distinct AUM values, so points < filingCount is the normal case and the
     * UI should say so rather than implying gaps in the record.
     */
    points: z.array(FirmMetricsPointSchema),
    filingCount: z.number().int(),
    /**
     * effective_date is null on all 338,022 filings, so this is the only axis
     * available. Named explicitly so a caller cannot mislabel the chart.
     */
    basis: z.literal('submitted_at'),
  })
  .meta({ id: 'GetFirmMetricsSeriesResponse' });

export const GetFirmCustodiansSchema = FirmRequestSchema.meta({
  id: 'GetFirmCustodians',
});

const FirmCustodianSchema = z
  .object({
    custodianName: z.string().nullable(),
    /** matched the dimension, so the name is comparable across firms */
    isResolved: z.boolean(),
    fundCount: z.number().int(),
    aumAtCustodian: money,
  })
  .meta({ id: 'FirmCustodian' });

export const GetFirmCustodiansResponseSchema = z
  .object({
    /**
     * Rolled up by canonical name. The raw grain is one row per (custodian,
     * fund) — the worst firm has 22,277 rows describing a single custodian — so
     * the raw list would misreport one relationship as thousands.
     */
    custodians: z.array(FirmCustodianSchema),
    /** null when the firm has never filed, which is not "no custodians" */
    filingId: z.string().nullable(),
  })
  .meta({ id: 'GetFirmCustodiansResponse' });

export const GetFirmProfileSchema = FirmRequestSchema.meta({
  id: 'GetFirmProfile',
});

const FirmFacetSchema = z
  .object({
    code: z.string(),
    label: z.string().nullable(),
    /** client types only; the ADV asks all 13, so 0 here is a reported zero */
    clientCount: count,
    /** true means the filing selected "fewer than five" instead of a number */
    fewerThanFive: z.boolean().nullable(),
    regulatoryAum: money,
  })
  .meta({ id: 'FirmFacet' });

export const GetFirmProfileResponseSchema = z
  .object({
    clientTypes: z.array(FirmFacetSchema),
    services: z.array(FirmFacetSchema),
    /**
     * Empty means the filing reported no fee method — Item 5.E is absent from
     * the ERA form entirely — not that the firm charges nothing.
     */
    feeMethods: z.array(FirmFacetSchema),
    reportedClients: z.object({
      min: count,
      max: count,
      quality: z.enum(['reported_number', 'bounded_range', 'unavailable']),
    }),
    filingId: z.string().nullable(),
  })
  .meta({ id: 'GetFirmProfileResponse' });

export const GetFirmOfficesSchema = FirmRequestSchema.meta({
  id: 'GetFirmOffices',
});

const FirmOfficeSchema = z
  .object({
    officeReference: z.string().nullable(),
    city: z.string().nullable(),
    /** as filed; only firm_fact_identity gets a normalised country code */
    region: z.string().nullable(),
    country: z.string().nullable(),
    employeeCount: count,
  })
  .meta({ id: 'FirmOffice' });

export const GetFirmOfficesResponseSchema = z
  .object({
    // max 246 on any firm, so this is not paged
    offices: z.array(FirmOfficeSchema),
    filingId: z.string().nullable(),
  })
  .meta({ id: 'GetFirmOfficesResponse' });

const PageSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  /** capped rather than unbounded: a 29,000-row deep page helps nobody */
  offset: z.number().int().min(0).max(10_000).default(0),
});

export const GetFirmFundsSchema = FirmRequestSchema.extend(
  PageSchema.shape,
).meta({
  id: 'GetFirmFunds',
});

const FirmFundSchema = z
  .object({
    privateFundId: z.string(),
    fundReference: z.string(),
    fundName: z.string().nullable(),
    fundTypeCode: z.string().nullable(),
    fundTypeRaw: z.string().nullable(),
    fundTypeOther: z.string().nullable(),
    region: z.string().nullable(),
    country: z.string().nullable(),
    exclusion3c1: z.boolean().nullable(),
    exclusion3c7: z.boolean().nullable(),
    isMasterFund: z.boolean().nullable(),
    isFeederFund: z.boolean().nullable(),
    masterFundName: z.string().nullable(),
    masterFundId: z.string().nullable(),
    isFundOfFunds: z.boolean().nullable(),
    adviserOrRelatedInvested: z.boolean().nullable(),
    investedInRegisteredInvestmentCompanies: z.boolean().nullable(),
    grossAssetValue: money,
    minimumInvestment: money,
    beneficialOwnerCount: count,
    ownedByAdviserRelatedPct: money,
    ownedByFundsPct: money,
    salesLimitedToQualifiedClients: z.boolean().nullable(),
    ownedByNonUsPct: money,
    isSubadviser: z.boolean().nullable(),
    hasOtherAdvisers: z.boolean().nullable(),
    clientsSolicited: z.boolean().nullable(),
    clientsInvestedPct: money,
    reliedOnRegulationD: z.boolean().nullable(),
    annualAudit: z.boolean().nullable(),
    financialStatementsGaap: z.boolean().nullable(),
    financialStatementsDistributed: z.boolean().nullable(),
    auditOpinionStatus: z
      .enum(['unqualified', 'not_unqualified', 'report_not_yet_received'])
      .nullable(),
    usesPrimeBrokers: z.boolean().nullable(),
    usesCustodians: z.boolean().nullable(),
    usesAdministrator: z.boolean().nullable(),
    externallyValuedAssetsPct: money,
    usesMarketers: z.boolean().nullable(),
  })
  .meta({ id: 'FirmFund' });

export const GetFirmFundsResponseSchema = z
  .object({
    funds: z.array(FirmFundSchema),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
    filingId: z.string().nullable(),
  })
  .meta({ id: 'GetFirmFundsResponse' });

export const GetFirmContactsSchema = FirmRequestSchema.extend({
  ...PageSchema.shape,
  sortBy: z
    .enum(['name', 'tenure', 'experience', 'state', 'disclosure'])
    .default('name'),
  direction: z.enum(['asc', 'desc']).default('asc'),
}).meta({ id: 'GetFirmContacts' });

const FirmContactSchema = z
  .object({
    advisorCrd: z.string(),
    fullName: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    currentFirmSince: z.string().nullable(),
    /**
     * registration | observation. An observation-backed link has no start date,
     * so a null `since` is legible rather than looking like missing data.
     */
    currentFirmSource: z.string().nullable(),
    currentFirmObservedOn: z.string().nullable(),
    tenureYears: count,
    experienceYears: count,
    /** >1 means dually registered, so this roster is not their only one */
    currentFirmCount: count,
    designations: z.array(z.string()),
    disclosureStatus: z.string().nullable(),
    disclosureCount: count,
    ownsCurrentFirm: z.boolean().nullable(),
    ownerTitle: z.string().nullable(),
    /** set when this adviser is already saved in the workspace */
    recordId: z.uuid().nullable(),
  })
  .meta({ id: 'FirmContact' });

export const GetFirmContactsResponseSchema = z
  .object({
    contacts: z.array(FirmContactSchema),
    total: z.number().int(),
    /**
     * The roster reads advisor_search.current_firm_crd, which holds an adviser
     * only at their primary open registration. 8,527 of 519,226 affiliations
     * (1.64%) sit elsewhere, so affiliationTotal can exceed total — the UI must
     * state the gap rather than quietly under-report.
     */
    affiliationTotal: z.number().int().nullable(),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .meta({ id: 'GetFirmContactsResponse' });

export const GetFirmFilingsSchema = FirmRequestSchema.meta({
  id: 'GetFirmFilings',
});

const FirmFilingSchema = z
  .object({
    filingId: z.string(),
    submittedAt: z.string().nullable(),
    filingType: z.string().nullable(),
    registrationCategory: z.string().nullable(),
    secNumber: z.string().nullable(),
    isCurrent: z.boolean(),
  })
  .meta({ id: 'FirmFiling' });

const FirmRegistrationEventSchema = z
  .object({
    eventId: z.string(),
    authority: z.string().nullable(),
    category: z.string().nullable(),
    status: z.string().nullable(),
    jurisdiction: z.string().nullable(),
    effectiveDate: z.string().nullable(),
  })
  .meta({ id: 'FirmRegistrationEvent' });

export const GetFirmFilingsResponseSchema = z
  .object({
    filings: z.array(FirmFilingSchema),
    events: z.array(FirmRegistrationEventSchema),
  })
  .meta({ id: 'GetFirmFilingsResponse' });
