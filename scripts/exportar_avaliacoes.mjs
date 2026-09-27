#!/usr/bin/env node
// Consolida os JSONs e as falhas das saídas AccessMonitor e AMAWeb em cinco abas.
// Uso: node scripts/exportar_avaliacoes.mjs [--root DIRETORIO] [--output ARQUIVO.xlsx] [--include-raw] [--preview]

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const SOURCE_DIRS = ["webscrap_accessmonitor", "webscrap_amaweb"];
const SHEETS = ["Câmaras", "Prefeituras", "Ouvidorias"];
const ARCHIVE_CHUNK_SIZE = 30000;
const BLOCK_PAGE = /cloudflare|access denied|just a moment|attention required|verifying you are human|security check/i;
const HEADERS = [
  "Site / URL", "Ferramenta", "Categoria", "Tipo de registro",
  "Situação da página", "Nota informada", "Nota na média",
  "Título da página", "Data da avaliação", "Falhas", "Avisos",
  "Sucessos", "Práticas/testes",
  "Comentários de falhas", "Comentários de avisos",
  "Comentários de sucessos", "Exemplo de elemento",
  "Conformidade", "Idioma", "Tags HTML", "Contexto",
  "Lote de coleta", "Elementos por tipo (JSON)",
  "Resultados por prática (JSON)", "Hash da página",
  "Arquivo JSON", "SHA-256", "ID arquivo",
  "Nota AccessMonitor na média", "Nota AMAWeb na média",
];

function argsFrom(argv) {
  let root = DEFAULT_ROOT;
  let output = null;
  let preview = false;
  let includeRaw = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Uso: node scripts/exportar_avaliacoes.mjs [--root DIRETORIO] " +
        "[--output ARQUIVO.xlsx] [--include-raw] [--preview]\n"
      );
      process.exit(0);
    }
    if (arg === "--preview") {
      preview = true;
    } else if (arg === "--include-raw") {
      includeRaw = true;
    } else if (arg === "--root" || arg === "--output") {
      if (!argv[i + 1]) throw new Error("Falta valor para " + arg);
      if (arg === "--root") root = path.resolve(argv[++i]);
      else output = path.resolve(argv[++i]);
    } else {
      throw new Error("Argumento desconhecido: " + arg);
    }
  }
  if (!output) output = path.join(root, "outputs", "avaliacoes_egov.xlsx");
  if (!output.toLowerCase().endsWith(".xlsx")) {
    throw new Error("--output deve terminar em .xlsx");
  }
  for (const dir of SOURCE_DIRS) {
    const source = path.join(root, dir) + path.sep;
    if ((output + path.sep).startsWith(source)) {
      throw new Error("Salve a planilha fora dos diretórios de origem: " + dir);
    }
  }
  return { root, output, preview, includeRaw };
}

async function loadSpreadsheetApi() {
  try {
    return await import("@oai/artifact-tool");
  } catch {
    // O runtime do Codex já fornece a biblioteca; não instala dependências no projeto.
  }
  const candidates = [
    process.env.EGOV_NODE_MODULES,
    path.join(os.homedir(), ".cache", "codex-runtimes",
      "codex-primary-runtime", "dependencies", "node", "node_modules"),
  ].filter(Boolean);
  for (const modulesDir of candidates) {
    try {
      const resolver = createRequire(path.join(modulesDir, "__egov_resolver__.cjs"));
      const entry = resolver.resolve("@oai/artifact-tool");
      return await import(pathToFileURL(entry).href);
    } catch {
      // Tenta o próximo runtime disponível.
    }
  }
  throw new Error(
    "@oai/artifact-tool indisponível. Execute no ambiente Codex " +
    "ou defina EGOV_NODE_MODULES para o diretório node_modules que o contém."
  );
}

async function listJsonFiles(directory) {
  const found = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const location = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(location);
      else if (entry.isFile() && /\.json$/i.test(entry.name)) found.push(location);
    }
  }
  await walk(directory);
  return found;
}

async function discover(root) {
  const files = [];
  for (const name of SOURCE_DIRS) {
    const directory = path.join(root, name);
    const stat = await fs.stat(directory).catch(() => null);
    if (!stat?.isDirectory()) throw new Error("Diretório ausente: " + directory);
    files.push(...await listJsonFiles(directory));
  }
  files.sort();
  return files;
}

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function numeric(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".");
  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function pageStatus(title, httpStatus, evidence = false) {
  const status = numeric(httpStatus);
  if (status === 403) return "Bloqueio HTTP 403";
  if (status !== null && status >= 400) return "Erro HTTP " + status;
  if (BLOCK_PAGE.test(text(title))) return "Bloqueio/Cloudflare";
  return evidence ? "Evidência de download" : "Conteúdo avaliado";
}

function emptyNumber(value) {
  return value === "" || value === undefined ? null : value;
}

function cellText(value, field, file) {
  const result = text(value);
  if (result.length > 32767) {
    throw new Error(field + " excede 32.767 caracteres no JSON " + file);
  }
  return result.startsWith("=") ? "'" + result : result;
}

function parseSourceDate(value) {
  const raw = text(value).trim();
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    return new Date(Date.UTC(+match[1], +match[2] - 1, +match[3],
      +match[4], +match[5], +(match[6] || 0)));
  }
  match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    return new Date(Date.UTC(+match[3], +match[2] - 1, +match[1],
      +match[4], +match[5], +(match[6] || 0)));
  }
  return null;
}

function dateFromPath(relativePath) {
  const match = relativePath.match(/(20\d{2}-\d{2}-\d{2})\/(\d{2})-(\d{2})-(\d{2})/);
  return match ? parseSourceDate(match[1] + " " +
    match[2] + ":" + match[3] + ":" + match[4]) : null;
}

function safeHost(url) {
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ""; }
}

function classify(record) {
  const context = record.context.toLowerCase();
  const url = record.url.toLowerCase();
  const host = safeHost(record.url);
  const title = record.title.toLowerCase();
  const address = host + " " + url;
  if (context.includes("ouvidorias") ||
      /ouvidoria|manifestac|falabr\.cgu\.gov\.br|e-ouv/.test(address)) {
    return "Ouvidoria";
  }
  if (/\.leg\.br$/.test(host) || /c[aâ]mara/.test(host + " " + title)) {
    return "Câmara";
  }
  if (/cons[oó]rcio|tribunal|defensoria|companhia mato|governo de mato grosso/i.test(title) ||
      /consorcio|^cis[a-z]|^cidesa|mtgas|tjmt|defensoria|^portal\.mt\.gov\.br/.test(host)) {
    return "Outro/Revisar";
  }
  if (/prefeitura/.test(title) || /\.mt\.gov\.br$/.test(host)) {
    return "Prefeitura";
  }
  return "Outro/Revisar";
}

function sheetFor(category) {
  if (category === "Câmara") return "Câmaras";
  if (category === "Ouvidoria") return "Ouvidorias";
  return "Prefeituras";
}

function siteSortKey(record) {
  return safeHost(record.url).replace(/^www\./, "") || "~" + record.source;
}

function isManifest(record) {
  return record.kind === "Manifesto" ||
    /^(manifest|manifesto)\.json$/i.test(path.posix.basename(record.source));
}

function canonicalHash(value) {
  const hash = crypto.createHash("sha256");
  function visit(item) {
    if (Array.isArray(item)) {
      hash.update("[");
      item.forEach((child, index) => {
        if (index) hash.update(",");
        visit(child);
      });
      hash.update("]");
    } else if (item !== null && typeof item === "object") {
      hash.update("{");
      Object.keys(item).sort().forEach((key, index) => {
        if (index) hash.update(",");
        hash.update(JSON.stringify(key) + ":");
        visit(item[key]);
      });
      hash.update("}");
    } else {
      hash.update(JSON.stringify(item));
    }
  }
  visit(value);
  return hash.digest("hex");
}

