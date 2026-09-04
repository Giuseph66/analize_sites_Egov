/**
 * Compara, para a mesma URL:
 *
 *   1. o relatorio bruto do QualWeb;
 *   2. o nosso formato normalizado, derivado dele;
 *   3. (opcional, com --with-axe) uma execucao do axe-core.
 *
 * O objetivo de (1) vs (2) e provar que a normalizacao nao perde nem inventa
 * resultados. O axe-core entra como ferramenta SECUNDARIA e cada linha do
 * relatorio carrega o campo `engine`, para que nunca haja duvida sobre qual
 * motor produziu qual resultado (§18).
 *
 *   npm run compare -- http://localhost:5173
 *   npm run compare -- http://localhost:5173 --with-axe
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { QualWeb, type QualwebOptions } from '@qualweb/core';
import { ACTRules } from '@qualweb/act-rules';
import { WCAGTechniques } from '@qualweb/wcag-techniques';
import { BestPractices } from '@qualweb/best-practices';
import { Counter } from '@qualweb/counter';
import type { Page } from 'puppeteer';

import { normalizeQualwebReport, type RawQualwebReport } from '@lae/report-normalizer';
import { qualwebVersions } from '@lae/evaluator';

interface EngineFinding {
  engine: 'qualweb' | 'axe-core';
  engineVersion: string;
  ruleId: string;
  outcome: string;
  wcag: string | null;
  elements: number;
}

const repoRoot = resolve(__dirname, '..');

function parseArgs(): { url: string; withAxe: boolean } {
  const args = process.argv.slice(2);
  const url = args.find((arg) => !arg.startsWith('--'));
  if (!url) throw new Error('Uso: npm run compare -- <url> [--with-axe]');
  return { url, withAxe: args.includes('--with-axe') };
}

async function main(): Promise<void> {
  const { url, withAxe } = parseArgs();
  const versions = qualwebVersions();

  console.log(`URL           : ${url}`);
  console.log(`QualWeb core  : ${versions.core}`);
  console.log('');

  const qualweb = new QualWeb({ adBlock: false, stealth: false });

  let axeFindings: EngineFinding[] = [];
  let axeVersion = '';

  if (withAxe) {
    // axe-core roda no mesmo carregamento de pagina, injetado apos o load e antes
    // de o QualWeb injetar os proprios scripts.
    const axeSource = require('axe-core') as { source: string; version: string };
    axeVersion = axeSource.version;

    qualweb.use({
      afterPageLoad(driverPage) {
        const page = driverPage.nativePage as Page;
        return (async () => {
          await page.evaluate(axeSource.source);
          const axeResults = (await page.evaluate(async () => {
            const axe = (window as unknown as { axe: { run(): Promise<unknown> } }).axe;
            return axe.run();
          })) as {
            violations: { id: string; tags: string[]; nodes: unknown[] }[];
            passes: { id: string; tags: string[]; nodes: unknown[] }[];
            incomplete: { id: string; tags: string[]; nodes: unknown[] }[];
          };

          const collect = (list: { id: string; tags: string[]; nodes: unknown[] }[], outcome: string): void => {
            for (const item of list) {
              axeFindings.push({
                engine: 'axe-core',
                engineVersion: axeVersion,
                ruleId: item.id,
                outcome,
                wcag: item.tags.find((tag) => /^wcag\d/.test(tag)) ?? null,
                elements: item.nodes.length,
              });
            }
          };

          collect(axeResults.violations, 'failed');
          collect(axeResults.passes, 'passed');
          collect(axeResults.incomplete, 'warning');
        })();
      },
    });
  }

  await qualweb.start(
    { maxConcurrency: 1, timeout: 120_000, monitor: false },
    { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] },
  );

  const options: QualwebOptions = {
    url,
    modules: [new ACTRules(), new WCAGTechniques(), new BestPractices(), new Counter()],
    waitUntil: ['load', 'networkidle2'],
    translate: 'en',
  };

  let raw: RawQualwebReport;
  try {
    const reports = await qualweb.evaluate(options);
    raw = reports[url] as unknown as RawQualwebReport;
    if (!raw) throw new Error(`QualWeb nao devolveu relatorio para ${url}`);
  } finally {
    await qualweb.stop();
  }

  // ---- 1. contagens direto do bruto -------------------------------------
  const rawCounts = { passed: 0, warning: 0, failed: 0, inapplicable: 0 };
  const rawRuleIds = new Set<string>();

  for (const moduleName of ['act-rules', 'wcag-techniques', 'best-practices'] as const) {
    const assertions = raw.modules?.[moduleName]?.assertions ?? {};
    for (const [code, assertion] of Object.entries(assertions)) {
      rawRuleIds.add(code);
      const outcome = assertion.metadata?.outcome;
      if (outcome === 'passed' || outcome === 'warning' || outcome === 'failed' || outcome === 'inapplicable') {
        rawCounts[outcome] += 1;
      }
    }
  }

  // ---- 2. nosso formato normalizado -------------------------------------
  const normalized = normalizeQualwebReport(raw, versions.core);
  const normalizedRuleIds = new Set(normalized.results.map((result) => result.ruleId));

  console.log('QualWeb bruto vs formato normalizado');
  console.log('─'.repeat(64));
  console.log('outcome         bruto   normalizado   diferenca');
  let mismatch = false;
  for (const key of ['passed', 'warning', 'failed', 'inapplicable'] as const) {
    const a = rawCounts[key];
    const b = normalized.summary[key];
    if (a !== b) mismatch = true;
    console.log(`${key.padEnd(15)} ${String(a).padStart(5)}   ${String(b).padStart(11)}   ${String(b - a).padStart(9)}`);
  }

  const missing = [...rawRuleIds].filter((id) => !normalizedRuleIds.has(id));
  const invented = [...normalizedRuleIds].filter((id) => !rawRuleIds.has(id));

  console.log('');
  console.log(`regras no bruto        : ${rawRuleIds.size}`);
  console.log(`regras no normalizado  : ${normalizedRuleIds.size}`);
  console.log(`perdidas na conversao  : ${missing.length}${missing.length ? ' -> ' + missing.join(', ') : ''}`);
  console.log(`inventadas             : ${invented.length}${invented.length ? ' -> ' + invented.join(', ') : ''}`);
  console.log('');
  console.log(
    mismatch || missing.length > 0 || invented.length > 0
      ? 'DIVERGENCIA: a normalizacao nao corresponde ao bruto.'
      : 'OK: a normalizacao corresponde exatamente ao bruto.',
  );

  // ---- 3. axe-core, se pedido -------------------------------------------
  const qualwebFindings: EngineFinding[] = normalized.results.map((result) => ({
    engine: 'qualweb',
    engineVersion: versions.core,
    ruleId: result.ruleId,
    outcome: result.result,
    wcag: result.wcag?.criterion ?? null,
    elements: result.elementsTotal,
  }));

  if (withAxe) {
    console.log('');
    console.log(`axe-core ${axeVersion} (motor SECUNDARIO, nunca substitui o QualWeb)`);
    console.log('─'.repeat(64));
    const axeFailed = axeFindings.filter((f) => f.outcome === 'failed');
    console.log(`qualweb  : ${normalized.summary.failed} regras com falha`);
    console.log(`axe-core : ${axeFailed.length} regras com violacao`);
    console.log('');
    console.log('violacoes do axe-core:');
    for (const finding of axeFailed) {
      console.log(`  ${finding.ruleId.padEnd(34)} ${String(finding.elements).padStart(3)} elemento(s)  ${finding.wcag ?? ''}`);
    }
    console.log('');
    console.log(
      'Os dois motores usam catalogos de regras diferentes; nao ha correspondencia 1:1.\n' +
        'A comparacao serve para descobrir barreiras que so um deles detecta.',
    );
  }

  // ---- saida em arquivo --------------------------------------------------
  const outDir = resolve(repoRoot, 'data/reports');
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, `compare-${new Date().toISOString().replace(/[:.]/g, '')}.json`);
  await writeFile(
    outPath,
    JSON.stringify(
      {
        url,
        generatedAt: new Date().toISOString(),
        engines: { qualweb: versions.core, ...(withAxe ? { 'axe-core': axeVersion } : {}) },
        rawCounts,
        normalizedSummary: normalized.summary,
        consistency: { missing, invented, countsMatch: !mismatch },
        findings: [...qualwebFindings, ...axeFindings],
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log('');
  console.log(`comparacao salva em ${outPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
