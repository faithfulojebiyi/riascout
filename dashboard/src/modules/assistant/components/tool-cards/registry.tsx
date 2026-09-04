import { FirmCandidates, firmLookupDetail } from './firm-candidates';
import { FirmProfileCard, firmProfileDetail } from './firm-profile-card';
import {
  describeAddToList,
  describeCreateList,
  ListCard,
  listDetail,
} from './list-card';
import {
  describeUpdateRecord,
  RecordCard,
  updateRecordDetail,
} from './record-card';
import {
  AdviserSearchTable,
  FirmSearchTable,
  searchDetail,
} from './search-tables';
import { isRecord, type ToolRenderer } from './types';

const listsDetail = (result: unknown): string | null =>
  isRecord(result) && Array.isArray(result.lists)
    ? `${result.lists.length} list${result.lists.length === 1 ? '' : 's'}`
    : null;

const recordDetail = (result: unknown): string | null =>
  isRecord(result)
    ? result.record === null
      ? 'not saved yet'
      : `${Array.isArray(result.fields) ? result.fields.length : 0} fields`
    : null;

const optionsDetail = (result: unknown): string | null =>
  isRecord(result) && Array.isArray(result.options)
    ? `${result.options.length} option${result.options.length === 1 ? '' : 's'}`
    : null;

/**
 * Mapped by tool name, never by result shape: two tools can return the same
 * shape and mean different things, and correlating by order is fragile.
 */
export const TOOL_RENDERERS: Record<string, ToolRenderer> = {
  search_advisers: { Result: AdviserSearchTable, detail: searchDetail },
  search_firms: { Result: FirmSearchTable, detail: searchDetail },
  get_field_options: { detail: optionsDetail },
  lookup_firm: { Result: FirmCandidates, detail: firmLookupDetail },
  get_firm_profile: { Result: FirmProfileCard, detail: firmProfileDetail },
  list_lists: { detail: listsDetail },
  create_list: {
    Result: ListCard,
    detail: listDetail,
    describeApproval: describeCreateList,
  },
  add_to_list: {
    Result: ListCard,
    detail: listDetail,
    describeApproval: describeAddToList,
  },
  get_record: { detail: recordDetail },
  update_record: {
    Result: RecordCard,
    detail: updateRecordDetail,
    describeApproval: describeUpdateRecord,
  },
};
