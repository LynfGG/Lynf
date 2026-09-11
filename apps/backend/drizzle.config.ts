/// <reference types="node" />

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'drizzle-kit';

// The repository keeps a single .env at its root. Loading it here is what makes
// `pnpm --filter @lynf/backend db:migrate` work as the README says. In CI there is
// no such file and the variables come from the workflow; values already present in
// the environment always win over the file.
const rootEnvFile = resolve(__dirname, '../../.env');

if (existsSync(rootEnvFile)) {
    process.loadEnvFile(rootEnvFile);
}

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/database/schema/index.ts',
    out: './drizzle',
    dbCredentials: {
        url: process.env.DATABASE_URL ?? '',
    },
});
