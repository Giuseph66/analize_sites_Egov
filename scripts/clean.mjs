#!/usr/bin/env node
/**
 * Remove artefatos de execucao: data/raw, data/reports, data/evaluations e logs/.
 * Nao toca em node_modules nem em test-sites.
 */
import { readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const targets = ['data/raw', 'data/reports', 'data/evaluations', 'logs'];

for (const target of targets) {
  const dir = join(repoRoot, target);
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    continue;
  }
  let removed = 0;
  for (const entry of entries) {
    if (entry === '.gitkeep') continue;
    await rm(join(dir, entry), { recursive: true, force: true });
    removed += 1;
  }
  console.log(`${target}: ${removed} item(s) removido(s)`);
}
