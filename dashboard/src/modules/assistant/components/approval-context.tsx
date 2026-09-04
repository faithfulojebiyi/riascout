import { createContext, useContext } from 'react';

export type ApprovalActions = {
  /** true while the live run is parked on an approval-requested tool call */
  awaiting: boolean;
  approvals: Record<string, { status: 'approved' | 'declined' }>;
  approve: (toolCallId: string) => Promise<void>;
  decline: (toolCallId: string) => Promise<void>;
};

const noop = async () => undefined;

/** history views render without a live run, so the default cannot act */
export const ApprovalContext = createContext<ApprovalActions>({
  awaiting: false,
  approvals: {},
  approve: noop,
  decline: noop,
});

export const useApprovalActions = () => useContext(ApprovalContext);
