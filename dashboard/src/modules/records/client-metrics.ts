import type {
  FirmFacet,
  GetFirmProfileResponse,
} from '../../api/generated/rIAScoutAPI.schemas';

const integer = (value: number): string => value.toLocaleString('en-US');

export const formatReportedClients = (
  value: GetFirmProfileResponse['reportedClients'],
): string => {
  if (value.quality === 'reported_number' && value.min !== null) {
    return integer(value.min);
  }

  if (
    value.quality === 'bounded_range' &&
    value.min !== null &&
    value.max !== null
  ) {
    return `${integer(value.min)}–${integer(value.max)}`;
  }

  return 'Not reported';
};

export const formatClientTypeCount = (
  value: Pick<FirmFacet, 'clientCount' | 'fewerThanFive'>,
): string | undefined => {
  if (value.fewerThanFive) {
    return 'Fewer than 5 clients';
  }

  if (value.clientCount === null) {
    return undefined;
  }

  return `${integer(value.clientCount)} client${value.clientCount === 1 ? '' : 's'}`;
};
