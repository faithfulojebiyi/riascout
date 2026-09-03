/**
 * Hands the first message from the home composer to the conversation route.
 * A module singleton rather than router state: the value is consumed exactly
 * once on mount and must not survive a refresh or a back navigation.
 */
let pending: { threadId: string; message: string } | null = null;

export const setPendingMessage = (threadId: string, message: string): void => {
  pending = { threadId, message };
};

export const takePendingMessage = (threadId: string): string | null => {
  if (!pending || pending.threadId !== threadId) return null;

  const { message } = pending;

  pending = null;

  return message;
};
