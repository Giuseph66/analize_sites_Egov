import { useMemo, useRef, useState } from 'react';

import type {
  AccessMonitorColor,
  AccessMonitorPractice,
  AccessibilityResult,
  EvaluationReport,
  LogEntry,
  ResultOutcome,
} from '@lae/shared-types';

import { api } from './api';

const OUTCOME_LABEL: Record<ResultOutcome, string> = {
  failed: 'Erro',
  warning: 'Verificar',
  passed: 'Passou',
  inapplicable: 'Não se aplica',
  manual: 'Manual',
};

/** As três abas centrais espelham a linguagem do AMAWeb (Erros / Revisar / Aceito);
 * "Não se aplica" é uma quarta aba nossa, pois é um dado real que o AMAWeb não expõe
 * separadamente. */
const TABS: { outcome: ResultOutcome; label: string }[] = [
  { outcome: 'failed', label: 'Erros' },
  { outcome: 'warning', label: 'Revisar manualmente' },
  { outcome: 'passed', label: 'Aceito' },
  { outcome: 'inapplicable', label: 'Não se aplica' },
];

/** Abas da visao AccessMonitor: a semantica de cor do proprio AccessMonitor. */
const AM_TABS: { color: AccessMonitorColor; label: string; tone: ResultOutcome }[] = [
  { color: 'R', label: 'Erros', tone: 'failed' },
  { color: 'Y', label: 'Revisar manualmente', tone: 'warning' },
  { color: 'G', label: 'Aceito', tone: 'passed' },
];

const PRINCIPLE_LABEL: Record<string, string> = {
  Perceivable: 'Perceptível',
  Operable: 'Operável',
  Understandable: 'Compreensível',
  Robust: 'Robusto',
};

interface Props {
  report: EvaluationReport;
  logs: LogEntry[];
  onReset(): void;
}

