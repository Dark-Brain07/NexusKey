// Loads apps/api/.env before any test file's imports run, so config/env.ts's
// eager validation succeeds. Uses a separate test database name so test
// runs never touch dev data.
process.loadEnvFile('.env');
process.env.DATABASE_URL = process.env.DATABASE_URL?.replace(/\/NexusKey($|\?)/, '/NexusKey_test$1');
