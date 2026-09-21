#!/usr/bin/env python3
"""Avalia lotes de URLs pelo AccessMonitor local e exporta JSON/PDF por site."""

from __future__ import annotations

import argparse
import base64
import csv
import html
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
API_BASE = os.environ.get(
    "ACCESSMONITOR_API_URL", "http://127.0.0.1:3000/amp/eval/"
).rstrip("/") + "/"
REFERER = os.environ.get("ACCESSMONITOR_REFERER", "http://localhost:3001/")
USER_AGENT = "AccessMonitor-scraper/1.0"
CSV_FIELDS = [
    "contexto", "ordem", "municipio", "portal_oficial", "url_informada",
    "url_avaliada", "status_validacao_browser", "titulo", "nota",
    "praticas", "aceitaveis", "nao_aceitaveis", "verificar_manual",
    "json", "pdf", "erro",
]


class AccessMonitorError(RuntimeError):
    """Falha ao validar a URL ou consultar o serviço local."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Avalia URLs com a API local do AccessMonitor e salva JSON/PDF."
    )
    parser.add_argument(
        "--contexto", choices=("mt", "ouvidorias", "todos"), default="todos",
        help="Lote a executar. Padrão: todos (MT e ouvidorias).",
    )
    parser.add_argument("--workers", type=int, default=3, help="Avaliações simultâneas (padrão: 3).")
    parser.add_argument("--timeout", type=int, default=120, help="Timeout por avaliação, em segundos.")
    parser.add_argument("--browser", help="Caminho do Chromium/Chrome para gerar PDFs.")
    parser.add_argument("--api-base", default=API_BASE, help="Prefixo local da rota eval do AccessMonitor.")
    parser.add_argument("--referer", default=REFERER, help="Referer autorizado pelo backend local.")
    parser.add_argument(
        "--retomar", action="store_true",
        help="Pula URLs já registradas na última saída de cada contexto.",
    )
    return parser.parse_args()


def validate_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise AccessMonitorError(f"URL HTTP/HTTPS inválida: {value}")
    return value


def load_mt() -> list[tuple[str, dict[str, str]]]:
    path = ROOT / "mt_urls_amaweb_unicas.txt"
    if not path.is_file():
        raise AccessMonitorError(f"Lista MT não encontrada: {path}")
    return [
        (validate_url(line.strip()), {"ordem": str(index), "url_informada": line.strip()})
        for index, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1)
        if line.strip()
    ]


def load_ouvidorias() -> list[tuple[str, dict[str, str]]]:
    path = ROOT / "validacao_ouvidorias_mt_browser_2026-09-21.csv"
    if not path.is_file():
        raise AccessMonitorError(f"Planilha de ouvidorias não encontrada: {path}")
    with path.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))
    records = []
    for row in rows:
        url = (row.get("url_final_ou_tentada") or "").strip()
        if not url:
            continue
        records.append((validate_url(url), {
            "ordem": row.get("ordem", ""),
            "municipio": row.get("municipio", ""),
            "portal_oficial": row.get("portal_oficial", ""),
            "url_informada": row.get("url_informada", ""),
            "status_validacao_browser": row.get("status", ""),
        }))
    if not records:
        raise AccessMonitorError(f"A planilha não contém URLs avaliáveis: {path}")
    return records


def create_run_dir(base: Path) -> Path:
    now = datetime.now()
    day = base / now.strftime("%Y-%m-%d")
    day.mkdir(parents=True, exist_ok=True)
    stamp = now.strftime("%H-%M-%S")
    run = day / stamp
    suffix = 2
    while run.exists():
        run = day / f"{stamp}_{suffix:02d}"
        suffix += 1
    run.mkdir()
    return run


def pending_records(name: str, records: list[tuple[str, dict[str, str]]]) -> tuple[list[tuple[str, dict[str, str]]], str | None]:
    base = ROOT / ("saida_mt" if name == "mt" else "saida_ouvidorias_mt")
    runs = sorted((p for p in base.glob("*/*") if p.is_dir()), key=lambda p: p.stat().st_mtime)
    if not runs:
        return records, None
    result_file = runs[-1] / "resultados.csv"
    if not result_file.is_file():
        return records, None
    with result_file.open(encoding="utf-8-sig", newline="") as source:
        done = {row.get("url_avaliada", "").strip() for row in csv.DictReader(source)}
    pending = [(url, meta) for url, meta in records if url not in done]
    return pending, str(runs[-1].resolve())


def find_browser(explicit: str | None) -> str:
    candidates = (explicit,) if explicit else (
        "chromium", "chromium-browser", "google-chrome", "google-chrome-stable"
    )
    for candidate in candidates:
        if not candidate:
            continue
        found = shutil.which(candidate) or (candidate if Path(candidate).is_file() else None)
        if found:
            return found
    raise AccessMonitorError("Chromium/Chrome não encontrado; use --browser CAMINHO.")


def fetch_evaluation(url: str, timeout: int, api_base: str, referer: str) -> tuple[dict[str, Any], dict[str, Any]]:
    encoded_url = base64.b64encode(url.encode("utf-8")).decode("ascii")
    request = Request(
        api_base.rstrip("/") + "/" + quote(encoded_url, safe=""),
        headers={"User-Agent": USER_AGENT, "Accept": "application/json", "Referer": referer},
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            envelope = json.load(response)
    except HTTPError as exc:
        detail = exc.read(500).decode("utf-8", "replace").replace("\n", " ")
        raise AccessMonitorError(f"API respondeu HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise AccessMonitorError(f"Não foi possível acessar o AccessMonitor local: {exc.reason}") from exc
    except TimeoutError as exc:
        raise AccessMonitorError(f"Avaliação excedeu {timeout}s.") from exc
    except json.JSONDecodeError as exc:
        raise AccessMonitorError("API retornou uma resposta que não é JSON.") from exc

    # A API local responde {timestamp, data: {pagecode, data: relatório}}.
    # Mantemos os campos do AMAWeb para reutilizar o formato das exportações.
    report = envelope.get("data") if isinstance(envelope, dict) else None
    if not isinstance(report, dict) or not isinstance(report.get("data"), dict):
        raise AccessMonitorError("Resposta local não contém o relatório de avaliação.")
    normalized = {
        "success": 1,
        "message": "Avaliação executada pelo AccessMonitor local.",
        "errors": [],
        "result": report,
        "accessmonitor": {"timestamp": envelope.get("timestamp"), "requestedUrl": url},
    }
    return normalized, report["data"]


def checks_from_nodes(nodes: Any) -> list[dict[str, str]]:
    checks = []
    if not isinstance(nodes, dict):
        return checks
    for practice, items in nodes.items():
        if not isinstance(items, list):
            continue
        for item in items:
            if isinstance(item, dict):
                elements = item.get("elements", [])
                checks.append({
                    "practice": str(practice),
                    "verdict": str(item.get("verdict", "")),
                    "description": str(item.get("description", "Sem descrição.")),
                    "elements": str(len(elements)) if isinstance(elements, list) else "0",
                })
    return checks


def report_html(data: dict[str, Any], requested_url: str) -> str:
    total = data.get("tot", {}) if isinstance(data.get("tot"), dict) else {}
    info = total.get("info", {}) if isinstance(total.get("info"), dict) else {}
    checks = checks_from_nodes(data.get("nodes"))
    score = data.get("score", info.get("score", "—"))
    passed = sum(check["verdict"] == "passed" for check in checks)
    failed = sum(check["verdict"] == "failed" for check in checks)
    warnings = len(checks) - passed - failed
    practices = total.get("results", {})
    practice_count = len(practices) if isinstance(practices, dict) else len(checks)

    def safe(value: Any) -> str:
        return html.escape(str(value if value not in (None, "") else "—"))

    rows = "".join(
        "<tr>"
        f"<td><code>{safe(check['practice'])}</code></td>"
        f"<td>{safe(check['verdict'])}</td><td>{safe(check['elements'])}</td>"
        f"<td>{safe(check['description'])}</td></tr>"
        for check in checks
    ) or '<tr><td colspan="4">AccessMonitor não retornou detalhes de práticas.</td></tr>'
    return f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório AccessMonitor</title>
<style>
@page {{ size: A4; margin: 14mm; }} * {{ box-sizing: border-box; }}
body {{ color:#25343b; font:10pt Arial,sans-serif; line-height:1.4; }}
h1,h2 {{ color:#104736; }} h2 {{ border-bottom:2px solid #73e2c9; margin-top:24px; }}
.url {{ overflow-wrap:anywhere; }} .score {{ background:#104736; border-radius:8px; color:white; display:inline-block; font-size:26pt; padding:10px 20px; }}
.cards {{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }} .card {{ background:#eef3f6; padding:10px; }}
.card b {{ display:block; font-size:16pt; }} table {{ border-collapse:collapse; table-layout:fixed; width:100%; }}
th,td {{ border:1px solid #d6e0e5; padding:6px; text-align:left; vertical-align:top; overflow-wrap:anywhere; }}
th {{ background:#104736; color:white; }} th:nth-child(1) {{ width:15%; }} th:nth-child(2) {{ width:17%; }} th:nth-child(3) {{ width:10%; }}
</style></head><body>
<h1>Relatório de acessibilidade</h1><p>Avaliação realizada pelo AccessMonitor local.</p>
<p><b>Página:</b> {safe(data.get('title'))}<br><b>URL:</b> <span class="url">{safe(data.get('rawUrl', requested_url))}</span><br><b>Data:</b> {safe(data.get('date', info.get('date')))}</p>
<div class="score">{safe(score)}<small style="display:block;font-size:9pt;text-align:center">Nota AccessMonitor</small></div>
<h2>Resumo dos testes</h2><div class="cards"><div class="card"><b>{passed}</b>Aceitáveis</div><div class="card"><b>{failed}</b>Não aceitáveis</div><div class="card"><b>{warnings}</b>Verificar manualmente</div></div>
<p><b>{practice_count}</b> práticas identificadas · <b>{safe(info.get('htmlTags'))}</b> elementos (x)HTML</p>
<h2>Práticas avaliadas</h2><table><thead><tr><th>Prática</th><th>Veredito</th><th>Elementos</th><th>Descrição</th></tr></thead><tbody>{rows}</tbody></table>
</body></html>"""


