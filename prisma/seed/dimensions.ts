/**
 * Controlled vocabularies. These are code, not data — versioned here so a
 * change to a facet vocabulary shows up in a diff and gets reviewed.
 * Idempotent: safe to re-run.
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../orm/app/client.js';

const CLIENT_TYPES = [
  ['High_Net_Worth_Individuals', 'High net worth individuals'],
  ['Individuals', 'Individuals other than high net worth'],
  ['Pooled_Investment_Vehicles', 'Pooled investment vehicles'],
  ['Pension_and_Profit_Sharing', 'Pension and profit sharing plans'],
  ['Charitable_Organizations', 'Charitable organizations'],
  ['Sovereign_Wealth_Funds', 'Sovereign wealth funds and foreign official institutions'],
  ['Investment_Companies', 'Investment companies'],
  ['Corporations_or_Other_Businesses', 'Corporations or other businesses'],
  ['Other_Investment_Advisers', 'Other investment advisers'],
  ['State_or_Municipal_Governments', 'State or municipal government entities'],
  ['Banking_or_Thrift', 'Banking or thrift institutions'],
  ['Insurance_Companies', 'Insurance companies'],
  ['Business_Development_Companies', 'Business development companies'],
] as const;

const SERVICE_TYPES = [
  ['portfolio_mgmt_individuals', 'Portfolio Management for Individuals & Small Businesses'],
  ['financial_planning', 'Financial Planning Services'],
  ['portfolio_mgmt_institutional', 'Portfolio Management for Businesses or Institutional Clients'],
  ['selection_other_advisers', 'Selection of Other Advisers'],
  ['portfolio_mgmt_pooled', 'Portfolio Management for Pooled Investment Vehicles'],
  ['pension_consulting', 'Pension Consulting Services'],
  ['educational_seminars', 'Educational Seminars/Workshops'],
  ['portfolio_mgmt_inv_companies', 'Portfolio Management for Investment Companies'],
  ['publication_periodicals', 'Publication of Periodicals or Newsletters'],
  ['market_timing', 'Market Timing Services'],
  ['security_ratings', 'Security Ratings or Pricing Services'],
  ['other', 'Other'],
] as const;

const ASSET_CATEGORIES = [
  ['exchange_traded_equity', 'Exchange-Traded Equity'],
  ['non_exchange_traded_equity', 'Non-Exchange-Traded Equity'],
  ['us_government_bonds', 'U.S. Government Bonds'],
  ['us_state_local_bonds', 'U.S. State and Local Bonds'],
  ['sovereign_bonds', 'Sovereign Bonds'],
  ['investment_grade_corporate', 'Investment-Grade Corporate Bonds'],
  ['non_investment_grade_corporate', 'Non-Investment-Grade Corporate Bonds'],
  ['derivatives', 'Derivatives'],
  ['registered_investment_companies', 'Registered Investment Companies'],
  ['pooled_investment_vehicles', 'Pooled Investment Vehicles'],
  ['cash_and_equivalents', 'Cash and Cash Equivalents'],
  ['other', 'Other'],
] as const;

const FUND_TYPES = [
  ['private_equity', 'Private Equity Fund'],
  ['hedge', 'Hedge Fund'],
  ['venture_capital', 'Venture Capital Fund'],
  ['real_estate', 'Real Estate Fund'],
  ['securitized_asset', 'Securitized Asset Fund'],
  ['liquidity', 'Liquidity Fund'],
  ['other_private', 'Other Private Fund'],
] as const;

/**
 * Form ADV Schedule A bands. Bounds are the standard codes — confirm against
 * the ADV instructions before rendering them as percentages to users.
 */
const OWNERSHIP_CODES = [
  ['NA', 'No ownership — officer or control person only', null, null],
  ['A', 'Under 5%', 0, 5],
  ['B', '5% to under 10%', 5, 10],
  ['C', '10% to under 25%', 10, 25],
  ['D', '25% to under 50%', 25, 50],
  ['E', '50% to under 75%', 50, 75],
  ['F', '75% or more', 75, 100],
] as const;

