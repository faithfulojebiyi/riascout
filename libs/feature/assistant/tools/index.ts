import type { ToolDefinition } from './define-tool.js';
import { getFirmProfileTool } from './get-firm-profile.tool.js';
import { lookupFirmTool } from './lookup-firm.tool.js';
import { searchAdvisersTool } from './search-advisers.tool.js';

/** fixed order: tool definitions sit in the cached prompt prefix */
export const ASSISTANT_TOOLS: readonly ToolDefinition[] = [
  searchAdvisersTool,
  lookupFirmTool,
  getFirmProfileTool,
];
