#!/usr/bin/env node
/**
 * Fails when the two languages do not hold exactly the same keys.
 *
 * Shipping two languages means every string is written twice, and the two files
 * drift apart the moment someone is in a hurry. This is the check that makes the
 * build say so, instead of a player discovering a raw key on screen.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const I18N_DIR = 'apps/frontend/src/i18n';
const REFERENCE = 'en';

function flatten(value, prefix = '') {
    return Object.entries(value).flatMap(([key, child]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return child !== null && typeof child === 'object' ? flatten(child, path) : [path];
    });
}

function keysOf(language) {
    const directory = join(I18N_DIR, language);
    const keys = new Map();

    for (const file of readdirSync(directory).filter((name) => name.endsWith('.json'))) {
        const namespace = file.replace(/\.json$/, '');
        const content = JSON.parse(readFileSync(join(directory, file), 'utf8'));
        for (const key of flatten(content)) {
            keys.set(`${namespace}:${key}`, true);
        }
    }

    return keys;
}

const languages = readdirSync(I18N_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const reference = keysOf(REFERENCE);
let failed = false;

for (const language of languages.filter((name) => name !== REFERENCE)) {
    const current = keysOf(language);

    const missing = [...reference.keys()].filter((key) => !current.has(key));
    const extra = [...current.keys()].filter((key) => !reference.has(key));

    for (const key of missing) {
        console.error(`  missing in ${language}: ${key}`);
        failed = true;
    }
    for (const key of extra) {
        console.error(`  missing in ${REFERENCE}: ${key}`);
        failed = true;
    }
}

if (failed) {
    console.error('\nTranslation files are out of sync.\n');
    process.exit(1);
}

console.log(`Translations are in sync across ${languages.length} languages.`);