const REGISTRATION_STATUSES = [
  ['APPROVED', 'Approved'],
  ['APPROVED_RES', 'Approved with restrictions'],
  ['APP_PEND_IARCE', 'Application pending IARCE'],
  ['PREVIOUS', 'Previous registration'],
] as const;

/** Derivation rule lives in libs/feature/market — and is unit-tested. */
const FIRM_CHANNELS = [
  ['pure_ria', 'Pure RIA — no broker-dealer affiliation'],
  ['hybrid', 'Hybrid — RIA with a broker-dealer affiliation'],
  ['bd_affiliated', 'Broker-dealer affiliated'],
  ['insurance_affiliated', 'Insurance affiliated'],
  ['bank_affiliated', 'Bank or thrift affiliated'],
  ['era', 'Exempt reporting adviser'],
] as const;

const AUM_BANDS = [
  ['lt_25m', 'Under $25M', null, 25_000_000],
  ['25m_100m', '$25M – $100M', 25_000_000, 100_000_000],
  ['100m_250m', '$100M – $250M', 100_000_000, 250_000_000],
  ['250m_500m', '$250M – $500M', 250_000_000, 500_000_000],
  ['500m_1b', '$500M – $1B', 500_000_000, 1_000_000_000],
  ['1b_5b', '$1B – $5B', 1_000_000_000, 5_000_000_000],
  ['5b_20b', '$5B – $20B', 5_000_000_000, 20_000_000_000],
  ['gte_20b', '$20B+', 20_000_000_000, null],
] as const;

const SOURCES = [
  ['sec_adv', 'SEC Form ADV', 'internal', 10],
  ['sec_iapd', 'SEC IAPD individual records', 'internal', 10],
  ['derived', 'Derived by our own transforms', 'internal', 20],
  ['pattern_inference', 'Email pattern inference (identifier only)', 'internal', 60],
  ['user', 'Entered by a user', 'user', 5],
  ['scrape', 'Firm website scrape', 'scrape', 70],
] as const;

async function main(): Promise<void> {
  const connectionString = process.env.APP_DATABASE_URL;

  if (!connectionString) {
    throw new Error('APP_DATABASE_URL is required');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const upsertCoded = async (
    label: string,
    rows: readonly (readonly [string, string])[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: { upsert: (args: unknown) => Promise<unknown> },
  ): Promise<void> => {
    for (const [code, name] of rows) {
      await model.upsert({ where: { code }, create: { code, name }, update: { name } });
    }

    console.log(`  ${label}: ${rows.length}`);
  };

  console.log('seeding dimensions');

  await upsertCoded('dim_client_type', CLIENT_TYPES, prisma.dimClientType);
  await upsertCoded('dim_service_type', SERVICE_TYPES, prisma.dimServiceType);
  await upsertCoded('dim_asset_category', ASSET_CATEGORIES, prisma.dimAssetCategory);
  await upsertCoded('dim_fund_type', FUND_TYPES, prisma.dimFundType);
  await upsertCoded('dim_registration_status', REGISTRATION_STATUSES, prisma.dimRegistrationStatus);
  await upsertCoded('dim_firm_channel', FIRM_CHANNELS, prisma.dimFirmChannel);

  for (const [code, name, lowerPct, upperPct] of OWNERSHIP_CODES) {
    await prisma.dimOwnershipCode.upsert({
      where: { code },
      create: { code, name, lowerPct, upperPct },
      update: { name, lowerPct, upperPct },
    });
  }

  console.log(`  dim_ownership_code: ${OWNERSHIP_CODES.length}`);

  for (const [code, name, lowerAum, upperAum] of AUM_BANDS) {
    await prisma.dimAumBand.upsert({
      where: { code },
      create: { code, name, lowerAum, upperAum },
      update: { name, lowerAum, upperAum },
    });
  }

  console.log(`  dim_aum_band: ${AUM_BANDS.length}`);

  for (const [code, name, category, precedence] of SOURCES) {
    await prisma.dimSource.upsert({
      where: { code },
      create: { code, name, category, precedence },
      update: { name, category, precedence },
    });
  }

  console.log(`  dim_source: ${SOURCES.length}`);
  console.log('done');

  await prisma.$disconnect();
}

await main();