export function ReportView({ report, logs, onReset }: Props): JSX.Element {
  const [outcome, setOutcome] = useState<ResultOutcome>('failed');
  const [level, setLevel] = useState<string>('all');
  const [module, setModule] = useState<string>('all');
  const [principle, setPrinciple] = useState<string>('all');
  const [guideline, setGuideline] = useState<string>('all');
  const [family, setFamily] = useState<string>('all');
  const [target, setTarget] = useState<string>('all');
  const [amGroupQw, setAmGroupQw] = useState<string>('all');
  const [text, setText] = useState('');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Visao AccessMonitor
  const am = report.accessmonitor;
  const [amColor, setAmColor] = useState<AccessMonitorColor>('R');
  const [amGroup, setAmGroup] = useState<string>('all');
  const amTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const amGroups = useMemo(() => {
    if (!am) return [] as { group: string; label: string; count: number }[];
    const map = new Map<string, { group: string; label: string; count: number }>();
    for (const practice of am.practices) {
      const entry = map.get(practice.group) ?? { group: practice.group, label: practice.groupLabel, count: 0 };
      entry.count += 1;
      map.set(practice.group, entry);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [am]);

  const amFiltered = useMemo(() => {
    if (!am) return [] as AccessMonitorPractice[];
    return am.practices.filter((practice) => practice.color === amColor && (amGroup === 'all' || practice.group === amGroup));
  }, [am, amColor, amGroup]);

  const amGroupsByRule = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!am) return map;
    for (const practice of am.practices) {
      for (const rule of practice.qualwebRules) {
        const set = map.get(rule) ?? new Set<string>();
        set.add(practice.groupLabel);
        map.set(rule, set);
      }
    }
    return map;
  }, [am]);

  const facetOptions = useMemo(() => {
    const principles = new Set<string>();
    const guidelines = new Map<string, string>();
    const families = new Set<string>();
    const targets = new Set<string>();
    for (const result of report.results) {
      if (result.principle) principles.add(result.principle);
      if (result.guideline) guidelines.set(result.guideline, result.guidelineName ?? result.guideline);
      if (result.techniqueFamily) families.add(result.techniqueFamily);
      for (const t of result.targets ?? []) targets.add(t);
    }
    return {
      principles: [...principles].sort(),
      guidelines: [...guidelines.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })),
      families: [...families].sort(),
      targets: [...targets].sort(),
    };
  }, [report.results]);

  const filtered = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return report.results.filter((result) => {
      if (result.result !== outcome) return false;
      if (level !== 'all') {
        if (level === 'none' ? result.wcag?.level !== undefined : result.wcag?.level !== level) return false;
      }
      if (module !== 'all' && result.module !== module) return false;
      if (principle !== 'all' && result.principle !== principle) return false;
      if (guideline !== 'all' && result.guideline !== guideline) return false;
      if (family !== 'all' && result.techniqueFamily !== family) return false;
      if (target !== 'all' && !(result.targets ?? []).includes(target)) return false;
      if (amGroupQw !== 'all' && !amGroupsByRule.get(result.ruleId)?.has(amGroupQw)) return false;
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
        result.guidelineName,
        ...(result.targets ?? []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [report.results, outcome, level, module, principle, guideline, family, target, amGroupQw, amGroupsByRule, text]);

  const tabCount = (o: ResultOutcome): number => report.summary[o];

  const applicableTotal = report.summary.passed + report.summary.warning + report.summary.failed;
  const donutStyle = donutSegments(report.summary);
  const activeTabLabel = TABS.find((t) => t.outcome === outcome)?.label ?? '';

  function focusTab(nextIndex: number): void {
    const wrapped = (nextIndex + TABS.length) % TABS.length;
    setOutcome(TABS[wrapped]!.outcome);
    tabRefs.current[wrapped]?.focus();
  }

  function focusAmTab(nextIndex: number): void {
    const wrapped = (nextIndex + AM_TABS.length) % AM_TABS.length;
    setAmColor(AM_TABS[wrapped]!.color);
    amTabRefs.current[wrapped]?.focus();
  }

  function handleAmTabKeyDown(event: React.KeyboardEvent, index: number): void {
    if (event.key === 'ArrowRight') { event.preventDefault(); focusAmTab(index + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); focusAmTab(index - 1); }
    else if (event.key === 'Home') { event.preventDefault(); focusAmTab(0); }
    else if (event.key === 'End') { event.preventDefault(); focusAmTab(AM_TABS.length - 1); }
  }

  function handleTabKeyDown(event: React.KeyboardEvent, index: number): void {
    if (event.key === 'ArrowRight') { event.preventDefault(); focusTab(index + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); focusTab(index - 1); }
    else if (event.key === 'Home') { event.preventDefault(); focusTab(0); }
    else if (event.key === 'End') { event.preventDefault(); focusTab(TABS.length - 1); }
  }

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

      <section className="panel score-panel" aria-label="Nota geral">
        <ScoreGauge value={report.score.value} max={report.score.scale[1]} />
        <div className="score-meta">
          <p className="strategy-label">{report.score.label}</p>
          {report.score.disclaimer && <p className="disclaimer">{report.score.disclaimer}</p>}
          <div className="quick-stats">
            <span className="quick-stat">
              <strong>{formatBytes(report.page.documentSizeBytes)}</strong> tamanho da página
            </span>
            <span className="quick-stat">
              <strong>{report.page.elementCount ?? '—'}</strong> elementos analisados
            </span>
            {am && (
              <span className="quick-stat">
                <strong>{am.totalTests}</strong> práticas identificadas
              </span>
            )}
            <span className="quick-stat">
              <strong>{applicableTotal}</strong> regras QualWeb aplicáveis
            </span>
            <span className="quick-stat">
              <strong>{(report.duration / 1000).toFixed(1)} s</strong> de execução
            </span>
          </div>
        </div>
      </section>

      <h3>Resumo</h3>
      {am ? (
        <section className="panel summary-grid" aria-label="Resumo AccessMonitor por status e nível WCAG">
          <div className="donut" style={donutSegmentsFromAm(am.byColor)}>
            <div className="donut-center">
              <span className="donut-value">{sumLevels(am.byColor[amColor])}</span>
              <span className="donut-label">
                {amColor === 'R' ? 'itens a corrigir' : amColor === 'Y' ? 'itens a revisar' : 'itens aceitos'}
              </span>
            </div>
          </div>

          <table className="wcag-table">
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">A</th>
                <th scope="col">AA</th>
                <th scope="col">AAA</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {AM_TABS.map((tab) => (
                <tr key={tab.color}>
                  <th scope="row"><span className={`status-dot ${tab.tone}`} aria-hidden="true" />{tab.label}</th>
                  <td className="mono">{am.byColor[tab.color].A}</td>
                  <td className="mono">{am.byColor[tab.color].AA}</td>
                  <td className="mono">{am.byColor[tab.color].AAA}</td>
                  <td className="mono">{sumLevels(am.byColor[tab.color])}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">Total</th>
                <td className="mono">{am.byColor.R.A + am.byColor.Y.A + am.byColor.G.A}</td>
                <td className="mono">{am.byColor.R.AA + am.byColor.Y.AA + am.byColor.G.AA}</td>
                <td className="mono">{am.byColor.R.AAA + am.byColor.Y.AAA + am.byColor.G.AAA}</td>
                <td className="mono">{am.totalTests}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : (
      <section className="panel summary-grid" aria-label="Resumo por status e nível WCAG">
        <div className="donut" style={donutStyle}>
          <div className="donut-center">
            <span className="donut-value">{tabCount(outcome)}</span>
            <span className="donut-label">{activeTabLabel.toLowerCase()}</span>
          </div>
        </div>

        <table className="wcag-table">
          <thead>
            <tr>
              <th scope="col">Status</th>
              <th scope="col">A</th>
              <th scope="col">AA</th>
              <th scope="col">AAA</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row"><span className="status-dot passed" aria-hidden="true" />Aceito</th>
              <td colSpan={3} className="mono">{report.summary.passed} regra(s) passaram</td>
            </tr>
            <tr>
              <th scope="row"><span className="status-dot warning" aria-hidden="true" />Revisar manualmente</th>
              <td colSpan={3} className="mono">{report.summary.warning} regra(s)</td>
            </tr>
            <tr>
              <th scope="row"><span className="status-dot failed" aria-hidden="true" />Erros, por nível WCAG</th>
              <td className="mono">{report.wcagFailures.A}</td>
              <td className="mono">{report.wcagFailures.AA}</td>
              <td className="mono">{report.wcagFailures.AAA}</td>
            </tr>
          </tbody>
        </table>
      </section>
      )}
      {am ? (
        <p className="hint">
          Classificação pelo ruleset do AccessMonitor {am.packageVersion} (AMA, MIT), a metodologia usada pelo
          AMAWeb: cada teste tem nível próprio, inclusive os que no QualWeb vêm como best practice sem critério.
          {report.accessmonitorError ? ` Aviso: ${report.accessmonitorError}` : ''}
        </p>
      ) : (
        <p className="hint">
          Camada AccessMonitor indisponível nesta avaliação{report.accessmonitorError ? `: ${report.accessmonitorError}` : ''}.
          Cada regra com erro é contada uma única vez, no nível mais severo a que ela responde (A &gt; AA &gt; AAA).
          {' '}{report.wcagFailures.unmapped} regra(s) com erro não têm critério de sucesso associado.
        </p>
      )}

      {am && (
        <>
          <h3>Avaliação (AccessMonitor)</h3>
          <div className="tabs" role="tablist" aria-label="Filtrar práticas por status">
            {AM_TABS.map((tab, index) => (
              <button
                key={tab.color}
                ref={(el) => { amTabRefs.current[index] = el; }}
                type="button"
                role="tab"
                data-tone={tab.tone}
                aria-selected={amColor === tab.color}
                aria-controls="am-panel"
                tabIndex={amColor === tab.color ? 0 : -1}
                className="tab"
                onClick={() => setAmColor(tab.color)}
                onKeyDown={(event) => handleAmTabKeyDown(event, index)}
              >
                <span className="tab-dot" aria-hidden="true" />
                {tab.label}
                <span className="tab-count">({sumLevels(am.byColor[tab.color])})</span>
              </button>
            ))}
          </div>

          <div className="subfilters">
            <div>
              <label htmlFor="f-am-group">Categoria</label>
              <select id="f-am-group" value={amGroup} onChange={(e) => setAmGroup(e.target.value)}>
                <option value="all">Todas ({am.practices.length})</option>
                {amGroups.map((g) => (
                  <option key={g.group} value={g.group}>{g.label} ({g.count})</option>
                ))}
              </select>
            </div>
          </div>

          <div id="am-panel" role="tabpanel" aria-label={AM_TABS.find((t) => t.color === amColor)?.label}>
            <p className="muted" aria-live="polite">{amFiltered.length} prática(s) exibida(s).</p>
            <ul className="results">
              {amFiltered.map((practice) => (
                <li key={practice.key}>
                  <PracticeItem practice={practice} />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <h3>Regras do QualWeb (detalhe do motor)</h3>
      <div className="tabs" role="tablist" aria-label="Filtrar por status">
        {TABS.map((tab, index) => (
          <button
            key={tab.outcome}
            ref={(el) => { tabRefs.current[index] = el; }}
            type="button"
            role="tab"
            data-tone={tab.outcome}
            aria-selected={outcome === tab.outcome}
            aria-controls="results-panel"
            tabIndex={outcome === tab.outcome ? 0 : -1}
            className="tab"
            onClick={() => setOutcome(tab.outcome)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            <span className="tab-dot" aria-hidden="true" />
            {tab.label}
            <span className="tab-count">({tabCount(tab.outcome)})</span>
          </button>
        ))}
      </div>

      <div className="subfilters">
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
          <label htmlFor="f-principle">Princípio WCAG</label>
          <select id="f-principle" value={principle} onChange={(e) => setPrinciple(e.target.value)}>
            <option value="all">Todos</option>
            {facetOptions.principles.map((p) => (
              <option key={p} value={p}>{PRINCIPLE_LABEL[p] ?? p}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-guideline">Diretriz WCAG</label>
          <select id="f-guideline" value={guideline} onChange={(e) => setGuideline(e.target.value)}>
            <option value="all">Todas</option>
            {facetOptions.guidelines.map(([code, name]) => (
              <option key={code} value={code}>{code} {name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-family">Família da técnica</label>
          <select id="f-family" value={family} onChange={(e) => setFamily(e.target.value)}>
            <option value="all">Todas</option>
            {facetOptions.families.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-target">Elemento-alvo</label>
          <select id="f-target" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="all">Todos</option>
            {facetOptions.targets.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {am && (
          <div>
            <label htmlFor="f-am-group-qw">Categoria AccessMonitor</label>
            <select id="f-am-group-qw" value={amGroupQw} onChange={(e) => setAmGroupQw(e.target.value)}>
              <option value="all">Todas</option>
              {amGroups.map((g) => (
                <option key={g.group} value={g.label}>{g.label}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="f-text">Texto (regra, critério, seletor, HTML)</label>
          <input id="f-text" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="ex.: 1.1.1, img, QW-ACT-R17" />
        </div>
      </div>

      <div id="results-panel" role="tabpanel" aria-label={activeTabLabel}>
        <p className="muted" aria-live="polite">{filtered.length} regra(s) exibida(s).</p>

        <ul className="results">
          {filtered.map((result) => (
            <li key={`${result.module}-${result.ruleId}`}>
              <ResultItem result={result} pageUrl={report.finalUrl ?? report.resolvedUrl} />
            </li>
          ))}
        </ul>
      </div>

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
          <Row label="Título" value={report.page.title || '(vazio)'} />
          <Row label="Elementos no DOM" value={report.page.elementCount ?? '—'} />
          <Row label="lang do documento" value={report.page.lang ?? '(ausente)'} />
          <Row label="Tamanho da página (resposta do documento)" value={formatBytes(report.page.documentSizeBytes)} />
          <Row label="Tamanho do HTML capturado (com scripts do QualWeb)" value={formatBytes(report.page.htmlSizeBytes)} />
          {am && <Row label="Ruleset AccessMonitor" value={am.packageVersion} />}
          <Row label="Protótipos nativos poluídos pela página" value={describePrototypeRestore(report.diagnostics.prototypeRestore)} />
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

      <footer className="report-footer">
        <div className="credit-group">
          <span className="credit-label">Motor de avaliação</span>
          <span>QualWeb {report.versions.qualwebCore} (ISC) — Faculdade de Ciências da Universidade de Lisboa</span>
        </div>
        <div className="credit-group">
          <span className="credit-label">Referências</span>
          <a href="https://amaweb.unifesp.br" target="_blank" rel="noreferrer">AMAWeb (UNIFESP/IFRS)</a>
          <a href="https://github.com/amagovpt/accessmonitor-docker" target="_blank" rel="noreferrer">AccessMonitor (AMA, MIT)</a>
        </div>
        <div className="credit-group">
          <span className="credit-label">Nota e classificação</span>
          <span>{report.score.label}. Ferramenta independente, não afiliada ao AMAWeb nem à AMA.</span>
        </div>
      </footer>
    </>
  );
}

function ScoreGauge({ value, max }: { value: number; max: number }): JSX.Element {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(value, max));
  const progress = (clamped / max) * circumference;

  return (
    <div>
      <div className="gauge">
        <svg viewBox="0 0 128 128" width="152" height="152" aria-hidden="true">
          <circle cx="64" cy="64" r={radius} className="gauge-track" strokeWidth="13" fill="none" />
          <circle
            cx="64"
            cy="64"
            r={radius}
            className="gauge-fill"
            strokeWidth="13"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            transform="rotate(-90 64 64)"
          />
        </svg>
        <div className="gauge-center" role="img" aria-label={`Nota ${value.toFixed(1)} de ${max}`}>
          <span className="gauge-value">{value.toFixed(1)}</span>
          <span className="gauge-max">/ {max}</span>
        </div>
      </div>
      <p className="gauge-caption">Nota</p>
    </div>
  );
}

function sumLevels(levels: { A: number; AA: number; AAA: number }): number {
  return levels.A + levels.AA + levels.AAA;
}

function donutSegmentsFromAm(byColor: Record<AccessMonitorColor, { A: number; AA: number; AAA: number }>): React.CSSProperties {
  const failed = sumLevels(byColor.R);
  const warning = sumLevels(byColor.Y);
  const passed = sumLevels(byColor.G);
  return donutSegments({ failed, warning, passed, inapplicable: 0, manual: 0 });
}

function PracticeItem({ practice }: { practice: AccessMonitorPractice }): JSX.Element {
  const tone = practice.color === 'R' ? 'failed' : practice.color === 'Y' ? 'warning' : 'passed';
  return (
    <details>
      <summary aria-label={`${practice.groupLabel}: ${practice.description}`}>
        <span className="result-flag" data-tone={tone} aria-hidden="true">{practice.level}</span>
        <span className="result-body">
          <span className="rule-title">{practice.description || practice.title}</span>
          <span className="rule-id">{practice.groupLabel} · {practice.key}</span>
        </span>
        <span className="result-chevron" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </summary>

      <div className="detail">
        <dl>
          <dt>Teste</dt>
          <dd>{practice.title} <span className="mono">({practice.key})</span></dd>

          <dt>Categoria</dt>
          <dd>{practice.groupLabel}</dd>

          <dt>Ocorrências</dt>
          <dd className="mono">{practice.occurrences}</dd>

          <dt>Pontuação</dt>
          <dd className="mono">
            base {practice.score}/10 · confiança {practice.trust}
            {practice.weighted ? ` · atribuído ${practice.weighted}` : ' · não pontua'}
          </dd>

          <dt>Regras QualWeb</dt>
          <dd className="mono">
            {practice.qualwebRules.length > 0
              ? `${practice.qualwebRules.join(', ')} (ligação por ${practice.linkKind === 'mapping' ? 'mapeamento declarado' : 'código de técnica'})`
              : '(sem ligação declarada no ruleset)'}
          </dd>
        </dl>

        {(practice.technique || practice.criteria.length > 0) && (
          <div className="technique-panel">
            {practice.technique && (
              <div>
                <p className="technique-label">{practice.technique.kind === 'act-rule' ? 'Regra ACT relacionada' : 'Técnica WCAG relacionada'}</p>
                <p className="technique-name">
                  <span className="mono">{practice.technique.code}</span>
                  {practice.technique.name !== practice.technique.code && practice.technique.name !== `Regra ACT ${practice.technique.code}` ? ` — ${practice.technique.name}` : ''}
                  {' '}<a className="doc-link" href={practice.technique.url} target="_blank" rel="noreferrer">W3C →</a>
                </p>
                {practice.technique.description && (
                  <p className="muted" style={{ margin: '.35rem 0 0', fontSize: '.8125rem', maxWidth: '65ch' }}>{practice.technique.description}</p>
                )}
              </div>
            )}
            {practice.criteria.map((criterion) => (
              <span className="criterion-chip" key={criterion.criterion}>
                <span className="level-tag">{criterion.level}</span>
                Critério {criterion.criterion} — {criterion.name}
              </span>
            ))}
          </div>
        )}

        {practice.elements.length > 0 && (
          <>
            <h4 style={{ fontSize: '.8rem', margin: '1.1rem 0 .3rem' }}>Elementos (das regras QualWeb ligadas)</h4>
            {practice.elements.map((element, index) => (
              <div key={index} style={{ marginBottom: '.6rem' }}>
                {element.html && <pre className="code">{element.html}</pre>}
                {element.selector && (
                  <p className="mono muted" style={{ margin: '.3rem 0 0', fontSize: '.78rem' }}>seletor: {element.selector}</p>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </details>
  );
}

function donutSegments(summary: EvaluationReport['summary']): React.CSSProperties {
  const total = summary.failed + summary.warning + summary.passed;
  if (total === 0) {
    return { ['--donut-danger-end' as string]: '0%', ['--donut-warn-end' as string]: '0%' };
  }
  const dangerEnd = (summary.failed / total) * 100;
  const warnEnd = dangerEnd + (summary.warning / total) * 100;
  return {
    ['--donut-danger-end' as string]: `${dangerEnd}%`,
    ['--donut-warn-end' as string]: `${warnEnd}%`,
  };
}

function ResultItem({ result, pageUrl }: { result: AccessibilityResult; pageUrl: string }): JSX.Element {
  const levelLetter = result.wcag?.level ?? '—';

  return (
    <details>
      <summary aria-label={`${OUTCOME_LABEL[result.result]}: ${result.title}`}>
        <span className="result-flag" data-tone={result.result} aria-hidden="true">{levelLetter}</span>
        <span className="result-body">
          <span className="rule-title">
            {result.title}
            {result.elementsTotal > 0 && (result.result === 'failed' || result.result === 'warning') && (
              <span className="occurrences"> — {result.elementsTotal} {result.elementsTotal === 1 ? 'ocorrência' : 'ocorrências'}</span>
            )}
          </span>
          <span className="rule-id">{result.ruleId}</span>
        </span>
        <span className="result-chevron" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </summary>

      <div className="detail">
        <dl>
          <dt>Resultado</dt>
          <dd>{OUTCOME_LABEL[result.result]}</dd>

          <dt>Regra</dt>
          <dd>{result.title} <span className="mono">({result.ruleId})</span></dd>

          <dt>Motor</dt>
          <dd className="mono">{result.engine} {result.engineVersion} · módulo {result.module}</dd>

          {(result.principle || result.guideline) && (
            <>
              <dt>Classificação WCAG</dt>
              <dd>
                {result.principle ? (PRINCIPLE_LABEL[result.principle] ?? result.principle) : ''}
                {result.guideline ? ` · diretriz ${result.guideline}${result.guidelineName ? ` (${result.guidelineName})` : ''}` : ''}
              </dd>
            </>
          )}
          {result.techniqueFamily && (<><dt>Família da técnica</dt><dd>{result.techniqueFamily}</dd></>)}
          {result.targets && result.targets.length > 0 && (<><dt>Elementos-alvo</dt><dd className="mono">{result.targets.join(', ')}</dd></>)}
          {result.accessmonitorKeys && result.accessmonitorKeys.length > 0 && (
            <><dt>Testes AccessMonitor</dt><dd className="mono">{result.accessmonitorKeys.join(', ')}</dd></>
          )}

          <dt>Página</dt>
          <dd className="mono">{pageUrl}</dd>

          <dt>Descrição</dt>
          <dd>{result.outcomeDescription || result.description || '—'}</dd>
        </dl>

        {(result.wcagCriteria.length > 0 || result.actRule || result.technique) && (
          <div className="technique-panel">
            <div>
              <p className="technique-label">Técnica / regra relacionada</p>
              <p className="technique-name">
                {result.actRule && <>ACT rule <span className="mono">{result.actRule}</span></>}
                {result.technique && <>Técnica WCAG <span className="mono">{result.technique}</span></>}
                {!result.actRule && !result.technique && result.title}
              </p>
            </div>
            {result.wcagCriteria.map((criterion) => (
              <span className="criterion-chip" key={criterion.criterion}>
                <span className="level-tag">{criterion.level}</span>
                Critério {criterion.criterion}
                {criterion.principle ? ` — ${criterion.principle}` : ''}
              </span>
            ))}
            {result.url && (
              <a className="doc-link" href={result.url} target="_blank" rel="noreferrer">
                Ver documentação →
              </a>
            )}
          </div>
        )}

        {result.elements.length > 0 && (
          <>
            <h4 style={{ fontSize: '.8rem', margin: '1.1rem 0 .3rem' }}>
              Elementos ({result.elementsTotal})
            </h4>
            {result.elements.map((element, index) => (
              <div key={index} style={{ marginBottom: '.6rem' }}>
                {element.html && <pre className="code">{element.html}</pre>}
                {element.selector && (
                  <p className="mono muted" style={{ margin: '.3rem 0 0', fontSize: '.78rem' }}>
                    seletor: {element.selector}
                  </p>
                )}
                {element.accessibleName && (
                  <p className="mono muted" style={{ margin: 0, fontSize: '.78rem' }}>nome acessível: {element.accessibleName}</p>
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

/**
 * Resume o que a restauração de protótipos precisou desfazer. Relatórios antigos
 * não têm o campo (undefined); recurso desligado grava null.
 */
function describePrototypeRestore(restore: EvaluationReport['diagnostics']['prototypeRestore'] | undefined): string {
  if (restore === undefined) return '—';
  if (restore === null) return 'restauração desligada (RESTORE_NATIVE_PROTOTYPES=false)';
  const removed = Object.values(restore.removed).reduce((n, keys) => n + keys.length, 0);
  const restored = Object.values(restore.restored).reduce((n, keys) => n + keys.length, 0);
  if (removed === 0 && restored === 0) return 'não (página limpa)';
  const targets = [...new Set([...Object.keys(restore.removed), ...Object.keys(restore.restored)])].join(', ');
  return `sim: ${removed} adição(ões) removida(s), ${restored} nativa(s) restaurada(s) antes da avaliação (${targets})`;
}

function formatBytes(value: number | null | undefined): string {
  // Relatórios salvos antes deste campo existir não têm htmlSizeBytes — trata como
  // ausente em vez de deixar NaN vazar para a tela.
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KB`;
}
