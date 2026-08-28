import { config } from 'dotenv';

// MUST be the first import in main.ts — the Inngest client reads env at construction
config({ path: './apps/worker/.env', quiet: true });
