import { addToListTool } from './add-to-list.tool.js';
import { createListTool } from './create-list.tool.js';
import type { ToolDefinition } from './define-tool.js';
import { getFieldOptionsTool } from './get-field-options.tool.js';
import { getFirmProfileTool } from './get-firm-profile.tool.js';
import { listListsTool } from './list-lists.tool.js';
import { lookupFirmTool } from './lookup-firm.tool.js';
import { searchAdvisersTool } from './search-advisers.tool.js';
import { searchFirmsTool } from './search-firms.tool.js';

/** fixed order: tool definitions sit in the cached prompt prefix */
export const ASSISTANT_TOOLS: readonly ToolDefinition[] = [
  searchAdvisersTool,
  searchFirmsTool,
  getFieldOptionsTool,
  lookupFirmTool,
  getFirmProfileTool,
  listListsTool,
  createListTool,
  addToListTool,
];
