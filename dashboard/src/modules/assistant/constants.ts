export const AGENT_ID = 'assistant';

/** what a tool step says while it runs and once it has finished */
export const TOOL_LABELS: Record<string, [running: string, finished: string]> =
  {
    search_advisers: ['Searching advisers', 'Searched advisers'],
    search_firms: ['Searching firms', 'Searched firms'],
    get_field_options: ['Resolving a field value', 'Resolved a field value'],
    lookup_firm: ['Looking up the firm', 'Looked up the firm'],
    get_firm_profile: ['Reading the firm profile', 'Read the firm profile'],
    list_lists: ['Reading your lists', 'Read your lists'],
    create_list: ['Creating the list', 'Created the list'],
    add_to_list: ['Adding to the list', 'Added to the list'],
  };

export const toolLabel = (toolName: string, finished: boolean): string =>
  TOOL_LABELS[toolName]?.[finished ? 1 : 0] ??
  (finished ? `Ran ${toolName}` : `Running ${toolName}`);

/** written as a recruiter would type them; each one exercises a different tool */
export const SUGGESTED_PROMPTS = [
  'Advisers in Texas at firms with $1B or more in AUM',
  'Which advisers in California moved in the last 90 days?',
  'Who holds the CFP at firms under 20 advisers in Florida?',
  'Tell me about Fisher Investments',
];

export const THREAD_TITLE_MAX = 80;

export const titleFromMessage = (message: string): string => {
  const line = message.trim().split('\n')[0] ?? '';

  return line.length > THREAD_TITLE_MAX
    ? `${line.slice(0, THREAD_TITLE_MAX - 1)}…`
    : line;
};
