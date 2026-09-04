import { createRequire } from 'node:module';

const require_ = createRequire(__filename);

/** Versao instalada de um pacote, lida em runtime; null se nao for possivel resolver. */
function packageVersion(name: string): string | null {
  try {
    return (require_(`${name}/package.json`) as { version?: string }).version ?? null;
  } catch {
    // Alguns pacotes do QualWeb declaram "exports" sem "./package.json".
    try {
      const declared = (require_('../package.json') as { dependencies?: Record<string, string> }).dependencies;
      return declared?.[name] ?? null;
    } catch {
      return null;
    }
  }
}

export interface QualwebVersions {
  core: string;
  actRules: string;
  wcagTechniques: string;
  bestPractices: string;
  counter: string;
}

export function qualwebVersions(): QualwebVersions {
  return {
    core: packageVersion('@qualweb/core') ?? 'unknown',
    actRules: packageVersion('@qualweb/act-rules') ?? 'unknown',
    wcagTechniques: packageVersion('@qualweb/wcag-techniques') ?? 'unknown',
    bestPractices: packageVersion('@qualweb/best-practices') ?? 'unknown',
    counter: packageVersion('@qualweb/counter') ?? 'unknown',
  };
}

export function appVersion(): string {
  try {
    return (require_('../package.json') as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
