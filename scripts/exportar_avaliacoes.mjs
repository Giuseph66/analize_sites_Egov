#!/usr/bin/env node
// Consolida todos os JSONs das saídas AccessMonitor e AMAWeb em três abas.
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
      "Nota referente à página de bloqueio; fora da média.";
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
  try {
    const payload = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
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

async function buildWorkbook(records, output, preview, includeRaw, api) {
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
            record.pageStatus.startsWith("Erro HTTP")) {
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
  return rowCounts;
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
  const records = scanned.filter(record => !isManifest(record));
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
  const api = await loadSpreadsheetApi();
  const rowCounts = await buildWorkbook(records, output, preview, includeRaw, api);
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
    manifestosExcluidos: manifests.map(record => record.source),
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
    porTipo: byKind,
    porValidadeDaPagina: byPageStatus,
    invalidos: records.filter(record => record.kind === "JSON inválido")
      .map(record => ({ arquivo: record.source, erro: record.observation })),
    arquivos: records.map(record => ({
      id: record.id, arquivo: record.source, sha256: record.sha256,
      tamanhoBytes: record.size, tipo: record.kind, ferramenta: record.tool,
      aba: record.sheet, linha: record.row, classificacao: record.category,
      validadeDaPagina: record.pageStatus,
      httpStatus: record.httpStatus,
      ...(record.pairedSource ? { relatorioVinculado: record.pairedSource } : {}),
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
    registrosNaPlanilha: records.length,
    notasZero: audit.notasZero.length,
    bloqueiosCloudflare: audit.bloqueiosCloudflare,
    bloqueiosHttp403: audit.bloqueiosHttp403,
    errosHttp: audit.errosHttp,
    evidenciasHtmlVinculadasAoRelatorio: evidencesPaired,
    bloqueiosConsideradosNaMedia: audit.bloqueiosConsideradosNaMedia,
    porAba: rowCounts,
    porTipo: byKind,
    porValidadeDaPagina: byPageStatus,
  }, null, 2) + "\n");
}

main().catch(error => {
  process.stderr.write("Erro: " + error.message + "\n");
  process.exitCode = 1;
});