function identifyEvaluation(payload, record) {
  let content;
  if (record.kind === "Relatório API") {
    const metadata = payload.accessmonitor;
    record.method = metadata?.inputMode || (metadata?.download ? "downloaded-html" : "");
    if (!record.method) {
      // As saídas antigas do AMAWeb não registram inputMode no JSON.
      record.method = /(?:^|_)html(?:_|$)/i.test(record.context) ? "HTML" : "URL";
    } else if (/html/i.test(record.method)) {
      record.method = "HTML";
    }
    const data = { ...payload.result.data };
    delete data.date;
    if (data.tot?.info) {
      const info = { ...data.tot.info };
      delete info.date;
      data.tot = { ...data.tot, info };
    }
    content = { ...payload, result: { ...payload.result, data } };
    if (metadata) {
      content.accessmonitor = { ...metadata };
      delete content.accessmonitor.timestamp;
      if (metadata.download) {
        content.accessmonitor.download = { ...metadata.download };
        // Local do artefato varia com a pasta/data da execução.
        delete content.accessmonitor.download.htmlFile;
      }
    }
  } else if (record.kind === "Exportação por critério") {
    record.method = "Exportação por critério";
    content = payload.map(row => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return row;
      const copy = { ...row };
      delete copy.Data;
      return copy;
    });
  } else {
    if (record.kind === "Evidência HTML") record.method = "HTML";
    return;
  }
  record.duplicateSignature = canonicalHash({
    tool: record.tool, kind: record.kind, method: record.method, url: record.url,
    category: record.category, sheet: record.sheet, status: record.pageStatus,
    content,
  });
}

function deduplicateEvaluations(candidates) {
  const representatives = new Map();
  const replacements = new Map();
  const records = [];
  const duplicates = [];
  const newestFirst = [...candidates].sort((left, right) =>
    (right.date?.getTime() || 0) - (left.date?.getTime() || 0) ||
    left.source.localeCompare(right.source, "pt-BR"));
  for (const record of newestFirst) {
    const kept = record.duplicateSignature && representatives.get(record.duplicateSignature);
    if (kept) {
      duplicates.push({ record, kept });
      replacements.set(record.source, kept.source);
    } else {
      records.push(record);
      if (record.duplicateSignature) representatives.set(record.duplicateSignature, record);
    }
  }
  for (const record of records) {
    if (replacements.has(record.pairedSource)) {
      record.originalPairedSource = record.pairedSource;
      record.pairedSource = replacements.get(record.pairedSource);
    }
  }
  return { records, duplicates };
}

function compareRecords(left, right) {
  const reviewOrder = Number(left.category === "Outro/Revisar") -
    Number(right.category === "Outro/Revisar");
  if (reviewOrder) return reviewOrder;
  const site = siteSortKey(left).localeCompare(siteSortKey(right), "pt-BR");
  if (site) return site;
  const tool = left.tool.localeCompare(right.tool, "pt-BR");
  if (tool) return tool;
  const url = left.url.localeCompare(right.url, "pt-BR");
  if (url) return url;
  const pair = (left.pairedSource || left.source).localeCompare(
    right.pairedSource || right.source, "pt-BR");
  if (pair) return pair;
  const type = Number(left.kind !== "Relatório API") -
    Number(right.kind !== "Relatório API");
  if (type) return type;
  return (right.date?.getTime() || 0) - (left.date?.getTime() || 0) ||
    left.source.localeCompare(right.source, "pt-BR");
}

function freshRecord(relativePath, sha256, size, mtimeMs) {
  const parts = relativePath.split("/");
  return {
    id: 0, source: relativePath, sha256, size, mtimeMs,
    tool: parts[0] === "webscrap_accessmonitor" ? "AccessMonitor" : "AMAWeb",
    context: parts[1] || "", batch: parts.slice(1, -1).join("/"),
    kind: "", category: "", pageStatus: "Sem avaliação", sheet: "", row: 0,
    archiveFirstRow: 0, archiveParts: [], pairedSource: "",
    method: "", duplicateSignature: "",
    httpStatus: null, cloudflareMarker: null,
    url: "", title: "", sourceDate: "", date: dateFromPath(relativePath),
    score: null, evidenceScore: null, practices: null,
    passed: null, failed: null, warnings: null,
    lang: "", htmlTags: null, htmlSize: null, conform: "",
    commentsFailed: "", commentsWarning: "", commentsPassed: "",
    examplePointer: "", elems: "", results: "", pageHash: "", observation: "",
  };
}

function groupedComments(groups) {
  return [...groups.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([message, count]) => count + "× " + message).join("\n");
}

function extractApi(payload, record) {
  const data = payload.result.data;
  const total = data.tot && typeof data.tot === "object" ? data.tot : {};
  const info = total.info && typeof total.info === "object" ? total.info : {};
  const results = total.results && typeof total.results === "object" ? total.results : {};
  record.kind = "Relatório API";
  record.url = text(data.rawUrl || info.url || payload.accessmonitor?.requestedUrl);
  record.title = text(data.title || info.title);
  record.httpStatus = numeric(payload.accessmonitor?.download?.httpStatus);
  record.pageStatus = pageStatus(record.title, record.httpStatus);
  record.sourceDate = text(data.date || info.date);
  record.date = parseSourceDate(record.sourceDate) || record.date;
  record.score = numeric(data.score ?? info.score);
  record.practices = Object.keys(results).length;
  record.lang = text(info.lang);
  record.htmlTags = numeric(info.htmlTags);
  record.htmlSize = numeric(info.size);
  if (record.tool === "AMAWeb" && /html/i.test(record.context) &&
      !record.title.trim() && record.htmlTags !== null && record.htmlTags <= 3 &&
      record.htmlSize !== null && record.htmlSize <= 100) {
    record.pageStatus = "HTML vazio/inválido";
  }
  record.conform = text(data.conform || info.conform);
  record.elems = JSON.stringify(data.elems || {});
  record.results = JSON.stringify(results);
  record.pageHash = text(info.hash);
  const buckets = { failed: new Map(), warning: new Map(), passed: new Map() };
  const counts = { failed: 0, warning: 0, passed: 0 };
  const nodes = data.nodes && typeof data.nodes === "object" ? data.nodes : null;
  if (nodes && !Array.isArray(nodes)) {
    for (const [practice, items] of Object.entries(nodes)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const raw = text(item.verdict).toLowerCase();
        const verdict = raw === "failed" ? "failed" :
          raw === "passed" ? "passed" : "warning";
        counts[verdict] += 1;
        const code = text(item.resultCode);
        const description = text(item.description || "Sem descrição");
        const message = practice + (code ? " [" + code + "]" : "") + ": " + description;
        buckets[verdict].set(message, (buckets[verdict].get(message) || 0) + 1);
        if (!record.examplePointer && verdict === "failed" &&
            Array.isArray(item.elements)) {
          const example = item.elements.find(element => element?.pointer);
          if (example) record.examplePointer = text(example.pointer);
        }
      }
    }
  }
  record.passed = nodes ? counts.passed : null;
  record.failed = nodes ? counts.failed : null;
  record.warnings = nodes ? counts.warning : null;
  record.commentsFailed = groupedComments(buckets.failed);
  record.commentsWarning = groupedComments(buckets.warning);
  record.commentsPassed = groupedComments(buckets.passed);
  if (!record.url) record.observation = "Relatório sem URL.";
  if (record.score === null) record.observation +=
    (record.observation ? " " : "") + "Relatório sem nota numérica.";
  if (record.pageStatus !== "Conteúdo avaliado") {
    record.observation += (record.observation ? " " : "") +
      (record.pageStatus === "HTML vazio/inválido"
        ? "HTML sem conteúdo representativo do portal; nota fora da média."
        : "Nota referente à página de bloqueio ou erro; fora da média.");
  }
}

