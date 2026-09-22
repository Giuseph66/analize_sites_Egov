#!/usr/bin/env python3
"""Avalia lotes de URLs pelo AccessMonitor local e exporta JSON/PDF por site."""

from __future__ import annotations

import argparse
import base64
import csv
import html
import json
import os
import re
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
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
)
CSV_FIELDS = [
    "contexto", "ordem", "municipio", "portal_oficial", "url_informada",
    "url_avaliada", "status_validacao_browser", "titulo", "nota",
    "praticas", "aceitaveis", "nao_aceitaveis", "verificar_manual",
    "json", "pdf", "erro",
]


class AccessMonitorError(RuntimeError):
    """Falha ao validar a URL ou consultar o serviço local."""


def ensure_report_url(data: dict[str, Any], requested_url: str) -> dict[str, Any]:
    """Garante URL útil quando a API omite ou retorna rawUrl vazio."""
    if not data.get("rawUrl"):
        data["rawUrl"] = requested_url
    return data


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
        "--test-html-url",
        help="Baixa esta URL e envia o HTML baixado para POST /amp/eval/html.",
    )
    parser.add_argument(
        "--test-html-list",
        type=Path,
        help="Executa o fluxo HTML para uma lista TXT; aceita linhas numeradas com 'URL:'.",
    )
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
        path = ROOT.parent / "validacao_ouvidorias_mt_browser_2026-09-21.csv"
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
    done: set[str] = set()
    for run in runs:
        result_file = run / "resultados.csv"
        if not result_file.is_file():
            continue
        with result_file.open(encoding="utf-8-sig", newline="") as source:
            done.update(row.get("url_avaliada", "").strip() for row in csv.DictReader(source))
    pending = [(url, meta) for url, meta in records if url not in done]
    return pending, str(runs[-1].resolve()) if done else None


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
    return normalized, ensure_report_url(report["data"], url)


def fetch_html(url: str, timeout: int) -> tuple[str, int, str]:
    """Baixa HTML diretamente, inclusive corpo devolvido em HTTPError."""
    request = Request(url, headers={
        "User-Agent": BROWSER_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
    })
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read()
            status = response.status
            content_type = response.headers.get("Content-Type", "")
    except HTTPError as exc:
        body = exc.read()
        status = exc.code
        content_type = exc.headers.get("Content-Type", "") if exc.headers else ""
        if not body:
            raise AccessMonitorError(f"Download HTML respondeu HTTP {exc.code} sem corpo.") from exc
    except URLError as exc:
        raise AccessMonitorError(f"Não foi possível baixar HTML: {exc.reason}") from exc
    except TimeoutError as exc:
        raise AccessMonitorError(f"Download HTML excedeu {timeout}s.") from exc

    charset_match = re.search(r"charset=([\\w-]+)", content_type, re.IGNORECASE)
    encoding = charset_match.group(1) if charset_match else "utf-8"
    try:
        content = body.decode(encoding, errors="replace")
    except LookupError:
        content = body.decode("utf-8", errors="replace")
    return content, status, content_type


