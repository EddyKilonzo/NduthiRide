import * as dotenv from 'dotenv';
import * as path from 'path';

// Ensure critical env vars are set BEFORE any module is loaded.
// PrismaClient reads DATABASE_URL at constructor time, so it must exist
// before NestJS instantiates any provider.
process.env['SKIP_DB_CONNECT'] = 'true';

// Load .env from backend root (overrides the defaults above if present)
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Fallback values for CI or if .env is missing
if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] =
    'postgresql://postgres:postgres@localhost:5432/nduthiride?schema=public';
}
if (!process.env['JWT_ACCESS_SECRET'])  process.env['JWT_ACCESS_SECRET']  = 'test-access-secret';
if (!process.env['JWT_REFRESH_SECRET']) process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret';
if (!process.env['JWT_ACCESS_EXPIRY'])  process.env['JWT_ACCESS_EXPIRY']  = '15m';
if (!process.env['JWT_REFRESH_EXPIRY']) process.env['JWT_REFRESH_EXPIRY'] = '7d';
