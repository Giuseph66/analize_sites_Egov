import { useMemo, useState } from 'react';

import type { AccessibilityResult, EvaluationReport, LogEntry, ResultOutcome } from '@lae/shared-types';

import { api } from './api';

const OUTCOME_LABEL: Record<ResultOutcome, string> = {
  failed: 'Erro',
  warning: 'Verificar',
  passed: 'Passou',
  inapplicable: 'Não se aplica',
  manual: 'Manual',
};

interface Props {
  report: EvaluationReport;
  logs: LogEntry[];
  onReset(): void;
}

export function ReportView({ report, logs, onReset }: Props): JSX.Element {
  const [outcome, setOutcome] = useState<ResultOutcome | 'all'>('failed');
  const [level, setLevel] = useState<string>('all');
  const [module, setModule] = useState<string>('all');
  const [text, setText] = useState('');

  const filtered = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return report.results.filter((result) => {
      if (outcome !== 'all' && result.result !== outcome) return false;
      if (level !== 'all') {
        if (level === 'none' ? result.wcag?.level !== undefined : result.wcag?.level !== level) return false;
      }
      if (module !== 'all' && result.module !== module) return false;
      if (!needle) return true;
      return [
        result.ruleId,
        result.title,
        result.description,
        result.wcag?.criterion,
        result.technique,
        result.actRule,
        result.element?.selector,
        result.element?.html,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [report.results, outcome, level, module, text]);

  return (
    <>
      <div className="row">
        <h2 style={{ margin: 0 }}>Avaliação concluída</h2>
        <span className="spacer" />
        <button type="button" className="secondary" onClick={onReset}>Nova análise</button>
      </div>

      <p className="mono muted">
        {report.url}
        {report.resolvedUrl !== report.url && <> → carregada como <strong>{report.resolvedUrl}</strong></>}
        {report.finalUrl && report.finalUrl !== report.resolvedUrl && <> → final <strong>{report.finalUrl}</strong></>}
      </p>

      <section className="panel" aria-label="Nota geral">
        <div className="score">
          <span className="value">{report.score.value.toFixed(1)}</span>
          <span className="scale">/ {report.score.scale[1]} — {report.score.label}</span>
        </div>
        {report.score.disclaimer && <p className="disclaimer">{report.score.disclaimer}</p>}
      </section>

      <h3>Resultados</h3>
      <div className="cards">
        <Card className="failed" value={report.summary.failed} label="Erros" />
        <Card className="warning" value={report.summary.warning} label="Avisos / verificar" />
        <Card className="passed" value={report.summary.passed} label="Resultados positivos" />
        <Card className="inapplicable" value={report.summary.inapplicable} label="Não se aplica" />
        <Card value={report.summary.manual} label="Verificação manual" />
      </div>

      <h3>Regras com erro, por nível WCAG</h3>
      <div className="cards">
        <Card className="failed" value={report.wcagFailures.A} label="WCAG A" />
        <Card className="failed" value={report.wcagFailures.AA} label="WCAG AA" />
        <Card className="failed" value={report.wcagFailures.AAA} label="WCAG AAA" />
        <Card value={report.wcagFailures.unmapped} label="Sem critério WCAG" />
      </div>
      <p className="hint">
        Cada regra com erro é contada uma única vez, no nível mais severo a que ela responde
        (A &gt; AA &gt; AAA). Regras sem critério de sucesso associado — parte das best practices —
        aparecem em “sem critério”.
      </p>

      <h3>Filtros</h3>
      <div className="filters">
        <div>
          <label htmlFor="f-outcome">Status</label>
          <select id="f-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as ResultOutcome | 'all')}>
            <option value="all">Todos ({report.results.length})</option>
            <option value="failed">Erros ({report.summary.failed})</option>
            <option value="warning">Avisos ({report.summary.warning})</option>
            <option value="passed">Passou ({report.summary.passed})</option>
            <option value="inapplicable">Não se aplica ({report.summary.inapplicable})</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-level">Nível WCAG</label>
          <select id="f-level" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="all">Todos</option>
            <option value="A">A</option>
            <option value="AA">AA</option>
            <option value="AAA">AAA</option>
            <option value="none">Sem critério</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-module">Módulo</label>
          <select id="f-module" value={module} onChange={(e) => setModule(e.target.value)}>
            <option value="all">Todos</option>
            <option value="act-rules">ACT Rules ({report.rulesByModule['act-rules'] ?? 0})</option>
            <option value="wcag-techniques">WCAG Techniques ({report.rulesByModule['wcag-techniques'] ?? 0})</option>
            <option value="best-practices">Best Practices ({report.rulesByModule['best-practices'] ?? 0})</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-text">Texto (regra, critério, seletor, HTML)</label>
          <input id="f-text" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="ex.: 1.1.1, img, QW-ACT-R17" />
        </div>
      </div>

      <p className="muted" aria-live="polite">{filtered.length} regra(s) exibida(s).</p>

      <ul className="results">
        {filtered.map((result) => (
          <li key={`${result.module}-${result.ruleId}`}>
            <ResultItem result={result} pageUrl={report.finalUrl ?? report.resolvedUrl} />
          </li>
        ))}
      </ul>

      <h3>Execução</h3>
      <table className="plain">
        <tbody>
          <Row label="Duração total" value={`${(report.duration / 1000).toFixed(2)} s`} />
          <Row label="Chromium (inicialização)" value={ms(report.timings.browserLaunchMs)} />
          <Row label="Navegação" value={ms(report.timings.navigationMs)} />
          <Row label="QualWeb" value={ms(report.timings.qualwebMs)} />
          <Row label="Normalização" value={ms(report.timings.normalizationMs)} />
          {Object.entries(report.timings.modulesMs).map(([name, value]) => (
            <Row key={name} label={`Módulo ${name}`} value={ms(value)} />
          ))}
          <Row label="HTTP status" value={report.diagnostics.httpStatus ?? '—'} />
          <Row label="Redirects" value={report.diagnostics.redirects.length} />
          <Row label="Erros JS na página" value={report.diagnostics.pageErrors.length} />
          <Row label="Falhas de rede" value={report.diagnostics.networkFailures.length} />
          <Row label="Mensagens de console" value={report.diagnostics.consoleMessages.length} />
          <Row label="Título" value={report.page.title ?? '—'} />
          <Row label="Elementos no DOM" value={report.page.elementCount ?? '—'} />
          <Row label="lang do documento" value={report.page.lang ?? '(ausente)'} />
        </tbody>
      </table>

      {report.diagnostics.networkFailures.length > 0 && (
        <>
          <h3>Recursos que falharam durante a análise</h3>
          <table className="plain">
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Método</th>
                <th scope="col">Tipo</th>
                <th scope="col">URL</th>
              </tr>
            </thead>
            <tbody>
              {report.diagnostics.networkFailures.map((failure, index) => (
                <tr key={`${failure.url}-${index}`}>
                  <td className="mono">{failure.status ?? failure.errorText ?? '—'}</td>
                  <td className="mono">{failure.method}</td>
                  <td className="mono">{failure.resourceType}</td>
                  <td className="mono">{failure.url}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3>Versões</h3>
      <table className="plain">
        <tbody>
          {Object.entries(report.versions).map(([key, value]) => (
            <Row key={key} label={key} value={value ?? '—'} />
          ))}
        </tbody>
      </table>

      <h3>Exportar</h3>
      <div className="row">
        <a href={api.reportUrl(report.id)} download={`report-${report.id}.json`}>JSON normalizado</a>
        <a href={api.rawReportUrl(report.id)}>JSON original do QualWeb</a>
        <a href={api.earlReportUrl(report.id)}>EARL</a>
        {report.diagnostics.screenshotPath && <a href={api.screenshotUrl(report.id)}>Screenshot</a>}
      </div>

      {logs.length > 0 && (
        <>
          <h3>Log da execução</h3>
          <div className="log">
            {logs.map((entry, index) => (
              <span className="line" key={`${entry.ts}-${index}`}>
                <span className="src">{entry.ts.slice(11, 23)} </span>
                <span className="src" data-src={entry.source}>{entry.source.padEnd(11)} </span>
                <span className={entry.level === 'error' ? 'lvl-error' : entry.level === 'warn' ? 'lvl-warn' : ''}>
                  {entry.message}
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ResultItem({ result, pageUrl }: { result: AccessibilityResult; pageUrl: string }): JSX.Element {
  return (
    <details>
      <summary>
        <span className={`badge ${result.result}`}>{OUTCOME_LABEL[result.result]}</span>
        <span className="rule-title">
          {result.title}
          {result.elementsTotal > 0 && (result.result === 'failed' || result.result === 'warning') && (
            <span className="muted"> — {result.elementsTotal} {result.elementsTotal === 1 ? 'ocorrência' : 'ocorrências'}</span>
          )}
        </span>
        <span className="rule-id">
          {result.ruleId}
          {result.wcag?.criterion ? ` · WCAG ${result.wcag.criterion} (${result.wcag.level})` : ''}
        </span>
      </summary>

      <div className="detail">
        <dl>
          <dt>Critério</dt>
          <dd>
            {result.wcagCriteria.length > 0
              ? result.wcagCriteria.map((criterion) => (
                  <div key={criterion.criterion}>
                    WCAG {criterion.criterion} ({criterion.level}){criterion.principle ? ` — ${criterion.principle}` : ''}{' '}
                    {criterion.url && <a href={criterion.url} target="_blank" rel="noreferrer">documentação</a>}
                  </div>
                ))
              : '(a regra não declara critério de sucesso)'}
          </dd>

          <dt>Regra</dt>
          <dd>
            {result.title} <span className="mono">({result.ruleId})</span>
            {result.url && <> · <a href={result.url} target="_blank" rel="noreferrer">documentação</a></>}
          </dd>

          <dt>Resultado</dt>
          <dd>{OUTCOME_LABEL[result.result].toUpperCase()}</dd>

          <dt>Motor</dt>
          <dd className="mono">{result.engine} {result.engineVersion} · módulo {result.module}</dd>

          {result.actRule && (<><dt>ACT rule</dt><dd className="mono">{result.actRule}</dd></>)}
          {result.technique && (<><dt>Técnica WCAG</dt><dd className="mono">{result.technique}</dd></>)}

          <dt>Página</dt>
          <dd className="mono">{pageUrl}</dd>

          <dt>Descrição</dt>
          <dd>{result.outcomeDescription || result.description || '—'}</dd>
        </dl>

        {result.elements.length > 0 && (
          <>
            <h4 style={{ fontSize: '.8rem', margin: '1rem 0 .25rem' }}>
              Elementos ({result.elementsTotal})
            </h4>
            {result.elements.map((element, index) => (
              <div key={index} style={{ marginBottom: '.6rem' }}>
                {element.html && <pre className="code">{element.html}</pre>}
                {element.selector && (
                  <p className="mono muted" style={{ margin: '.25rem 0 0' }}>
                    seletor: {element.selector}
                  </p>
                )}
                {element.accessibleName && (
                  <p className="mono muted" style={{ margin: 0 }}>nome acessível: {element.accessibleName}</p>
                )}
              </div>
            ))}
            {result.elementsTotal > result.elements.length && (
              <p className="muted">
                … e mais {result.elementsTotal - result.elements.length} elemento(s). O conjunto
                completo está no JSON original do QualWeb.
              </p>
            )}
          </>
        )}
      </div>
    </details>
  );
}

function Card({ value, label, className }: { value: number; label: string; className?: string }): JSX.Element {
  return (
    <div className={`card ${className ?? ''}`}>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className="mono">{value}</td>
    </tr>
  );
}

function ms(value: number | null): string {
  return value === null ? '—' : `${value} ms`;
}
