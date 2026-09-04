/**
 * Healthcheck real (§26): confirma que o Chromium abre e que os modulos do QualWeb
 * carregam. O resultado e cacheado porque abrir o Chromium custa ~250 ms e o
 * healthcheck do Docker roda com frequencia.
 */

import { createRequire } from 'node:module';

import type { HealthResponse, VersionInfo } from '@lae/shared-types';

const require_ = createRequire(__filename);

export interface HealthProbeOptions {
  browserExecutablePath: string | null;
  ttlMs: number;
  versions(chromium: string | null): VersionInfo;
}

interface CachedHealth {
  at: number;
  value: HealthResponse;
}

export class HealthProbe {
  private cache: CachedHealth | null = null;

  constructor(private readonly options: HealthProbeOptions) {}

  async check(force = false): Promise<HealthResponse> {
    if (!force && this.cache && Date.now() - this.cache.at < this.options.ttlMs) return this.cache.value;

    const details: Record<string, string> = {};

    let qualweb: 'ok' | 'error' = 'ok';
    try {
      require_('@qualweb/core');
      require_('@qualweb/act-rules');
      require_('@qualweb/wcag-techniques');
      require_('@qualweb/best-practices');
      require_('@qualweb/counter');
    } catch (error) {
      qualweb = 'error';
      details['qualweb'] = error instanceof Error ? error.message : String(error);
    }

    let browser: 'ok' | 'error' = 'ok';
    let chromiumVersion: string | null = null;
    try {
      const puppeteer = require_('puppeteer') as typeof import('puppeteer');
      const instance = await puppeteer.launch({
        headless: true,
        ...(this.options.browserExecutablePath ? { executablePath: this.options.browserExecutablePath } : {}),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
      chromiumVersion = await instance.version();
      details['browserExecutable'] = instance.process()?.spawnfile ?? 'unknown';
      await instance.close();
    } catch (error) {
      browser = 'error';
      details['browser'] = error instanceof Error ? error.message : String(error);
    }

    const value: HealthResponse = {
      status: qualweb === 'ok' && browser === 'ok' ? 'ok' : 'degraded',
      api: 'ok',
      qualweb,
      browser,
      versions: this.options.versions(chromiumVersion),
      checkedAt: new Date().toISOString(),
      ...(Object.keys(details).length > 0 ? { details } : {}),
    };

    this.cache = { at: Date.now(), value };
    return value;
  }
}