def save_result(
    normalized: dict[str, Any], data: dict[str, Any], url: str, run_dir: Path,
    browser: str, position: int,
) -> tuple[dict[str, Any], Path, Path, str]:
    hostname = urlsplit(url).hostname or "avaliacao"
    hostname = "".join(char if char.isalnum() or char in "._-" else "_" for char in hostname).strip("._")
    stem = f"accessmonitor_{hostname or 'avaliacao'}_{position:03d}"
    json_file, pdf_file = run_dir / f"{stem}.json", run_dir / f"{stem}.pdf"
    json_file.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    with tempfile.TemporaryDirectory(prefix="accessmonitor_") as temporary:
        html_file = Path(temporary) / "report.html"
        html_file.write_text(report_html(data, url), encoding="utf-8")
        command = [
            browser, "--headless", "--disable-gpu", "--no-sandbox",
            "--disable-dev-shm-usage", "--no-pdf-header-footer",
            f"--print-to-pdf={pdf_file}", html_file.resolve().as_uri(),
        ]
        completed = subprocess.run(command, capture_output=True, text=True, timeout=60, check=False)
    pdf_error = ""
    if completed.returncode != 0 or not pdf_file.is_file() or pdf_file.stat().st_size == 0:
        pdf_error = (completed.stderr.strip() or completed.stdout.strip() or "falha sem detalhes")[:500]
    return data, json_file, pdf_file if not pdf_error else Path(), pdf_error