function extractCriterion(rows, record) {
  record.kind = "Exportação por critério";
  const first = rows.find(row => row && typeof row === "object") || {};
  record.url = text(first.URI);
  record.pageStatus = "Conteúdo avaliado";
  record.sourceDate = text(first.Data);
  record.date = parseSourceDate(record.sourceDate) || record.date;
  record.score = numeric(first["Pontuação"]);
  record.practices = rows.length;
  record.passed = 0;
  record.failed = 0;
  record.warnings = 0;
  const scores = new Set();
  const urls = new Set();
  const buckets = { failed: new Map(), warning: new Map(), passed: new Map() };
  let placeholders = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const criterion = text(row.Criterio);
    const level = text(row["Nivel de Conformidade"]);
    const description = text(row.Descricao);
    const technical = text(row.Elementos?.descricao);
    const occurrences = numeric(row["Numero de ocorrencias"]);
    const status = text(row["Tipo de erro"]);
    const bucket = status === "Erro" ? "failed" :
      status === "Sucesso" ? "passed" : "warning";
    if (bucket === "failed") record.failed += 1;
    else if (bucket === "passed") record.passed += 1;
    else record.warnings += 1;
    if (row["Pontuação"] !== undefined) scores.add(text(row["Pontuação"]));
    if (row.URI) urls.add(text(row.URI));
    if (description.includes("{{") || description.includes("TESTS_RESULTS.")) {
      placeholders += 1;
    }
    const message = criterion + (level ? " [" + level + "]" : "") +
      ": " + description + " (ocorrências: " +
      (occurrences === null ? "não informadas" : occurrences) + ")" +
      (technical && technical !== description ? " | Detalhe técnico: " + technical : "");
    buckets[bucket].set(message, (buckets[bucket].get(message) || 0) + 1);
    if (!record.examplePointer && bucket === "failed") {
      const elements = row.Elementos?.elementosHtml;
      if (Array.isArray(elements)) {
        const example = elements.find(element => element?.pointer);
        if (example) record.examplePointer = text(example.pointer);
      }
    }
  }
  record.commentsFailed = groupedComments(buckets.failed);
  record.commentsWarning = groupedComments(buckets.warning);
  record.commentsPassed = groupedComments(buckets.passed);
  const observations = [];
  if (urls.size > 1) observations.push("URLs diferentes dentro do mesmo JSON: " + urls.size);
  if (scores.size > 1) observations.push("Notas diferentes dentro do mesmo JSON: " + scores.size);
  if (placeholders) observations.push("Descrições com marcador não resolvido: " + placeholders);
  if (record.score === null) observations.push("Exportação sem nota numérica.");
  record.observation = observations.join(". ");
}

function extractOther(payload, record) {
  if (payload && typeof payload === "object" && !Array.isArray(payload) &&
      "contexto" in payload && "urls_unicas" in payload) {
    record.kind = "Manifesto";
    record.observation = "Registros: " + text(payload.entrada_registros) +
      "; URLs únicas: " + text(payload.urls_unicas) +
      "; falhas: " + text(payload.avaliacoes_com_falha_ou_pdf_falho);
    return;
  }
  if (payload && typeof payload === "object" && !Array.isArray(payload) &&
      ("download_http_status" in payload || "html_bytes" in payload)) {
    record.kind = "Evidência HTML";
    record.url = text(payload.url);
    record.title = text(payload.html_title);
    record.evidenceScore = numeric(payload.nota);
    record.httpStatus = numeric(payload.download_http_status);
    record.cloudflareMarker = payload.cloudflare_marker === true;
    record.pageStatus = pageStatus(record.title, record.httpStatus, true);
    record.htmlSize = numeric(payload.html_bytes);
    const observations = [];
    if (payload.download_http_status !== undefined) {
      observations.push("HTTP: " + payload.download_http_status);
    }
    if (payload.cloudflare_marker !== undefined) {
      observations.push("Cloudflare: " + payload.cloudflare_marker);
    }
    if (payload.pdf_error) observations.push("PDF: " + payload.pdf_error);
    record.observation = observations.join("; ");
    return;
  }
  record.kind = "Outro formato";
  record.url = text(payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload.url : "");
  record.observation = "Formato não reconhecido; verificar JSON original.";
}

async function readRecord(root, location, id, includeRaw) {
  const relativePath = path.relative(root, location).split(path.sep).join("/");
  const bytes = await fs.readFile(location);
  const stat = await fs.stat(location);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const record = freshRecord(relativePath, sha256, bytes.length, stat.mtimeMs);
  record.id = id;
  if (includeRaw) {
    const encoded = gzipSync(bytes, { level: 6, mtime: 0 }).toString("base64");
    for (let start = 0; start < encoded.length; start += ARCHIVE_CHUNK_SIZE) {
      record.archiveParts.push(encoded.slice(start, start + ARCHIVE_CHUNK_SIZE));
    }
  }
  let payload;
  try {
    payload = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
    if (payload && typeof payload === "object" && !Array.isArray(payload) &&
        payload.result && typeof payload.result === "object" &&
        payload.result.data && typeof payload.result.data === "object" &&
        !Array.isArray(payload.result.data)) {
      extractApi(payload, record);
    } else if (Array.isArray(payload) && payload.length &&
        payload[0] && typeof payload[0] === "object" &&
        "Tipo de erro" in payload[0]) {
      extractCriterion(payload, record);
    } else {
      extractOther(payload, record);
      if (record.kind === "Evidência HTML" && typeof payload.json === "string") {
        const pairedFile = path.join(path.dirname(location), path.basename(payload.json));
        record.pairedSource = path.relative(root, pairedFile)
          .split(path.sep).join("/");
      }
    }
  } catch (error) {
    record.kind = "JSON inválido";
    record.observation = "Falha ao ler JSON: " + error.message;
  }
  record.category = classify(record);
  record.sheet = sheetFor(record.category);
  if (record.kind !== "JSON inválido") identifyEvaluation(payload, record);
  if (record.category === "Outro/Revisar") {
    record.observation += (record.observation ? " " : "") +
      "Portal fora das três categorias; revisar classificação.";
  }
  return record;
}

function scoreForMean(record) {
  const isReport = record.kind === "Relatório API" ||
    record.kind === "Exportação por critério";
  const inCategory = record.sheet === "Prefeituras"
    ? record.category === "Prefeitura"
    : record.sheet === "Câmaras"
      ? record.category === "Câmara"
      : record.category === "Ouvidoria";
  return isReport && inCategory && record.pageStatus === "Conteúdo avaliado"
    ? record.score : null;
}

function rowFor(record) {
  const meanScore = scoreForMean(record);
  const values = [
    record.url, record.tool, record.category, record.kind,
    record.pageStatus,
    record.kind === "Evidência HTML" ? record.evidenceScore : record.score,
    meanScore,
    record.title, record.date, record.failed, record.warnings,
    record.passed, record.practices,
    record.commentsFailed, record.commentsWarning,
    record.commentsPassed, record.examplePointer,
    record.conform, record.lang, record.htmlTags, record.context,
    record.batch, record.elems, record.results, record.pageHash,
    record.source, record.sha256, record.id,
    record.tool === "AccessMonitor" ? meanScore : null,
    record.tool === "AMAWeb" ? meanScore : null,
  ];
  return values.map((value, index) =>
    typeof value === "string" ? cellText(value, HEADERS[index], record.source) : value);
}

function columnLabel(index) {
  let value = index + 1;
  let result = "";
  while (value) {
    value -= 1;
    result = String.fromCharCode(65 + value % 26) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function parseCsv(content, separator = ",") {
  const rows = [];
  let row = [], field = "", quoted = false;
  const input = content.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const character = input[i];
    if (character === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
    } else if (character === separator && !quoted) {
      row.push(field); field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
    } else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header = [], ...body] = rows;
  return body.map(values => Object.fromEntries(header.map((name, i) =>
    [name.trim(), values[i] || ""])));
}

function urlKey(value) {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase().replace(/^www\./, "") +
      url.pathname.replace(/\/$/, "").toLowerCase() +
      url.search.toLowerCase() + url.hash.toLowerCase();
  } catch { return ""; }
}

