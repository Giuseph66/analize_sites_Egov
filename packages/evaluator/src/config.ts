import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1' || value === 'yes';
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface EvaluatorConfig {
  dataDir: string;
  logsDir: string;

  browserHeadless: boolean;
  browserTimeout: number;
  pageTimeout: number;
  browserExecutablePath: string | null;

  evaluationTimeout: number;
  maxConcurrentEvaluations: number;
  maxQueueSize: number;

  captureScreenshot: boolean;
  saveHtml: boolean;

  allowLocalNetwork: boolean;
  allowFileProtocol: boolean;
  maxRedirects: number;

  /** Host que substitui localhost/127.0.0.1 quando rodamos dentro de um container. */
  localhostAlias: string | null;
  runningInContainer: boolean;

  scoringStrategy: string;
}

/** true quando o processo esta dentro de um container Docker. */
export function detectContainer(): boolean {
  if (process.env['RUNNING_IN_DOCKER'] !== undefined) return bool(process.env['RUNNING_IN_DOCKER'], false);
  return existsSync('/.dockerenv');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, repoRoot = process.cwd()): EvaluatorConfig {
  const runningInContainer = detectContainer();

  return {
    dataDir: resolve(repoRoot, env['DATA_DIR'] ?? 'data'),
    logsDir: resolve(repoRoot, env['LOGS_DIR'] ?? 'logs'),

    browserHeadless: bool(env['BROWSER_HEADLESS'], true),
    browserTimeout: int(env['BROWSER_TIMEOUT'], 30_000),
    pageTimeout: int(env['PAGE_TIMEOUT'], 30_000),
    browserExecutablePath: env['BROWSER_EXECUTABLE_PATH'] || null,

    evaluationTimeout: int(env['EVALUATION_TIMEOUT'], 60_000),
    maxConcurrentEvaluations: int(env['MAX_CONCURRENT_EVALUATIONS'], 2),
    maxQueueSize: int(env['MAX_QUEUE_SIZE'], 20),

    captureScreenshot: bool(env['CAPTURE_SCREENSHOT'], false),
    saveHtml: bool(env['SAVE_HTML'], false),

    allowLocalNetwork: bool(env['ALLOW_LOCAL_NETWORK'], true),
    allowFileProtocol: bool(env['ALLOW_FILE_PROTOCOL'], false),
    maxRedirects: int(env['MAX_REDIRECTS'], 10),

    // Em Linux, `host.docker.internal` so existe se o compose declarar
    // extra_hosts: ["host.docker.internal:host-gateway"]. Ver docs/architecture.md.
    localhostAlias: env['LOCALHOST_ALIAS'] || (runningInContainer ? 'host.docker.internal' : null),
    runningInContainer,

    scoringStrategy: env['SCORING_STRATEGY'] ?? 'experimental-v1',
  };
}