def metrics(data: dict[str, Any]) -> dict[str, Any]:
    checks = checks_from_nodes(data.get("nodes"))
    total = data.get("tot", {}) if isinstance(data.get("tot"), dict) else {}
    practices = total.get("results", {})
    info = total.get("info", {}) if isinstance(total.get("info"), dict) else {}
    return {
        "titulo": data.get("title", ""),
        "nota": data.get("score", info.get("score", "")),
        "praticas": len(practices) if isinstance(practices, dict) else len(checks),
        "aceitaveis": sum(c["verdict"] == "passed" for c in checks),
        "nao_aceitaveis": sum(c["verdict"] == "failed" for c in checks),
        "verificar_manual": sum(c["verdict"] not in {"passed", "failed"} for c in checks),
    }


def run_context(
    name: str, records: list[tuple[str, dict[str, str]]], workers: int,
    timeout: int, browser: str, api_base: str, referer: str,
) -> int:
    by_url: dict[str, list[dict[str, str]]] = {}
    for url, meta in records:
        by_url.setdefault(url, []).append(meta)
    urls = list(by_url)
    base = ROOT / ("saida_mt" if name == "mt" else "saida_ouvidorias_mt")
    run_dir = create_run_dir(base)
    manifest = {
        "contexto": name,
        "inicio": datetime.now().astimezone().isoformat(timespec="seconds"),
        "api": api_base,
        "entrada_registros": len(records),
        "urls_unicas": len(urls),
        "workers": min(workers, len(urls)),
        "timeout_segundos": timeout,
        "diretorio": str(run_dir.resolve()),
    }
    (run_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    result_path = run_dir / "resultados.csv"
    failures = 0
    finished = 0
    with result_path.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=CSV_FIELDS)
        writer.writeheader()
        with ThreadPoolExecutor(max_workers=min(workers, len(urls)), thread_name_prefix="accessmonitor") as executor:
            futures = {
                executor.submit(fetch_evaluation, url, timeout, api_base, referer): (index, url)
                for index, url in enumerate(urls, 1)
            }
            for future in as_completed(futures):
                index, url = futures[future]
                meta_rows = by_url[url]
                json_path = pdf_path = ""
                error = ""
                report_data: dict[str, Any] = {}
                try:
                    normalized, report_data = future.result()
                    _, json_file, pdf_file, pdf_error = save_result(
                        normalized, report_data, url, run_dir, browser, index
                    )
                    json_path = str(json_file.resolve())
                    pdf_path = str(pdf_file.resolve()) if pdf_file else ""
                    error = f"PDF: {pdf_error}" if pdf_error else ""
                    if pdf_error:
                        failures += 1
                except Exception as exc:
                    error = str(exc)
                    failures += 1
                values = metrics(report_data) if report_data else {}
                for meta in meta_rows:
                    writer.writerow({
                        "contexto": name,
                        "ordem": meta.get("ordem", index),
                        "municipio": meta.get("municipio", ""),
                        "portal_oficial": meta.get("portal_oficial", ""),
                        "url_informada": meta.get("url_informada", url),
                        "url_avaliada": url,
                        "status_validacao_browser": meta.get("status_validacao_browser", ""),
                        **values,
                        "json": json_path,
                        "pdf": pdf_path,
                        "erro": error,
                    })
                output.flush()
                finished += 1
                if finished % 10 == 0 or finished == len(urls) or error:
                    label = f"erro: {error[:180]}" if error else f"nota {values.get('nota', '—')}"
                    print(f"[{name} {finished}/{len(urls)}] {label} | {url}", flush=True)
    manifest["fim"] = datetime.now().astimezone().isoformat(timespec="seconds")
    manifest["avaliacoes_com_falha_ou_pdf_falho"] = failures
    (run_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Lote {name}: {len(urls)} URLs únicas, {failures} falha(s). Saída: {run_dir.resolve()}", flush=True)
    return failures


def main() -> int:
    args = parse_args()
    if args.workers <= 0 or args.timeout <= 0:
        print("Erro: --workers e --timeout devem ser maiores que zero.", file=sys.stderr)
        return 2
    try:
        browser = find_browser(args.browser)
        contexts = []
        if args.contexto in {"mt", "todos"}:
            contexts.append(("mt", load_mt()))
        if args.contexto in {"ouvidorias", "todos"}:
            contexts.append(("ouvidorias", load_ouvidorias()))
        failures = 0
        for name, records in contexts:
            previous = None
            if args.retomar:
                records, previous = pending_records(name, records)
                if previous:
                    print(f"Retomada {name}: saída anterior {previous}; {len(records)} registro(s) pendente(s).", flush=True)
            if not records:
                print(f"Contexto {name}: nenhuma URL pendente.", flush=True)
                continue
            print(f"Iniciando {name}: {len(records)} registro(s) de entrada; API {args.api_base}", flush=True)
            failures += run_context(
                name, records, args.workers, args.timeout, browser,
                args.api_base, args.referer,
            )
    except AccessMonitorError as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 1
    print(f"Concluído: {len(contexts)} contexto(s), {failures} falha(s).", flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
