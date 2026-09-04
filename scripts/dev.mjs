#!/usr/bin/env node
/**
 * Sobe API (:3001) e Vite (:3000) juntos, sem depender de concurrently.
 * O Vite faz proxy de /api para a API, entao o endereco continua sendo :3000.
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const processes = [
  { name: 'api', command: 'npm', args: ['run', 'dev', '--workspace=@lae/api'], env: { PORT: '3001' } },
  { name: 'web', command: 'npm', args: ['run', 'dev', '--workspace=@lae/frontend'], env: { API_PROXY_TARGET: 'http://localhost:3001' } },
];

const children = processes.map(({ name, command, args, env }) => {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const prefix = (stream) => (chunk) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) stream.write(`[${name}] ${line}\n`);
    }
  };
  child.stdout.on('data', prefix(process.stdout));
  child.stderr.on('data', prefix(process.stderr));
  child.on('exit', (code) => {
    process.stderr.write(`[${name}] saiu com codigo ${code}\n`);
    shutdown();
  });
  return child;
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('API em http://localhost:3001 · interface em http://localhost:3000');
