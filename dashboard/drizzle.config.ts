import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.LINKEDIN_DB_PATH ?? './data/linkedin.db',
  },
} satisfies Config;