def fetch_html_evaluation(
    html_content: str, url: str, timeout: int, api_base: str, referer: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Envia HTML baixado ao endpoint local, sem nova navegação até a URL."""
    payload = json.dumps({"html": html_content}, ensure_ascii=False).encode("utf-8")
    request = Request(
        api_base.rstrip("/") + "/html",
        data=payload,
        method="POST",
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Content-Type": "application/json; charset=utf-8",
            "Referer": referer,
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            envelope = json.load(response)
    except HTTPError as exc:
        detail = exc.read(500).decode("utf-8", "replace").replace("\n", " ")
        raise AccessMonitorError(f"API HTML respondeu HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise AccessMonitorError(f"Não foi possível acessar avaliação HTML local: {exc.reason}") from exc
    except TimeoutError as exc:
        raise AccessMonitorError(f"Avaliação HTML excedeu {timeout}s.") from exc
    except json.JSONDecodeError as exc:
        raise AccessMonitorError("API HTML retornou resposta que não é JSON.") from exc

    report = envelope.get("data") if isinstance(envelope, dict) else None
    if not isinstance(report, dict) or not isinstance(report.get("data"), dict):
        raise AccessMonitorError("Resposta HTML local não contém relatório de avaliação.")
    normalized = {
        "success": 1,
        "message": "Avaliação do HTML baixado pelo AccessMonitor local.",
        "errors": [],
        "result": report,
        "accessmonitor": {
            "timestamp": envelope.get("timestamp"),
            "requestedUrl": url,
            "inputMode": "downloaded-html",
        },
    }
    return normalized, ensure_report_url(report["data"], url)


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
<p><b>Página:</b> {safe(data.get('title'))}<br><b>URL:</b> <span class="url">{safe(data.get('rawUrl') or requested_url)}</span><br><b>Data:</b> {safe(data.get('date', info.get('date')))}</p>
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


def run_html_test(url: str, timeout: int, browser: str, api_base: str, referer: str) -> int:
    """Executa uma avaliação experimental usando HTML baixado em vez de URL."""
    url = validate_url(url)
    content, status, content_type = fetch_html(url, timeout)
    run_dir = create_run_dir(ROOT / "teste_html")
    hostname = urlsplit(url).hostname or "avaliacao"
    safe_host = "".join(char if char.isalnum() or char in "._-" else "_" for char in hostname).strip("._")
    downloaded_file = run_dir / f"download_{safe_host or 'avaliacao'}.html"
    downloaded_file.write_text(content, encoding="utf-8")
    normalized, data = fetch_html_evaluation(content, url, timeout, api_base, referer)
    normalized["accessmonitor"]["download"] = {
        "httpStatus": status,
        "contentType": content_type,
        "bytes": len(content.encode("utf-8")),
        "htmlFile": str(downloaded_file.resolve()),
    }
    _, json_file, pdf_file, pdf_error = save_result(
        normalized, data, url, run_dir, browser, 1
    )
    evidence = {
        "url": url,
        "download_http_status": status,
        "download_content_type": content_type,
        "download_html": str(downloaded_file.resolve()),
        "html_bytes": len(content.encode("utf-8")),
        "html_title": data.get("title", ""),
        "nota": data.get("score", ""),
        "json": str(json_file.resolve()),
        "pdf": str(pdf_file.resolve()) if pdf_file else "",
        "pdf_error": pdf_error,
        "cloudflare_marker": any(
            marker in (str(data.get("title", "")) + "\n" + content).lower()
            for marker in ("cloudflare", "cf-chl-", "just a moment", "access denied")
        ),
    }
    (run_dir / "resultado_teste.json").write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Teste HTML concluído: {url}")
    print(f"  Download HTTP: {status} | {len(content.encode('utf-8'))} bytes")
    print(f"  Título: {data.get('title', '—')}")
    print(f"  Nota: {data.get('score', '—')}")
    print(f"  Marcador Cloudflare no HTML: {'sim' if evidence['cloudflare_marker'] else 'não'}")
    print(f"  HTML: {downloaded_file.resolve()}")
    print(f"  JSON: {json_file.resolve()}")
    if pdf_file:
        print(f"  PDF: {pdf_file.resolve()}")
    if pdf_error:
        print(f"  Falha PDF: {pdf_error}")
    print(f"  Evidência: {(run_dir / 'resultado_teste.json').resolve()}")
    return 1 if pdf_error else 0


def load_html_test_urls(path: Path) -> list[str]:
    if not path.is_file():
        raise AccessMonitorError(f"Lista HTML não encontrada: {path}")
    urls = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        value = line.strip()
        if "URL:" in value:
            value = value.split("URL:", 1)[1].strip()
        if not value or value.startswith("#") or not value.startswith(("http://", "https://")):
            continue
        validate_url(value)
        if value not in urls:
            urls.append(value)
    if not urls:
        raise AccessMonitorError(f"Lista HTML sem URLs válidas: {path}")
    return urls


def run_html_batch(
    list_path: Path, timeout: int, workers: int, browser: str,
    api_base: str, referer: str,
) -> int:
    """Baixa e avalia uma lista de páginas pelo endpoint HTML local."""
    urls = load_html_test_urls(list_path)
    run_dir = create_run_dir(ROOT / "teste_html_lote")
    result_path = run_dir / "resultados_html.csv"
    fields = ["ordem", "url", "download_http", "bytes", "titulo", "nota", "cloudflare_marker", "html", "json", "pdf", "erro"]

    def evaluate_one(position: int, url: str) -> dict[str, Any]:
        hostname = urlsplit(url).hostname or "avaliacao"
        safe_host = "".join(char if char.isalnum() or char in "._-" else "_" for char in hostname).strip("._")
        try:
            content, status, content_type = fetch_html(url, timeout)
            html_file = run_dir / f"download_{safe_host or 'avaliacao'}_{position:03d}.html"
            html_file.write_text(content, encoding="utf-8")
            normalized, data = fetch_html_evaluation(content, url, timeout, api_base, referer)
            normalized["accessmonitor"]["download"] = {
                "httpStatus": status,
                "contentType": content_type,
                "bytes": len(content.encode("utf-8")),
                "htmlFile": str(html_file.resolve()),
            }
            _, json_file, pdf_file, pdf_error = save_result(
                normalized, data, url, run_dir, browser, position
            )
            marker = any(
                token in (str(data.get("title", "")) + "\n" + content).lower()
                for token in ("cloudflare", "cf-chl-", "just a moment", "access denied")
            )
            evidence = {
                "url": url,
                "download_http_status": status,
                "download_content_type": content_type,
                "download_html": str(html_file.resolve()),
                "html_bytes": len(content.encode("utf-8")),
                "html_title": data.get("title", ""),
                "nota": data.get("score", ""),
                "json": str(json_file.resolve()),
                "pdf": str(pdf_file.resolve()) if pdf_file else "",
                "pdf_error": pdf_error,
                "cloudflare_marker": marker,
            }
            evidence_file = run_dir / f"resultado_teste_{position:03d}.json"
            evidence_file.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
            return {
                "ordem": position, "url": url, "download_http": status,
                "bytes": len(content.encode("utf-8")), "titulo": data.get("title", ""),
                "nota": data.get("score", ""), "cloudflare_marker": marker,
                "html": str(html_file.resolve()), "json": str(json_file.resolve()),
                "pdf": str(pdf_file.resolve()) if pdf_file else "", "erro": pdf_error,
            }
        except Exception as exc:
            return {
                "ordem": position, "url": url, "download_http": "", "bytes": "",
                "titulo": "", "nota": "", "cloudflare_marker": "", "html": "",
                "json": "", "pdf": "", "erro": str(exc),
            }

    failures = 0
    with result_path.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        with ThreadPoolExecutor(max_workers=min(workers, len(urls)), thread_name_prefix="html-test") as executor:
            futures = {executor.submit(evaluate_one, position, url): (position, url) for position, url in enumerate(urls, 1)}
            for future in as_completed(futures):
                result = future.result()
                writer.writerow(result)
                output.flush()
                if result["erro"]:
                    failures += 1
                    print(f"[html {result['ordem']}/{len(urls)}] erro: {result['erro'][:180]} | {result['url']}", flush=True)
                else:
                    print(f"[html {result['ordem']}/{len(urls)}] HTTP {result['download_http']} | nota {result['nota']} | {result['url']}", flush=True)
    print(f"Lote HTML: {len(urls)} URLs, {failures} falha(s). Saída: {run_dir.resolve()}", flush=True)
    return 1 if failures else 0


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
        if args.test_html_list:
            return run_html_batch(
                args.test_html_list, args.timeout, args.workers, browser,
                args.api_base, args.referer,
            )
        if args.test_html_url:
            return run_html_test(
                args.test_html_url, args.timeout, browser, args.api_base, args.referer
            )
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
