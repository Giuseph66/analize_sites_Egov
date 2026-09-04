/**
 * Logger estruturado com fan-out para varios destinos.
 *
 * Motivacao (§4 e §29): a mesma linha de log precisa aparecer simultaneamente em
 * stdout (visivel em `docker compose logs -f`), em arquivos rotulados por assunto
 * dentro de logs/, no arquivo da propria avaliacao (data/evaluations/<id>/logs.txt)
 * e no stream SSE do frontend. Um logger com lista de sinks resolve os quatro casos
 * sem acoplar nada.
 */

import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EventEmitter } from 'node:events';

import type { LogEntry, LogLevel, LogSource } from '@lae/shared-types';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogSink {
  readonly name: string;
  write(entry: LogEntry): void;
  close?(): void;
}

// ---------------------------------------------------------------------------
// Formatacao
// ---------------------------------------------------------------------------

export function formatHuman(entry: LogEntry): string {
  const time = entry.ts.slice(11, 23);
  const evaluation = entry.evaluationId ? ` [Evaluation ${entry.evaluationId.slice(0, 8)}]` : '';
  const level = entry.level === 'info' ? '' : ` ${entry.level.toUpperCase()}`;
  const data = entry.data && Object.keys(entry.data).length > 0 ? ` ${JSON.stringify(entry.data)}` : '';
  return `[${time}] [${entry.source.padEnd(11)}]${evaluation}${level} ${entry.message}${data}`;
}

// ---------------------------------------------------------------------------
// Sinks
// ---------------------------------------------------------------------------

export class ConsoleSink implements LogSink {
  readonly name = 'console';

  constructor(private readonly minLevel: LogLevel = 'debug') {}

  write(entry: LogEntry): void {
    if (LEVEL_ORDER[entry.level] < LEVEL_ORDER[this.minLevel]) return;
    const line = formatHuman(entry);
    if (entry.level === 'error') process.stderr.write(line + '\n');
    else process.stdout.write(line + '\n');
  }
}

/** Grava JSON Lines. Aceita um filtro para separar assuntos em arquivos distintos. */
export class FileSink implements LogSink {
  readonly name: string;
  private readonly stream: WriteStream;

  constructor(
    filePath: string,
    private readonly filter: (entry: LogEntry) => boolean = () => true,
    private readonly format: 'json' | 'human' = 'json',
  ) {
    this.name = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
    this.stream = createWriteStream(filePath, { flags: 'a' });
  }

  write(entry: LogEntry): void {
    if (!this.filter(entry)) return;
    const line = this.format === 'json' ? JSON.stringify(entry) : formatHuman(entry);
    this.stream.write(line + '\n');
  }

  close(): void {
    this.stream.end();
  }
}

/** Sink em memoria, usado pelos endpoints /logs e /events. */
export class MemorySink implements LogSink {
  readonly name = 'memory';
  private readonly entries: LogEntry[] = [];

  constructor(private readonly limit = 5000) {}

  write(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.limit) this.entries.shift();
  }

  all(): LogEntry[] {
    return [...this.entries];
  }

  forEvaluation(evaluationId: string): LogEntry[] {
    return this.entries.filter((e) => e.evaluationId === evaluationId);
  }
}

/** Reemite cada linha como evento, para o SSE. */
export class EmitterSink extends EventEmitter implements LogSink {
  readonly name = 'emitter';

  write(entry: LogEntry): void {
    this.emit('log', entry);
    if (entry.evaluationId) this.emit(`log:${entry.evaluationId}`, entry);
  }
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export interface LoggerContext {
  evaluationId?: string;
  requestId?: string;
}

export class Logger {
  constructor(
    private readonly sinks: LogSink[],
    private readonly context: LoggerContext = {},
    private readonly minLevel: LogLevel = 'debug',
  ) {}

  /** Deriva um logger que carimba evaluationId/requestId em todas as linhas. */
  child(context: LoggerContext): Logger {
    return new Logger(this.sinks, { ...this.context, ...context }, this.minLevel);
  }

  addSink(sink: LogSink): void {
    this.sinks.push(sink);
  }

  removeSink(sink: LogSink): void {
    const index = this.sinks.indexOf(sink);
    if (index >= 0) this.sinks.splice(index, 1);
    sink.close?.();
  }

  log(level: LogLevel, source: LogSource, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      source,
      message,
      ...(this.context.evaluationId ? { evaluationId: this.context.evaluationId } : {}),
      ...(this.context.requestId ? { requestId: this.context.requestId } : {}),
      ...(data ? { data } : {}),
    };
    for (const sink of this.sinks) {
      try {
        sink.write(entry);
      } catch (error) {
        process.stderr.write(`[logger] sink ${sink.name} failed: ${String(error)}\n`);
      }
    }
  }

  debug(source: LogSource, message: string, data?: Record<string, unknown>): void {
    this.log('debug', source, message, data);
  }
  info(source: LogSource, message: string, data?: Record<string, unknown>): void {
    this.log('info', source, message, data);
  }
  warn(source: LogSource, message: string, data?: Record<string, unknown>): void {
    this.log('warn', source, message, data);
  }
  error(source: LogSource, message: string, error?: unknown, data?: Record<string, unknown>): void {
    const detail: Record<string, unknown> = { ...data };
    if (error instanceof Error) {
      detail['error'] = `${error.name}: ${error.message}`;
      if (error.stack) detail['stack'] = error.stack;
    } else if (error !== undefined) {
      detail['error'] = String(error);
    }
    this.log('error', source, message, detail);
  }
}

// ---------------------------------------------------------------------------
// Montagem padrao (§4: logs/application.log, evaluations.log, browser.log, error.log)
// ---------------------------------------------------------------------------

export interface RootLoggerParts {
  logger: Logger;
  memory: MemorySink;
  emitter: EmitterSink;
  sinks: LogSink[];
}

export function createRootLogger(logsDir: string, minLevel: LogLevel = 'debug'): RootLoggerParts {
  const dir = resolve(logsDir);
  const memory = new MemorySink();
  const emitter = new EmitterSink();

  const sinks: LogSink[] = [
    new ConsoleSink(minLevel),
    new FileSink(resolve(dir, 'application.log')),
    new FileSink(resolve(dir, 'evaluations.log'), (e) => Boolean(e.evaluationId)),
    new FileSink(resolve(dir, 'browser.log'), (e) => e.source === 'BROWSER' || e.source === 'TARGET PAGE'),
    new FileSink(resolve(dir, 'error.log'), (e) => e.level === 'error'),
    memory,
    emitter,
  ];

  return { logger: new Logger(sinks, {}, minLevel), memory, emitter, sinks };
}
