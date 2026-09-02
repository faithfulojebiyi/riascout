import { queryOptions } from '@tanstack/react-query';

import { advisorsControllerGetAdvisorProfile } from '../../api/generated/advisors/advisors';
import {
  firmsControllerGetFirmContacts,
  firmsControllerGetFirmCustodians,
  firmsControllerGetFirmFilings,
  firmsControllerGetFirmFunds,
  firmsControllerGetFirmMetricsSeries,
  firmsControllerGetFirmOffices,
  firmsControllerGetFirmProfile,
} from '../../api/generated/firms/firms';

/**
 * One query per tab, so a tab the user never opens is never fetched. They key on
 * the CRD rather than the record id because market data is the same for every
 * workspace — two saved records pointing at one firm share a cache entry.
 */
export const firmProfileQuery = (firmCrd: string) =>
  queryOptions({
    queryKey: ['firm', firmCrd, 'profile'],
    queryFn: () => firmsControllerGetFirmProfile({ firmCrd }),
  });

export const firmMetricsQuery = (firmCrd: string) =>
  queryOptions({
    queryKey: ['firm', firmCrd, 'metrics'],
    queryFn: () => firmsControllerGetFirmMetricsSeries({ firmCrd }),
  });

export const firmContactsQuery = (
  firmCrd: string,
  offset: number,
  limit: number,
) =>
  queryOptions({
    queryKey: ['firm', firmCrd, 'contacts', offset, limit],
    queryFn: () => firmsControllerGetFirmContacts({ firmCrd, offset, limit }),
  });

export const firmOfficesQuery = (firmCrd: string) =>
  queryOptions({
    queryKey: ['firm', firmCrd, 'offices'],
    queryFn: () => firmsControllerGetFirmOffices({ firmCrd }),
  });

export const firmCustodiansQuery = (firmCrd: string) =>
  queryOptions({
    queryKey: ['firm', firmCrd, 'custodians'],
    queryFn: () => firmsControllerGetFirmCustodians({ firmCrd }),
  });

export const firmFundsQuery = (
  firmCrd: string,
  offset: number,
  limit: number,
) =>
  queryOptions({
    queryKey: ['firm', firmCrd, 'funds', offset, limit],
    queryFn: () => firmsControllerGetFirmFunds({ firmCrd, offset, limit }),
  });

export const firmFilingsQuery = (firmCrd: string) =>
  queryOptions({
    queryKey: ['firm', firmCrd, 'filings'],
    queryFn: () => firmsControllerGetFirmFilings({ firmCrd }),
  });

/**
 * One query for the whole adviser, not one per tab. The median adviser has 2
 * registrations and 4 employment rows and the worst in the table has 100 and 92,
 * so splitting it would cost round trips to save nothing.
 */
export const advisorProfileQuery = (advisorCrd: string) =>
  queryOptions({
    queryKey: ['advisor', advisorCrd, 'profile'],
    queryFn: () => advisorsControllerGetAdvisorProfile({ advisorCrd }),
  });
