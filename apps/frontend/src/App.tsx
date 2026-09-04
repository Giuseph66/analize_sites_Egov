import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  EvaluationMetadata,
  EvaluationReport,
  EvaluationStage,
  HealthResponse,
  LogEntry,
} from '@lae/shared-types';

import { api, subscribeToEvaluation } from './api';
import { ReportView } from './ReportView';

const STAGES: { id: EvaluationStage; label: string }[] = [
  { id: 'queued', label: 'Na fila' },
  { id: 'url-resolved', label: 'URL resolvida' },
  { id: 'browser-launched', label: 'Chromium iniciado' },
  { id: 'page-loaded', label: 'Página carregada' },
  { id: 'act-rules', label: 'ACT Rules' },
  { id: 'wcag-techniques', label: 'WCAG Techniques' },
  { id: 'best-practices', label: 'Best Practices' },
  { id: 'normalizing', label: 'Normalizando' },
  { id: 'saving', label: 'Salvando relatório' },
  { id: 'completed', label: 'Concluído' },
];

type View =
  | { kind: 'idle' }
  | { kind: 'running'; id: string }
  | { kind: 'report'; id: string };

export function App(): JSX.Element {
  const [url, setUrl] = useState('http://localhost:5173');
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [recent, setRecent] = useState<EvaluationMetadata[]>([]);

  const [stage, setStage] = useState<EvaluationStage>('created');
  const [status, setStatus] = useState<EvaluationMetadata['status']>('queued');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [metadata, setMetadata] = useState<EvaluationMetadata | null>(null);

  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
    void refreshRecent();
  }, []);

  const refreshRecent = useCallback(async () => {
    try {
      setRecent(await api.listEvaluations());
    } catch {
      // Lista de recentes e conveniencia; falhar aqui nao deve quebrar a tela.
    }
  }, []);

  // Abre a avaliacao indicada no hash da URL (permite recarregar a pagina).
  useEffect(() => {
    const applyHash = (): void => {
      const id = window.location.hash.replace(/^#\/?/, '');
      if (id) void openEvaluation(id);
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view.kind !== 'running') return;

    setLogs([]);
    setReport(null);

    const unsubscribe = subscribeToEvaluation(view.id, (event) => {
      if (event.type === 'log') setLogs((current) => [...current, event.entry]);
      else if (event.type === 'stage') setStage(event.stage);
      else if (event.type === 'status') setStatus(event.status);
      else if (event.type === 'done') {
        setStatus(event.status);
        void finishEvaluation(view.id);
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  async function finishEvaluation(id: string): Promise<void> {
    const meta = await api.getEvaluation(id);
    setMetadata(meta);
    if (meta.status === 'completed') {
      setReport(await api.getReport(id));
      setView({ kind: 'report', id });
    }
    void refreshRecent();
  }

  async function openEvaluation(id: string): Promise<void> {
    try {
      const meta = await api.getEvaluation(id);
      setMetadata(meta);
      setStage(meta.stage);
      setStatus(meta.status);
      setLogs(await api.getLogs(id));
      if (meta.status === 'completed') {
        setReport(await api.getReport(id));
        setView({ kind: 'report', id });
      } else {
        setView({ kind: 'running', id });
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitError(null);
    setStage('created');
    setStatus('queued');
    setMetadata(null);
    try {
      const created = await api.createEvaluation(url);
      window.location.hash = `#/${created.evaluationId}`;
      setView({ kind: 'running', id: created.evaluationId });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    }
  }

  function reset(): void {
    window.location.hash = '';
    setView({ kind: 'idle' });
    setReport(null);
    setLogs([]);
    setMetadata(null);
    void refreshRecent();
  }

  const stageIndex = useMemo(() => STAGES.findIndex((s) => s.id === stage), [stage]);

  return (
    <>
      <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>

      <div className="utility-bar">
        <div className="wrap">
          <span className="meta" style={{ fontFamily: 'inherit', textTransform: 'none' }}>
            Laboratório local de acessibilidade — não afiliado ao AMAWeb
          </span>
          <span className="spacer" />
          <a href="/debug" target="_blank" rel="noreferrer">/debug</a>
        </div>
      </div>

      <header className="top">
        <div className="wrap">
          <p className="wordmark">
            <span className="accent">Avaliador</span> de Acessibilidade
          </p>
          <span className="spacer" />
          <span className="meta">
            {health
              ? `QualWeb ${health.versions.qualwebCore} · ${health.versions.chromium ?? 'chromium ?'} · node ${health.versions.node}`
              : 'verificando motor…'}
          </span>
        </div>
      </header>

      <main className="wrap" id="conteudo">
        {view.kind === 'idle' && (
          <>
            <section className="panel">
              <form className="analyze" onSubmit={(event) => void handleSubmit(event)}>
                <div className="field">
                  <label htmlFor="url">URL para avaliação</label>
                  <input
                    id="url"
                    type="text"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="http://localhost:5173"
                    autoComplete="url"
                    spellCheck={false}
                  />
                </div>
                <button type="submit">Analisar</button>
              </form>
              <p className="hint">
                Endereços locais são aceitos. Dentro do Docker, <code>localhost</code> é reescrito
                para o host automaticamente — as duas URLs aparecem no log.
              </p>
              {submitError && <p className="error" role="alert">{submitError}</p>}
            </section>

            {recent.length > 0 && (
              <>
                <h2>Avaliações recentes</h2>
                <table className="plain">
                  <thead>
                    <tr>
                      <th scope="col">Quando</th>
                      <th scope="col">URL</th>
                      <th scope="col">Status</th>
                      <th scope="col">Duração</th>
                      <th scope="col"><span className="sr">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((item) => (
                      <tr key={item.id}>
                        <td className="mono">{item.createdAt.slice(0, 19).replace('T', ' ')}</td>
                        <td className="mono">{item.url}</td>
                        <td><span className={`status-pill ${item.status}`}>{item.status}</span></td>
                        <td className="mono">{item.durationMs ? `${(item.durationMs / 1000).toFixed(1)} s` : '—'}</td>
                        <td>
                          <button type="button" className="secondary" onClick={() => void openEvaluation(item.id)}>
                            Abrir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        {view.kind === 'running' && (
          <>
            <div className="row">
              <h2 style={{ margin: 0 }}>Avaliação #{view.id.slice(0, 8)}</h2>
              <span className="spacer" />
              <button type="button" className="secondary" onClick={reset}>Nova análise</button>
            </div>

            <p className="muted mono">{metadata?.url ?? url}</p>

            <section className="panel" aria-label="Progresso da avaliação">
              <ol className="stages">
                {STAGES.map((item, index) => {
                  const state =
                    status === 'failed' && index === stageIndex
                      ? 'failed'
                      : stageIndex > index
                        ? 'done'
                        : stageIndex === index
                          ? 'active'
                          : 'pending';
                  const glyph = state === 'done' ? '●' : state === 'active' ? '◉' : state === 'failed' ? '✕' : '○';
                  return (
                    <li key={item.id} data-state={state}>
                      <span className="dot" aria-hidden="true">{glyph}</span>
                      <span>{item.label}</span>
                    </li>
                  );
                })}
              </ol>
            </section>

            <h3 id="log-heading">Log ao vivo</h3>
            <div className="log" ref={logRef} role="log" aria-live="polite" aria-labelledby="log-heading">
              {logs.map((entry, index) => (
                <span className="line" key={`${entry.ts}-${index}`}>
                  <span className="src">{entry.ts.slice(11, 23)} </span>
                  <span className="src" data-src={entry.source}>{entry.source.padEnd(11)} </span>
                  <span className={entry.level === 'error' ? 'lvl-error' : entry.level === 'warn' ? 'lvl-warn' : ''}>
                    {entry.message}
                    {entry.data ? ` ${JSON.stringify(entry.data)}` : ''}
                  </span>
                </span>
              ))}
              {logs.length === 0 && <span className="muted">aguardando eventos…</span>}
            </div>

            {status === 'failed' && metadata?.error && (
              <div className="error" role="alert">
                <strong>Avaliação falhou ({metadata.error.kind}).</strong>
                <br />
                {metadata.error.message}
              </div>
            )}
          </>
        )}

        {view.kind === 'report' && report && (
          <ReportView report={report} logs={logs} onReset={reset} />
        )}
      </main>
    </>
  );
}
