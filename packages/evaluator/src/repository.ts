/**
 * Persistencia das avaliacoes.
 *
 * A interface existe para que trocar filesystem por PostgreSQL depois seja uma
 * troca de implementacao, nao uma reescrita (§20). Nada fora deste arquivo
 * monta caminhos de arquivo.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { EvaluationMetadata, EvaluationReport, LogEntry } from '@lae/shared-types';
import { formatHuman } from '@lae/logger';

export interface EvaluationRepository {
  create(metadata: EvaluationMetadata): Promise<void>;
  update(id: string, patch: Partial<EvaluationMetadata>): Promise<EvaluationMetadata>;
  get(id: string): Promise<EvaluationMetadata | null>;
  list(limit?: number): Promise<EvaluationMetadata[]>;

  saveRawReport(id: string, url: string, raw: unknown): Promise<string>;
  getRawReport(id: string): Promise<unknown | null>;

  saveReport(id: string, url: string, report: EvaluationReport): Promise<string>;
  getReport(id: string): Promise<EvaluationReport | null>;

  saveLogs(id: string, entries: LogEntry[]): Promise<string>;
  getLogs(id: string): Promise<LogEntry[]>;

  /** Diretorio de artefatos (screenshot.png, page.html) da avaliacao. */
  artifactDir(id: string): string;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host.replace(/[^a-zA-Z0-9._-]/g, '_');
  } catch {
    return 'unknown-host';
  }
}

function fileStamp(iso: string): string {
  return iso.replace(/[:.]/g, '').replace('Z', 'Z');
}

export class FilesystemEvaluationRepository implements EvaluationRepository {
  private readonly evaluationsDir: string;
  private readonly rawDir: string;
  private readonly reportsDir: string;

  /** Cache em memoria; a fonte da verdade continua sendo o disco. */
  private readonly cache = new Map<string, EvaluationMetadata>();

  constructor(dataDir: string) {
    const root = resolve(dataDir);
    this.evaluationsDir = join(root, 'evaluations');
    this.rawDir = join(root, 'raw');
    this.reportsDir = join(root, 'reports');
  }

  artifactDir(id: string): string {
    return join(this.evaluationsDir, id);
  }

  private metadataPath(id: string): string {
    return join(this.artifactDir(id), 'metadata.json');
  }

  async create(metadata: EvaluationMetadata): Promise<void> {
    await mkdir(this.artifactDir(metadata.id), { recursive: true });
    this.cache.set(metadata.id, metadata);
    await writeFile(this.metadataPath(metadata.id), JSON.stringify(metadata, null, 2), 'utf-8');
  }

  async update(id: string, patch: Partial<EvaluationMetadata>): Promise<EvaluationMetadata> {
    const current = await this.get(id);
    if (!current) throw new Error(`Avaliacao desconhecida: ${id}`);
    const next: EvaluationMetadata = { ...current, ...patch, id: current.id };
    this.cache.set(id, next);
    await writeFile(this.metadataPath(id), JSON.stringify(next, null, 2), 'utf-8');
    return next;
  }

  async get(id: string): Promise<EvaluationMetadata | null> {
    const cached = this.cache.get(id);
    if (cached) return cached;
    try {
      const parsed = JSON.parse(await readFile(this.metadataPath(id), 'utf-8')) as EvaluationMetadata;
      this.cache.set(id, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  async list(limit = 50): Promise<EvaluationMetadata[]> {
    let ids: string[];
    try {
      ids = await readdir(this.evaluationsDir);
    } catch {
      return [];
    }

    const all: EvaluationMetadata[] = [];
    for (const id of ids) {
      const metadata = await this.get(id);
      if (metadata) all.push(metadata);
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  async saveRawReport(id: string, url: string, raw: unknown): Promise<string> {
    const path = join(this.artifactDir(id), 'raw-qualweb.json');
    const payload = JSON.stringify(raw, null, 2);
    await mkdir(this.artifactDir(id), { recursive: true });
    await writeFile(path, payload, 'utf-8');

    // Copia em data/raw/ com nome legivel, conforme §3/§9.
    await mkdir(this.rawDir, { recursive: true });
    await writeFile(join(this.rawDir, `${fileStamp(new Date().toISOString())}-${safeHost(url)}-${id.slice(0, 8)}.json`), payload, 'utf-8');

    return path;
  }

  async getRawReport(id: string): Promise<unknown | null> {
    try {
      return JSON.parse(await readFile(join(this.artifactDir(id), 'raw-qualweb.json'), 'utf-8'));
    } catch {
      return null;
    }
  }

  async saveReport(id: string, url: string, report: EvaluationReport): Promise<string> {
    const path = join(this.artifactDir(id), 'report.json');
    const payload = JSON.stringify(report, null, 2);
    await mkdir(this.artifactDir(id), { recursive: true });
    await writeFile(path, payload, 'utf-8');

    await mkdir(this.reportsDir, { recursive: true });
    await writeFile(join(this.reportsDir, `${fileStamp(report.startedAt)}-${safeHost(url)}-${id.slice(0, 8)}.json`), payload, 'utf-8');

    return path;
  }

  async getReport(id: string): Promise<EvaluationReport | null> {
    try {
      return JSON.parse(await readFile(join(this.artifactDir(id), 'report.json'), 'utf-8')) as EvaluationReport;
    } catch {
      return null;
    }
  }

  async saveLogs(id: string, entries: LogEntry[]): Promise<string> {
    await mkdir(this.artifactDir(id), { recursive: true });
    const textPath = join(this.artifactDir(id), 'logs.txt');
    await writeFile(textPath, entries.map(formatHuman).join('\n') + '\n', 'utf-8');
    await writeFile(
      join(this.artifactDir(id), 'logs.jsonl'),
      entries.map((e) => JSON.stringify(e)).join('\n') + '\n',
      'utf-8',
    );
    return textPath;
  }

  async getLogs(id: string): Promise<LogEntry[]> {
    try {
      const content = await readFile(join(this.artifactDir(id), 'logs.jsonl'), 'utf-8');
      return content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as LogEntry);
    } catch {
      return [];
    }
  }
}
