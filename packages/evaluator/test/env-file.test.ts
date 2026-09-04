import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { loadEnvFile, parseEnvFile } from '../src/env-file';

describe('parseEnvFile', () => {
  it('lê pares chave=valor simples', () => {
    assert.deepEqual(parseEnvFile('PAGE_TIMEOUT=99999\nBROWSER_HEADLESS=true'), {
      PAGE_TIMEOUT: '99999',
      BROWSER_HEADLESS: 'true',
    });
  });

  it('ignora comentários e linhas vazias', () => {
    const parsed = parseEnvFile('# comentário\n\n  # outro\nPORT=3000\n');
    assert.deepEqual(parsed, { PORT: '3000' });
  });

  it('remove comentário no fim da linha, mas preserva o que está entre aspas', () => {
    const parsed = parseEnvFile('A=1 # isto é comentário\nB="tem # dentro"\nC=sem-comentario#colado');
    assert.equal(parsed['A'], '1');
    assert.equal(parsed['B'], 'tem # dentro');
    // Sem espaço antes do '#' não é comentário: faz parte do valor.
    assert.equal(parsed['C'], 'sem-comentario#colado');
  });

  it('aceita valor vazio e o prefixo export', () => {
    const parsed = parseEnvFile('BROWSER_EXECUTABLE_PATH=\nexport LOCALHOST_ALIAS=host.docker.internal');
    assert.equal(parsed['BROWSER_EXECUTABLE_PATH'], '');
    assert.equal(parsed['LOCALHOST_ALIAS'], 'host.docker.internal');
  });

  it('tira aspas simples e duplas', () => {
    const parsed = parseEnvFile(`A="com espaço"\nB='simples'`);
    assert.equal(parsed['A'], 'com espaço');
    assert.equal(parsed['B'], 'simples');
  });

  it('descarta linhas malformadas em vez de estourar', () => {
    const parsed = parseEnvFile('sem_igual\n=sem_chave\n1INVALIDA=x\nVALIDA=ok');
    assert.deepEqual(parsed, { VALIDA: 'ok' });
  });
});

describe('loadEnvFile', () => {
  it('devolve null quando não existe .env', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lae-env-'));
    try {
      assert.equal(loadEnvFile(dir, {}), null);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('aplica ao ambiente e NÃO sobrescreve o que já está definido', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lae-env-'));
    try {
      await writeFile(join(dir, '.env'), 'PAGE_TIMEOUT=99999\nPORT=3000\n', 'utf-8');

      // PORT ja vem do ambiente (é o que o docker-compose e o scripts/dev.mjs fazem):
      // o arquivo não pode vencer, senão a configuração explícita seria ignorada.
      const env: NodeJS.ProcessEnv = { PORT: '3001' };
      const result = loadEnvFile(dir, env);

      assert.ok(result);
      assert.equal(env['PAGE_TIMEOUT'], '99999');
      assert.equal(env['PORT'], '3001', 'variável já definida no ambiente tem precedência');
      assert.deepEqual(result.applied, ['PAGE_TIMEOUT']);
      assert.deepEqual(result.skipped, ['PORT']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
