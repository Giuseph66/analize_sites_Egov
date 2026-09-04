/**
 * Carregamento do arquivo .env.
 *
 * Existe porque o README manda copiar `.env.example` para `.env` — e, até esta
 * correção, nada no código lia esse arquivo: quem editava `.env` para ajustar
 * `PAGE_TIMEOUT`, `SPA_SETTLE_MAX_MS` etc. não via efeito nenhum, e a
 * configuração efetiva continuava a dos valores padrão.
 *
 * Sem dependência nova: o formato que precisamos suportar é `CHAVE=valor`, com
 * comentários e aspas opcionais.
 *
 * Semântica deliberada (a mesma do dotenv): variáveis já presentes no ambiente
 * têm PRECEDÊNCIA sobre o arquivo. Isso é o que mantém o `docker-compose.yml`
 * (que injeta env explicitamente) no comando, e permite sobrescrever pontualmente
 * na linha de comando: `PAGE_TIMEOUT=120000 npm run dev`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface LoadEnvFileResult {
  path: string;
  /** Chaves efetivamente aplicadas ao process.env. */
  applied: string[];
  /** Chaves presentes no arquivo mas ignoradas por já existirem no ambiente. */
  skipped: string[];
}

/** Interpreta o conteúdo de um .env. Exportado para poder ser testado sem tocar o disco. */
export function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // `export FOO=bar` também é aceito, porque é comum em arquivos copiados de shell.
    const withoutExport = line.startsWith('export ') ? line.slice('export '.length).trim() : line;

    const separator = withoutExport.indexOf('=');
    if (separator <= 0) continue;

    const key = withoutExport.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = withoutExport.slice(separator + 1).trim();

    // Valor entre aspas preserva espaços e `#`; sem aspas, um `#` inicia comentário.
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n');
    } else {
      const comment = value.indexOf(' #');
      if (comment >= 0) value = value.slice(0, comment).trim();
    }

    values[key] = value;
  }

  return values;
}

/**
 * Lê `<repoRoot>/.env` e aplica ao `process.env` o que ainda não estiver definido.
 * Não faz nada (sem erro) se o arquivo não existir.
 */
export function loadEnvFile(repoRoot: string, env: NodeJS.ProcessEnv = process.env): LoadEnvFileResult | null {
  const path = resolve(repoRoot, '.env');
  if (!existsSync(path)) return null;

  const values = parseEnvFile(readFileSync(path, 'utf-8'));
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const [key, value] of Object.entries(values)) {
    if (env[key] !== undefined) {
      skipped.push(key);
      continue;
    }
    env[key] = value;
    applied.push(key);
  }

  return { path, applied, skipped };
}
