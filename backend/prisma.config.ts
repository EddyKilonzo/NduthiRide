import { defineConfig } from 'prisma/config';
import 'dotenv/config';

/**
 * Prisma configuration — database connection is read from DATABASE_URL in .env.
 * See: https://pris.ly/d/config-datasource
 */
export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