function slug(value) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function municipalityResolver(root) {
  const filename = path.join(root, "webscrap_accessmonitor", "dados_entradas",
    "validacao_ouvidorias_mt_browser_2026-09-21.csv");
  const rows = parseCsv(await fs.readFile(filename, "utf8"));
  const names = [...new Set(rows.map(row => row.municipio).filter(Boolean))];
  const exact = new Map();
  for (const row of rows) {
    for (const field of ["portal_oficial", "url_informada", "url_final_ou_tentada"]) {
      const key = urlKey(row[field]);
      if (!key) continue;
      if (!exact.has(key)) exact.set(key, new Set());
      exact.get(key).add(row.municipio);
    }
  }
  // Três domínios oficiais usam nomes abreviados que não seguem o nome do município.
  const aliases = new Map([
    ["camaranovacanaa", "Nova Canaã do Norte"],
    ["camaravilabela", "Vila Bela da Santíssima Trindade"],
    ["vera.mt.leg.br", "Vera"],
  ]);
  return value => {
    const key = urlKey(value);
    const matches = exact.get(key);
    if (matches?.size === 1) return [...matches][0];
    if (matches?.size > 1) return "";
    for (const [alias, name] of aliases) if (key.includes(alias)) return name;
    const hostAndPath = key.split(/[?#]/)[0];
    const candidates = names.filter(name => hostAndPath.includes(slug(name)))
      .sort((a, b) => slug(b).length - slug(a).length);
    return candidates.length && (candidates.length === 1 ||
      slug(candidates[0]).length > slug(candidates[1]).length) ? candidates[0] : "";
  };
}

function analysisFor(records, cityFor) {
  const grouped = new Map(), unknown = [];
  for (const record of records) {
    const score = scoreForMean(record);
    if (score === null) continue;
    const city = cityFor(record.url);
    if (!city) {
      unknown.push(record);
      continue;
    }
    const key = [record.sheet, record.tool, city].join("\u0000");
    if (!grouped.has(key)) grouped.set(key, {
      category: record.sheet, tool: record.tool, city,
      scores: [], urls: new Set(), latest: null,
    });
    const group = grouped.get(key);
    group.scores.push(score);
    group.urls.add(record.url);
    if (record.date && (!group.latest || record.date > group.latest))
      group.latest = record.date;
  }
  const groups = [...grouped.values()].map(group => ({
    ...group,
    mean: group.scores.reduce((sum, value) => sum + value, 0) / group.scores.length,
  }));
  const sections = [];
  for (const category of SHEETS) for (const tool of ["AccessMonitor", "AMAWeb"]) {
    const own = groups.filter(group => group.category === category && group.tool === tool);
    const top = [...own].sort((a, b) => b.mean - a.mean ||
      a.city.localeCompare(b.city, "pt-BR")).slice(0, 10);
    const bottom = [...own].sort((a, b) => a.mean - b.mean ||
      a.city.localeCompare(b.city, "pt-BR")).slice(0, 10);
    sections.push({ category, tool, total: own.length, top, bottom });
  }
  const byCity = new Map();
  for (const group of groups) {
    const key = group.category + "\u0000" + group.city;
    if (!byCity.has(key)) byCity.set(key, {
      category: group.category, city: group.city,
    });
    byCity.get(key)[group.tool] = group;
  }
  const comparison = [...byCity.values()].filter(row =>
    row.AccessMonitor && row.AMAWeb).sort((a, b) =>
    SHEETS.indexOf(a.category) - SHEETS.indexOf(b.category) ||
    a.city.localeCompare(b.city, "pt-BR"));
  return { sections, comparison, unknown, groups };
}

function errorType(message, fallback = "Outra falha") {
  const value = text(message).toLowerCase();
  if (/cloudflare|just a moment|attention required/.test(value)) return "Cloudflare";
  if (/ssl|tls|certificat|certificate/.test(value)) return "SSL/certificado";
  if (/dns|name or service not known|name resolution|enotfound/.test(value)) return "DNS";
  if (/timeout|timed out|tempo esgotado|avaliação excedeu/.test(value)) return "Timeout";
  if (/connection reset|conexão redefinida/.test(value)) return "Conexão interrompida";
  if (/http 403|statuscode.{0,5}403|forbidden/.test(value)) return "HTTP 403";
  if (/http 504|statuscode.{0,5}504|gateway timeout/.test(value)) return "HTTP 504";
  if (/http 500|statuscode.{0,5}500|qualweb|mapping\.ts/.test(value)) return "API 500/QualWeb";
  if (/http 400|statuscode.{0,5}400/.test(value)) return "API 400";
  return fallback;
}

function briefError(value) {
  const raw = text(value).trim();
  const http = raw.match(/\bHTTP\s+(\d{3})/i);
  const message = raw.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (message) {
    const cause = raw.includes("QualWeb returned an empty report")
      ? "; QualWeb retornou relatório vazio" :
      raw.includes("Cannot read properties of undefined")
        ? "; falha ao interpretar resultado do QualWeb" : "";
    return ((http ? "HTTP " + http[1] + ": " : "") + message[1] + cause)
      .slice(0, 450);
  }
  return raw.split(/\\n|\n/)[0].slice(0, 450);
}

function summaryCard(sheet, labelRange, valueRange, label, value, fill) {
  sheet.getRange(labelRange).merge();
  sheet.getRange(valueRange).merge();
  const labelCell = labelRange.split(":")[0];
  const valueCell = valueRange.split(":")[0];
  sheet.getRange(labelCell).values = [[label]];
  sheet.getRange(valueCell).values = [[value]];
  sheet.getRange(labelRange).format = {
    fill, font: { name: "Arial", size: 10, bold: true, color: "#475569" },
    rowHeight: 22, horizontalAlignment: "left",
  };
  sheet.getRange(valueRange).format = {
    fill, font: { name: "Arial", size: 14, bold: true, color: "#183153" },
    rowHeight: 28, horizontalAlignment: "left",
  };
}

async function errorAnalysis(root, records, cityFor) {
  const events = [], sources = new Map();
  const add = (tool, url, type, detail, source, category = "") => {
    const key = urlKey(url);
    if (!key) return;
    events.push({ tool, url: url.trim(), key, type, detail: briefError(detail),
      source, category });
    sources.set(source, (sources.get(source) || 0) + 1);
  };
  for (const record of records) {
    if (record.pageStatus === "Conteúdo avaliado" ||
        record.pageStatus === "Evidência de download") continue;
    const type = record.pageStatus === "Bloqueio/Cloudflare" ? "Cloudflare" :
      record.pageStatus === "Bloqueio HTTP 403" ? "HTTP 403" :
      record.pageStatus === "HTML vazio/inválido" ? "HTML vazio/inválido" :
      errorType(record.pageStatus);
    if (record.url) add(record.tool, record.url, type,
      record.pageStatus === "HTML vazio/inválido"
        ? "HTML sem conteúdo representativo do portal; nota fora da média."
        : record.title,
      record.source, record.sheet);
  }
  const accessBase = path.join(root, "webscrap_accessmonitor");
  const amaBase = path.join(root, "webscrap_amaweb");
  for (const [name, fallback] of [
    ["falhas_dns.txt", "DNS"], ["falhas_ssl.txt", "SSL/certificado"],
    ["falhas_api_500.txt", "API 500/QualWeb"],
    ["falhas_timeout.txt", "Timeout"],
    ["falhas_restantes_urls.txt", "Sem resultado final"],
    ["cloudflare_bloqueados.txt", "Cloudflare"],
  ]) {
    const file = path.join(accessBase, "dados_falhas", name);
    const content = await fs.readFile(file, "utf8");
    const source = path.relative(root, file).split(path.sep).join("/");
    const blocks = content.split(/\n(?=\s*\d+\.\s*(?:URL:\s*)?https?:\/\/)/);
    for (const block of blocks) {
      const match = block.match(/(?:^|\n)\s*\d+\.\s*(?:URL:\s*)?(https?:\/\/[^\s]+)/);
      if (match) {
        const detail = block.match(/(?:Erro|Explicação):\s*([^\n]+)/)?.[1] || "";
        add("AccessMonitor", match[1], fallback, detail, source);
      }
    }
    if (fallback === "Sem resultado final") {
      for (const line of content.split(/\r?\n/)) {
        const url = line.trim();
        if (/^https?:\/\//.test(url))
          add("AccessMonitor", url, fallback, "Sem resultado na lista final", source);
      }
    }
  }
  async function walkFiles(directory, pattern) {
    const files = [];
    async function walk(current) {
      for (const entry of await fs.readdir(current, { withFileTypes: true })) {
        const location = path.join(current, entry.name);
        if (entry.isDirectory()) await walk(location);
        else if (entry.isFile() && pattern.test(entry.name)) files.push(location);
      }
    }
    await walk(directory);
    return files.sort();
  }
  for (const file of await walkFiles(accessBase, /^resultados(?:_html)?\.csv$/)) {
    const source = path.relative(root, file).split(path.sep).join("/");
    for (const row of parseCsv(await fs.readFile(file, "utf8"))) {
      if (!row.erro?.trim()) continue;
      const url = row.url_avaliada || row.url_informada || row.url;
      const detail = row.erro.split(/\\n|\n/)[0];
      add("AccessMonitor", url, errorType(detail), detail, source,
        row.contexto?.includes("ouvidorias") ? "Ouvidorias" : "");
    }
  }
  const amaSummary = path.join(amaBase, "dados_entradas", "resumo_amaweb_final.csv");
  for (const row of parseCsv(await fs.readFile(amaSummary, "utf8"), ";")) {
    if (row.status !== "Sem resultado AMAWeb") continue;
    add("AMAWeb", row.url, "Sem resultado AMAWeb",
      "Sem resultado após " + row.tentativas + " tentativa(s)",
      path.relative(root, amaSummary).split(path.sep).join("/"));
  }
  for (const file of await walkFiles(amaBase, /^falhas.*\.txt$/)) {
    const source = path.relative(root, file).split(path.sep).join("/");
    const type = file.includes("cloudflare") ? "Falha de avaliação HTML" :
      "Sem resultado AMAWeb";
    for (const line of (await fs.readFile(file, "utf8")).split(/\r?\n/)) {
      const url = line.trim();
      if (/^https?:\/\//.test(url)) add("AMAWeb", url, type, "", source);
    }
  }
  const valid = new Set(records.filter(record => scoreForMean(record) !== null)
    .map(record => record.tool + "\u0000" + urlKey(record.url)));
  const grouped = new Map();
  for (const event of events) {
    const key = [event.tool, event.key, event.type].join("\u0000");
    if (!grouped.has(key)) grouped.set(key, { ...event,
      sources: new Set(), details: new Set() });
    const group = grouped.get(key);
    group.sources.add(event.source);
    if (event.detail) group.details.add(event.detail);
    if (!group.category && event.category) group.category = event.category;
  }
  const rows = [...grouped.values()].map(group => ({
    ...group,
    city: cityFor(group.url),
    recovered: valid.has(group.tool + "\u0000" + group.key),
  })).sort((a, b) => a.tool.localeCompare(b.tool) ||
    a.type.localeCompare(b.type, "pt-BR") || a.url.localeCompare(b.url));
  return { rows, events: events.length, sources: Object.fromEntries(sources) };
}

function addAnalysisSheet(workbook, analysis) {
  const sheet = workbook.worksheets.add("Análise");
  sheet.tabColor = "#217A69";
  sheet.showGridLines = false;
  sheet.getRange("A2").values = [["Análise por município — melhores e piores notas"]];
  sheet.getRange("A2").format.font = {
    name: "Arial", size: 16, bold: true, color: "#183153",
  };
  summaryCard(sheet, "A4:C4", "A5:C5", "Municípios com nota",
    new Set(analysis.groups.map(group => group.city)).size, "#E8F0F7");
  summaryCard(sheet, "D4:F4", "D5:F5", "Avaliações classificadas",
    analysis.groups.reduce((sum, group) => sum + group.scores.length, 0), "#E8F0F7");
  summaryCard(sheet, "H4:J4", "H5:J5", "Sem município seguro",
    analysis.unknown.length, "#E8F0F7");
  summaryCard(sheet, "K4:M4", "K5:M5", "Comparações entre ferramentas",
    analysis.comparison.length, "#E8F0F7");
  const heading = ["Pos.", "Município", "Nota média", "Avaliações", "Última avaliação", "URL(s)"];
  for (let i = 0; i < 6; i += 1) {
    const width = [14, 31, 18, 18, 21, 50][i];
    sheet.getRange(columnLabel(i) + "1").format.columnWidth = width;
    sheet.getRange(columnLabel(i + 7) + "1").format.columnWidth = width;
  }
  sheet.getRange("G1").format.columnWidth = 20;
  let row = 9;
  const rowsFor = groups => Array.from({ length: 10 }, (_, index) => {
    const group = groups[index];
    return group ? [index + 1, group.city, group.mean, group.scores.length,
      group.latest, [...group.urls].join("\n")] : [null, "", null, null, null, ""];
  });
  for (const section of analysis.sections) {
    sheet.getRange("A" + row).values = [[section.category + " · " + section.tool +
      " · " + section.total + " municípios"]];
    sheet.getRange("A" + row + ":M" + row).format = {
      fill: "#183153", font: { name: "Arial", size: 11, bold: true, color: "#FFFFFF" },
      rowHeight: 26,
    };
    sheet.getRange("A" + (row + 1)).values = [["10 melhores"]];
    sheet.getRange("H" + (row + 1)).values = [["10 piores"]];
    sheet.getRange("A" + (row + 2) + ":F" + (row + 2)).values = [heading];
    sheet.getRange("H" + (row + 2) + ":M" + (row + 2)).values = [heading];
    for (const address of ["A" + (row + 2) + ":F" + (row + 2),
      "H" + (row + 2) + ":M" + (row + 2)]) {
      sheet.getRange(address).format = {
        fill: "#DCEBE6", font: { name: "Arial", size: 10, bold: true,
          color: "#183153" }, rowHeight: 25,
      };
    }
    sheet.getRange("A" + (row + 3) + ":F" + (row + 12)).values = rowsFor(section.top);
    sheet.getRange("H" + (row + 3) + ":M" + (row + 12)).values = rowsFor(section.bottom);
    sheet.getRange("C" + (row + 3) + ":C" + (row + 12)).setNumberFormat("0.00");
    sheet.getRange("J" + (row + 3) + ":J" + (row + 12)).setNumberFormat("0.00");
    sheet.getRange("E" + (row + 3) + ":E" + (row + 12)).setNumberFormat("yyyy-mm-dd");
    sheet.getRange("L" + (row + 3) + ":L" + (row + 12)).setNumberFormat("yyyy-mm-dd");
    row += 16;
  }
  row += 1;
  sheet.getRange("A" + row).values = [["Comparativo por município — duas ferramentas"]];
  sheet.getRange("A" + row).format.font = {
    name: "Arial", size: 13, bold: true, color: "#183153",
  };
  const compareHeader = ["Categoria", "Município", "AccessMonitor", "AMAWeb",
    "AMAWeb − AccessMonitor", "Avaliações AccessMonitor", "Avaliações AMAWeb"];
  const headerRow = row + 2;
  sheet.getRange("A" + headerRow + ":G" + headerRow).values = [compareHeader];
  sheet.getRange("A" + headerRow + ":G" + headerRow).format = {
    fill: "#183153", font: { name: "Arial", size: 10, bold: true,
      color: "#FFFFFF" }, rowHeight: 34, wrapText: true,
  };
  if (analysis.comparison.length) {
    const matrix = analysis.comparison.map(item => [
      item.category, item.city, item.AccessMonitor.mean, item.AMAWeb.mean,
      item.AMAWeb.mean - item.AccessMonitor.mean,
      item.AccessMonitor.scores.length, item.AMAWeb.scores.length,
    ]);
    sheet.getRangeByIndexes(headerRow, 0, matrix.length, 7).values = matrix;
    sheet.getRange("C" + (headerRow + 1) + ":E" +
      (headerRow + matrix.length)).setNumberFormat("0.00");
    sheet.tables.add("A" + headerRow + ":G" + (headerRow + matrix.length),
      true, "TabelaComparativoMunicipios").showFilterButton = true;
  }
  const unknownStart = headerRow + analysis.comparison.length + 3;
  sheet.getRange("A" + unknownStart).values = [["Avaliações sem município identificado com segurança"]];
  sheet.getRange("A" + unknownStart).format.font = {
    name: "Arial", size: 12, bold: true, color: "#183153",
  };
  sheet.getRange("A" + (unknownStart + 1)).values = [["Categoria"]];
  sheet.getRange("B" + (unknownStart + 1)).values = [["Ferramenta"]];
  sheet.getRange("C" + (unknownStart + 1) + ":E" + (unknownStart + 1)).merge();
  sheet.getRange("F" + (unknownStart + 1) + ":M" + (unknownStart + 1)).merge();
  sheet.getRange("C" + (unknownStart + 1)).values = [["URL"]];
  sheet.getRange("F" + (unknownStart + 1)).values = [["Arquivo JSON"]];
  sheet.getRange("A" + (unknownStart + 1) + ":M" + (unknownStart + 1)).format = {
    fill: "#DCEBE6", font: { name: "Arial", size: 10, bold: true,
      color: "#183153" }, rowHeight: 25,
  };
  if (analysis.unknown.length) {
    analysis.unknown.forEach((record, index) => {
      const at = unknownStart + 2 + index;
      sheet.getRange("C" + at + ":E" + at).merge();
      sheet.getRange("F" + at + ":M" + at).merge();
      sheet.getRange("A" + at).values = [[record.sheet]];
      sheet.getRange("B" + at).values = [[record.tool]];
      sheet.getRange("C" + at).values = [[record.url]];
      sheet.getRange("F" + at).values = [[record.source]];
    });
  }
  sheet.freezePanes.freezeRows(8);
  return { sections: analysis.sections.map(section => ({
    categoria: section.category, ferramenta: section.tool, municipios: section.total,
    melhores: section.top.length, piores: section.bottom.length,
  })), comparacoes: analysis.comparison.length,
  semMunicipio: analysis.unknown.map(record => ({
    arquivo: record.source, url: record.url, categoria: record.sheet,
    ferramenta: record.tool,
  })) };
}

function addErrorSheet(workbook, errors) {
  const sheet = workbook.worksheets.add("Erros");
  sheet.tabColor = "#B76538";
  sheet.showGridLines = false;
  sheet.getRange("A2").values = [["Falhas de coleta e bloqueios por URL"]];
  sheet.getRange("A2").format.font = {
    name: "Arial", size: 16, bold: true, color: "#183153",
  };
  const uniqueUrls = new Set(errors.rows.map(row => row.tool + "\u0000" + row.key));
  summaryCard(sheet, "A4:B4", "A5:B5", "URLs por ferramenta",
    uniqueUrls.size, "#FFF1D6");
  summaryCard(sheet, "C4:D4", "C5:D5", "Tipos de falha",
    new Set(errors.rows.map(row => row.type)).size, "#FFF1D6");
  summaryCard(sheet, "E4:F4", "E5:F5", "Ocorrências em fontes",
    errors.events, "#FFF1D6");
  summaryCard(sheet, "G4:I4", "G5:I5", "Linhas com avaliação válida",
    errors.rows.filter(row => row.recovered).length, "#FFF1D6");
  const headers = ["Ferramenta", "Tipo de falha", "URL", "Categoria",
    "Município", "Avaliação válida", "Detalhe", "Fontes", "Nº fontes"];
  sheet.getRange("A8:I8").values = [headers];
  sheet.getRange("A8:I8").format = {
    fill: "#183153", font: { name: "Arial", size: 10, bold: true,
      color: "#FFFFFF" }, rowHeight: 30,
  };
  [16, 21, 55, 16, 27, 17, 55, 65, 10].forEach((width, index) => {
    sheet.getRange(columnLabel(index) + "1").format.columnWidth = width;
  });
  const rows = errors.rows.map(item => [
    item.tool, item.type, item.url,
    item.category || (/(?:\.leg\.br|camara)/i.test(item.key) ? "Câmaras" :
      /ouvidoria|falabr|e-ouv/i.test(item.key) ? "Ouvidorias" : "Prefeituras"),
    item.city, item.recovered ? "Sim" : "Não",
    [...item.details].join(" | ").slice(0, 1500),
    [...item.sources].join("\n"), item.sources.size,
  ]);
  for (let offset = 0; offset < rows.length; offset += 100) {
    const chunk = rows.slice(offset, offset + 100);
    sheet.getRangeByIndexes(8 + offset, 0, chunk.length, 9).values = chunk;
  }
  if (rows.length) {
    sheet.tables.add("A8:I" + (8 + rows.length), true,
      "TabelaFalhasPorUrl").showFilterButton = true;
    sheet.getRange("A9:I" + (8 + rows.length)).format.rowHeight = 34;
    sheet.getRange("C9:C" + (8 + rows.length)).format.wrapText = true;
    sheet.getRange("E9:E" + (8 + rows.length)).format.wrapText = true;
    sheet.getRange("G9:H" + (8 + rows.length)).format.wrapText = true;
  }
  sheet.freezePanes.freezeRows(8);
  return { linhas: rows.length, urlsPorFerramenta: uniqueUrls.size,
    ocorrencias: errors.events,
    porTipo: Object.fromEntries([...new Set(errors.rows.map(row => row.type))]
      .map(type => [type, errors.rows.filter(row => row.type === type).length])),
    fontes: errors.sources };
}

async function buildWorkbook(records, output, preview, includeRaw, api, analysis, errors) {
  const { Workbook, SpreadsheetFile, FileBlob } = api;
  const workbook = Workbook.create();
  const rowCounts = {};
  const colors = { "Câmaras": "#24425F", "Prefeituras": "#355E7A",
    "Ouvidorias": "#51718C" };
  const tables = { "Câmaras": "TabelaCamaras", "Prefeituras": "TabelaPrefeituras",
    "Ouvidorias": "TabelaOuvidorias" };
  const expectedCategory = { "Câmaras": "Câmara", "Prefeituras": "Prefeitura",
    "Ouvidorias": "Ouvidoria" };
  const widths = [
    52, 17, 24, 23, 26, 14, 14, 47, 20, 12, 12, 12, 16,
    72, 72, 72, 52, 18, 14, 13, 24, 35, 62, 62, 36,
    78, 67, 10, 24, 20,
  ];
  for (const sheetName of SHEETS) {
    const sheet = workbook.worksheets.add(sheetName);
    sheet.tabColor = colors[sheetName];
    sheet.showGridLines = false;
    const own = records.filter(record => record.sheet === sheetName);
    const last = 8 + own.length;
    rowCounts[sheetName] = own.length;
    sheet.getRange("A2").values = [[sheetName + " — avaliações de acessibilidade"]];
    sheet.getRange("A2").format.font = {
      name: "Arial", size: 15, bold: true, color: "#183153",
    };
    sheet.getRange("A8:AD8").values = [HEADERS];
    const header = sheet.getRange("A8:AD8");
    header.format = {
      fill: "#183153",
      font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
      verticalAlignment: "center",
      rowHeight: 30,
    };
    const matrix = own.map(record => rowFor(record));
    for (let offset = 0; offset < matrix.length; offset += 100) {
      const chunk = matrix.slice(offset, offset + 100);
      sheet.getRangeByIndexes(8 + offset, 0, chunk.length, HEADERS.length).values = chunk;
    }
    for (let i = 0; i < widths.length; i += 1) {
      sheet.getRange(columnLabel(i) + "1").format.columnWidth = widths[i];
    }
    if (own.length) {
      const body = sheet.getRange("A9:AD" + last);
      body.format.font = { name: "Arial", size: 10, color: "#1F2937" };
      body.format.rowHeight = 21;
      sheet.getRange("I9:I" + last).setNumberFormat("yyyy-mm-dd hh:mm");
      sheet.getRange("F9:G" + last).setNumberFormat("0.0");
      sheet.getRange("J9:M" + last).setNumberFormat("#,##0");
      sheet.getRange("T9:T" + last).setNumberFormat("#,##0");
      sheet.getRange("AB9:AB" + last).setNumberFormat("#,##0");
      sheet.getRange("AC9:AD" + last).setNumberFormat("0.0");
      const table = sheet.tables.add("A8:AD" + last, true, tables[sheetName]);
      table.showFilterButton = true;
      own.forEach((record, index) => {
        const row = index + 9;
        if (record.pageStatus.startsWith("Bloqueio") ||
            record.pageStatus.startsWith("Erro HTTP") ||
            record.pageStatus === "HTML vazio/inválido") {
          sheet.getRange("E" + row + ":F" + row).format.fill = "#FFF1D6";
        } else if ((record.kind === "Evidência HTML" ?
            record.evidenceScore : record.score) === 0) {
          sheet.getRange("F" + row).format.fill = "#FDE8E7";
        }
      });
    }
    sheet.getRange("A4:F4").values = [[
      "Avaliações", "Arquivos AMAWeb", "Arquivos AccessMonitor",
      "Média da nota AccessMonitor", "Média da nota AMAWeb", "Média entre médias",
    ]];
    sheet.getRange("A5:C5").values = [[
      own.filter(record => record.kind === "Relatório API" ||
        record.kind === "Exportação por critério").length,
      own.filter(record => record.tool === "AMAWeb").length,
      own.filter(record => record.tool === "AccessMonitor").length,
    ]];
    sheet.getRange("D5").formulas = [[
      "=IFERROR(AVERAGE($AC$9:$AC$" + last + "),\"\")",
    ]];
    sheet.getRange("E5").formulas = [[
      "=IFERROR(AVERAGE($AD$9:$AD$" + last + "),\"\")",
    ]];
    sheet.getRange("F5").formulas = [[
      "=IF(COUNT(D5:E5)=2,AVERAGE(D5:E5),\"\")",
    ]];
    sheet.getRange("A4:F4").format = {
      fill: "#E8F0F7",
      font: { name: "Arial", size: 10, bold: true, color: "#183153" },
      rowHeight: 36,
      verticalAlignment: "center",
      wrapText: true,
    };
    for (const address of ["A5", "B5", "C5", "D5", "E5", "F5"]) {
      sheet.getRange(address).format.font = {
        name: "Arial", size: 11, bold: true, color: "#183153",
      };
    }
    sheet.getRange("D5:F5").setNumberFormat("0.00");
    sheet.freezePanes.freezeRows(8);
    own.forEach((record, index) => { record.row = index + 9; });
    if (includeRaw) {
      const archiveHeader = last + 3;
      sheet.getRange("A" + archiveHeader).values = [[
        "JSONs integrais (gzip + base64; partes em ordem)",
      ]];
      sheet.getRange("A" + archiveHeader).format.font = {
        name: "Arial", size: 11, bold: true, color: "#183153",
      };
      sheet.getRange("A" + (archiveHeader + 1) + ":E" + (archiveHeader + 1)).values = [[
        "ID arquivo", "Arquivo JSON", "Parte", "Total de partes", "Conteúdo compactado",
      ]];
      let archiveRow = archiveHeader + 2;
      const archiveBatch = [];
      let batchStart = archiveRow;
      const flushArchive = () => {
        if (!archiveBatch.length) return;
        sheet.getRangeByIndexes(batchStart - 1, 0, archiveBatch.length, 5).values = archiveBatch;
        archiveBatch.length = 0;
        batchStart = archiveRow;
      };
      for (const record of own) {
        record.archiveFirstRow = archiveRow;
        for (let i = 0; i < record.archiveParts.length; i += 1) {
          archiveBatch.push([
            record.id, record.source, i + 1, record.archiveParts.length,
            record.archiveParts[i],
          ]);
          archiveRow += 1;
          if (archiveBatch.length === 20) flushArchive();
        }
      }
      flushArchive();
    }
    if (expectedCategory[sheetName] === "Prefeitura" &&
        !own.some(record => record.category === "Outro/Revisar")) {
      process.stdout.write("Nenhum portal para revisão nesta execução.\n");
    }
  }
  const analysisAudit = addAnalysisSheet(workbook, analysis);
  const errorAudit = addErrorSheet(workbook, errors);
  workbook.recalculate();
  for (const sheetName of SHEETS) {
    const sheet = workbook.worksheets.getItem(sheetName);
    const summary = sheet.getRange("A5:F5").values[0];
    const own = records.filter(record => record.sheet === sheetName);
    const meanFor = tool => {
      const scores = own.filter(record => record.tool === tool)
        .map(scoreForMean).filter(score => score !== null);
      return scores.length
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
    };
    const accessMean = meanFor("AccessMonitor");
    const amaMean = meanFor("AMAWeb");
    const expected = [
      own.filter(record => record.kind === "Relatório API" ||
        record.kind === "Exportação por critério").length,
      own.filter(record => record.tool === "AMAWeb").length,
      own.filter(record => record.tool === "AccessMonitor").length,
      accessMean, amaMean,
      accessMean !== null && amaMean !== null ? (accessMean + amaMean) / 2 : null,
    ];
    if (summary.some((value, index) => expected[index] === null
      ? value !== null && value !== ""
      : !Number.isFinite(value) || Math.abs(value - expected[index]) > 1e-9)) {
      throw new Error("Resumo sem cálculo válido na aba " + sheetName);
    }
    if (preview) {
      const rendered = await workbook.render({
        sheetName, range: "A1:Q12", scale: 1, format: "png",
      });
      const previewFile = path.join(os.tmpdir(),
        "egov-" + tables[sheetName].toLowerCase() + ".png");
      await fs.writeFile(previewFile, new Uint8Array(await rendered.arrayBuffer()));
      process.stdout.write("Prévia: " + previewFile + "\n");
    }
  }
  await fs.mkdir(path.dirname(output), { recursive: true });
  const blob = await SpreadsheetFile.exportXlsx(workbook);
  await blob.save(output);

  // Auditoria independente do modelo em memória: relê o XLSX salvo.
  const saved = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  const persisted = [];
  for (const sheetName of SHEETS) {
    const count = rowCounts[sheetName];
    if (!count) continue;
    const sheet = saved.worksheets.getItem(sheetName);
    const own = records.filter(record => record.sheet === sheetName);
    const sourceRows = sheet.getRange("Z9:AB" + (8 + count)).values;
    const scoreRows = sheet.getRange("F9:G" + (8 + count)).values;
    const statusRows = sheet.getRange("E9:E" + (8 + count)).values;
    for (let i = 0; i < own.length; i += 1) {
      const record = own[i];
      const [source, sha256, id] = sourceRows[i];
      const [score, meanScore] = scoreRows[i];
      const expectedScore = record.kind === "Evidência HTML"
        ? record.evidenceScore : record.score;
      const expectedMean = scoreForMean(record);
      if (source !== record.source || sha256 !== record.sha256 || id !== record.id) {
        throw new Error("Auditoria do XLSX falhou: origem ou SHA-256 diverge em " + record.source);
      }
      if (emptyNumber(score) !== expectedScore ||
          emptyNumber(meanScore) !== expectedMean ||
          statusRows[i][0] !== record.pageStatus) {
        throw new Error("Nota ou situação incorreta no XLSX: " + record.source);
      }
      persisted.push(source);
    }
  }
  const wanted = records.map(record => record.source);
  const persistedSet = new Set(persisted);
  if (persisted.length !== wanted.length || persistedSet.size !== wanted.length ||
      wanted.some(source => !persistedSet.has(source))) {
    throw new Error("Auditoria do XLSX falhou: caminhos JSON ausentes ou duplicados.");
  }
  const savedAnalysis = saved.worksheets.getItem("Análise");
  const savedErrors = saved.worksheets.getItem("Erros");
  if (savedAnalysis.getRange("A2").values[0][0] !==
      "Análise por município — melhores e piores notas" ||
      savedErrors.getRange("A2").values[0][0] !==
      "Falhas de coleta e bloqueios por URL") {
    throw new Error("Auditoria do XLSX falhou: abas de análise ausentes.");
  }
  for (let sectionIndex = 0; sectionIndex < analysis.sections.length; sectionIndex += 1) {
    const section = analysis.sections[sectionIndex];
    const start = 12 + 16 * sectionIndex;
    for (const [groups, columns] of [[section.top, "B:C"],
      [section.bottom, "I:J"]]) {
      const [first, second] = columns.split(":");
      const savedRows = savedAnalysis.getRange(first + start + ":" + second +
        (start + 9)).values;
      for (let i = 0; i < groups.length; i += 1) {
        if (savedRows[i][0] !== groups[i].city ||
            Math.abs(savedRows[i][1] - groups[i].mean) > 1e-9) {
          throw new Error("Auditoria do XLSX falhou: ranking divergente em " +
            section.category + " / " + section.tool);
        }
      }
    }
  }
  if (errors.rows.length) {
    const savedRows = savedErrors.getRange("A9:C" + (8 + errors.rows.length)).values;
    if (savedRows.some((row, i) => row[0] !== errors.rows[i].tool ||
        row[1] !== errors.rows[i].type || row[2] !== errors.rows[i].url)) {
      throw new Error("Auditoria do XLSX falhou: linhas de erro divergentes.");
    }
  }
  if (includeRaw) for (const record of records) {
    const sheet = saved.worksheets.getItem(record.sheet);
    const lastArchiveRow = record.archiveFirstRow + record.archiveParts.length - 1;
    const parts = sheet.getRange("A" + record.archiveFirstRow + ":E" +
      lastArchiveRow).values;
    const encoded = [];
    for (let i = 0; i < parts.length; i += 1) {
      const [id, source, part, total, content] = parts[i];
      if (id !== record.id || source !== record.source || part !== i + 1 ||
          total !== parts.length || typeof content !== "string") {
        throw new Error("Arquivo integral incompleto no XLSX: " + record.source);
      }
      encoded.push(content);
    }
    let restored;
    try {
      restored = gunzipSync(Buffer.from(encoded.join(""), "base64"));
    } catch {
      throw new Error("Arquivo integral corrompido no XLSX: " + record.source);
    }
    const digest = crypto.createHash("sha256").update(restored).digest("hex");
    if (restored.length !== record.size || digest !== record.sha256) {
      throw new Error("SHA-256 do JSON integral diverge no XLSX: " + record.source);
    }
  }
  return { rowCounts, analysisAudit, errorAudit };
}

async function main() {
  const { root, output, preview, includeRaw } = argsFrom(process.argv.slice(2));
  const files = await discover(root);
  if (!files.length) throw new Error("Nenhum JSON encontrado nas duas saídas.");
  process.stdout.write("Lendo " + files.length + " JSONs...\n");
  const scanned = [];
  for (let i = 0; i < files.length; i += 1) {
    scanned.push(await readRecord(root, files[i], i + 1, includeRaw));
    if ((i + 1) % 200 === 0) {
      process.stdout.write("Lidos: " + (i + 1) + "/" + files.length + "\n");
    }
  }
  const sources = scanned.map(record => record.source);
  if (scanned.length !== files.length || new Set(sources).size !== files.length) {
    throw new Error("Auditoria inicial falhou: JSON ausente ou duplicado.");
  }
  const manifests = scanned.filter(isManifest);
  const candidates = scanned.filter(record => !isManifest(record));
  const { records, duplicates } = deduplicateEvaluations(candidates);
  const accounted = [
    ...records.map(record => record.source),
    ...manifests.map(record => record.source),
    ...duplicates.map(({ record }) => record.source),
  ];
  if (accounted.length !== files.length || new Set(accounted).size !== files.length ||
      sources.some(source => !accounted.includes(source))) {
    throw new Error("Auditoria de cobertura falhou após remover duplicatas.");
  }
  const bySource = new Map(records.map(record => [record.source, record]));
  let evidencesPaired = 0;
  for (const evidence of records.filter(record => record.kind === "Evidência HTML")) {
    const report = bySource.get(evidence.pairedSource);
    if (!report || report.kind !== "Relatório API" ||
        report.url !== evidence.url || report.score !== evidence.evidenceScore) {
      throw new Error("Evidência HTML sem relatório correspondente: " + evidence.source);
    }
    evidencesPaired += 1;
  }
  records.sort(compareRecords);
  records.forEach((record, index) => { record.id = index + 1; });
  const cityFor = await municipalityResolver(root);
  const analysis = analysisFor(records, cityFor);
  const errors = await errorAnalysis(root, records, cityFor);
  const api = await loadSpreadsheetApi();
  const { rowCounts, analysisAudit, errorAudit } = await buildWorkbook(
    records, output, preview, includeRaw, api, analysis, errors);
  const after = await discover(root);
  if (after.length !== files.length || after.some((name, i) => name !== files[i])) {
    throw new Error("Arquivos JSON mudaram durante a exportação. Execute novamente.");
  }
  for (let i = 0; i < after.length; i += 1) {
    const stat = await fs.stat(after[i]);
    if (stat.size !== scanned[i].size || stat.mtimeMs !== scanned[i].mtimeMs) {
      throw new Error("JSON alterado durante a exportação: " + scanned[i].source);
    }
  }
  const byKind = {};
  for (const record of records) byKind[record.kind] = (byKind[record.kind] || 0) + 1;
  const byPageStatus = {};
  for (const record of records) {
    byPageStatus[record.pageStatus] = (byPageStatus[record.pageStatus] || 0) + 1;
  }
  const audit = {
    geradoEm: new Date().toISOString(),
    raiz: root,
    planilha: output,
    jsonsDescobertos: files.length,
    jsonsContabilizados: accounted.length,
    manifestosExcluidos: manifests.map(record => record.source),
    criterioDuplicidade: {
      comparacao: "Mesmo conteúdo integral, URL, ferramenta, método, formato, categoria e situação.",
      ignorados: ["Ordem das chaves JSON", "result.data.date", "result.data.tot.info.date",
        "accessmonitor.timestamp", "accessmonitor.download.htmlFile (local do artefato)",
        "Data nas exportações por critério"],
      preservados: ["HTML/pagecode", "Notas", "Testes e elementos", "Hashes e contagens",
        "Status HTTP", "Diferenças de método URL/HTML", "Diferenças de formato"],
      desempate: "Mantém o registro mais recente; caminho resolve empate de datas.",
    },
    duplicatasExcluidas: duplicates.map(({ record, kept }) => ({
      arquivo: record.source, sha256: record.sha256,
      arquivoMantido: kept.source, sha256Mantido: kept.sha256,
      assinaturaSemData: record.duplicateSignature, metodo: record.method,
      ferramenta: record.tool, tipo: record.kind, nota: record.score,
      dataExcluida: record.sourceDate, dataMantida: kept.sourceDate,
      aba: kept.sheet, linhaMantida: kept.row,
    })),
    jsonsConfirmadosNoXlsx: records.length,
    jsonsComSha256ConferidoNoXlsx: records.length,
    jsonsIntegraisConferidosPorSha256: includeRaw ? records.length : 0,
    conteudoIntegralNoXlsx: includeRaw,
    notasEvidenciaNaColunaNota: records.filter(record =>
      record.kind === "Evidência HTML" && record.evidenceScore !== null).length,
    evidenciasHtmlVinculadasAoRelatorio: evidencesPaired,
    marcadoresCloudflareEmHtmlAvaliado: records.filter(record =>
      record.kind === "Evidência HTML" && record.cloudflareMarker === true &&
      record.pageStatus === "Evidência de download").length,
    relatoriosHtmlVaziosForaDaMedia: records.filter(record =>
      record.pageStatus === "HTML vazio/inválido" &&
      scoreForMean(record) === null).length,
    notasZero: records.filter(record =>
      (record.kind === "Evidência HTML" ? record.evidenceScore : record.score) === 0)
      .map(record => record.source),
    bloqueiosCloudflare: records.filter(record =>
      record.pageStatus === "Bloqueio/Cloudflare").length,
    bloqueiosHttp403: records.filter(record =>
      record.pageStatus === "Bloqueio HTTP 403").length,
    errosHttp: records.filter(record => record.pageStatus.startsWith("Erro HTTP")).length,
    bloqueiosConsideradosNaMedia: records.filter(record =>
      (record.pageStatus.startsWith("Bloqueio") ||
        record.pageStatus.startsWith("Erro HTTP")) &&
      scoreForMean(record) !== null).length,
    porAba: rowCounts,
    analise: analysisAudit,
    erros: errorAudit,
    porTipo: byKind,
    porValidadeDaPagina: byPageStatus,
    invalidos: records.filter(record => record.kind === "JSON inválido")
      .map(record => ({ arquivo: record.source, erro: record.observation })),
    arquivos: records.map(record => ({
      id: record.id, arquivo: record.source, sha256: record.sha256,
      tamanhoBytes: record.size, tipo: record.kind, ferramenta: record.tool,
      metodo: record.method,
      ...(record.duplicateSignature ? { assinaturaSemData: record.duplicateSignature } : {}),
      aba: record.sheet, linha: record.row, classificacao: record.category,
      validadeDaPagina: record.pageStatus,
      httpStatus: record.httpStatus,
      ...(record.pairedSource ? { relatorioVinculado: record.pairedSource } : {}),
      ...(record.originalPairedSource ? { relatorioOriginal: record.originalPairedSource } : {}),
      nota: record.kind === "Evidência HTML" ? record.evidenceScore : record.score,
      notaNaMedia: scoreForMean(record),
      ...(includeRaw ? {
        linhaArquivoIntegral: record.archiveFirstRow,
        partesArquivoIntegral: record.archiveParts.length,
      } : {}),
    })),
  };
  const auditPath = output.replace(/\.xlsx$/i, ".auditoria.json");
  await fs.writeFile(auditPath, JSON.stringify(audit, null, 2), "utf8");
  // O renderizador pode deixar um arquivo de inspeção auxiliar junto ao XLSX.
  await fs.rm(output + ".inspect.ndjson", { force: true });
  process.stdout.write(JSON.stringify({
    planilha: output,
    auditoria: auditPath,
    jsonsEncontrados: files.length,
    manifestosExcluidos: manifests.length,
    duplicatasExcluidas: duplicates.length,
    jsonsContabilizados: accounted.length,
    registrosNaPlanilha: records.length,
    notasZero: audit.notasZero.length,
    bloqueiosCloudflare: audit.bloqueiosCloudflare,
    bloqueiosHttp403: audit.bloqueiosHttp403,
    errosHttp: audit.errosHttp,
    evidenciasHtmlVinculadasAoRelatorio: evidencesPaired,
    bloqueiosConsideradosNaMedia: audit.bloqueiosConsideradosNaMedia,
    porAba: rowCounts,
    analise: { secoes: analysisAudit.sections,
      comparacoes: analysisAudit.comparacoes,
      semMunicipio: analysisAudit.semMunicipio.length },
    erros: { linhas: errorAudit.linhas, porTipo: errorAudit.porTipo },
    porTipo: byKind,
    porValidadeDaPagina: byPageStatus,
  }, null, 2) + "\n");
}

main().catch(error => {
  process.stderr.write("Erro: " + error.message + "\n");
  process.exitCode = 1;
});
