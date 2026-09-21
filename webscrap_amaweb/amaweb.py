#!/usr/bin/env python3
"""Gera JSON e PDF a partir de uma avaliação pública do AMAWeb."""

from __future__ import annotations

import argparse
import html
import json
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


AMAWEB_API = "https://amaweb.unifesp.br/server/amp/eval/"
USER_AGENT = "AMAWeb-scraper/1.0 (+https://amaweb.unifesp.br/)"


class AMAWebError(RuntimeError):
    """Erro recuperável na comunicação ou geração do relatório."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Avalia uma URL no AMAWeb e salva os resultados em JSON e PDF."
    )
    parser.add_argument(
        "urls",
        nargs="+",
        help="URLs públicas. Separe várias URLs por vírgula.",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=Path("saida"),
        help="Diretório de saída. Padrão: ./saida",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=120,
        help="Tempo máximo da avaliação remota, em segundos. Padrão: 120s; 0 desativa o limite.",
    )
    parser.add_argument(
        "--browser",
        help="Caminho/nome do Chromium; detectado automaticamente por padrão.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=3,
        help="Avaliações simultâneas. Padrão: 3",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=0,
        help="Repete lote a cada N segundos. 0 executa uma vez. Padrão: 0",
    )
    parser.add_argument(
        "--duration-hours",
        type=float,
        default=0,
        help="Tempo total máximo. 0 roda até Ctrl+C. Só vale c/ --interval.",
    )
    parser.add_argument(
        "--keep-html",
        action="store_true",
        help="Também mantém o HTML intermediário usado para criar o PDF.",
    )
    return parser.parse_args()


def validate_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise AMAWebError("Informe URL pública completa, ex.: https://www.gov.br")
    return value


def parse_urls(values: list[str]) -> list[str]:
    urls = [item.strip() for value in values for item in value.split(",") if item.strip()]
    if not urls:
        raise AMAWebError("Informe ao menos uma URL pública.")
    return [validate_url(url) for url in urls]


def fetch_evaluation(url: str, timeout: int | None) -> dict[str, Any]:
    endpoint = AMAWEB_API + quote(url, safe="")
    request = Request(endpoint, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        response_context = urlopen(request) if timeout is None else urlopen(request, timeout=timeout)
        with response_context as response:
            payload = json.load(response)
    except HTTPError as exc:
        raise AMAWebError(f"AMAWeb respondeu HTTP {exc.code}.") from exc
    except URLError as exc:
        raise AMAWebError(f"Não foi possível acessar AMAWeb: {exc.reason}") from exc
    except TimeoutError as exc:
        message = (
            f"AMAWeb excedeu {timeout}s de espera."
            if timeout is not None
            else "A conexão com AMAWeb expirou no sistema operacional."
        )
        raise AMAWebError(message) from exc
    except json.JSONDecodeError as exc:
        raise AMAWebError("AMAWeb retornou resposta inválida, não JSON.") from exc

    if not isinstance(payload, dict) or payload.get("success") != 1:
        message = payload.get("message", "erro desconhecido") if isinstance(payload, dict) else "erro desconhecido"
        raise AMAWebError(f"Avaliação recusada pelo AMAWeb: {message}")
    if not isinstance(payload.get("result"), dict) or not isinstance(payload["result"].get("data"), dict):
        raise AMAWebError("Resposta AMAWeb não contém os dados da avaliação.")
    return payload


def safe_file_stem(url: str) -> str:
    hostname = urlsplit(url).hostname or "avaliacao"
    clean_name = "".join(char if char.isalnum() or char in "._-" else "_" for char in hostname)
    return clean_name.strip("._") or "avaliacao"


def create_run_dir(base_dir: Path) -> Path:
    now = datetime.now()
    day_dir = base_dir / now.strftime("%Y-%m-%d")
    run_dir = day_dir / now.strftime("%H-%M-%S")
    suffix = 2
    while run_dir.exists():
        run_dir = day_dir / f"{now.strftime('%H-%M-%S')}_{suffix:02d}"
        suffix += 1
    run_dir.mkdir(parents=True)
    return run_dir


def status_label(verdict: str) -> str:
    labels = {
        "passed": "Aceitável",
        "failed": "Não aceitável",
        "warning": "Verificar manualmente",
        "cantTell": "Verificar manualmente",
        "inapplicable": "Não aplicável",
    }
    return labels.get(verdict, verdict or "Não informado")


def status_class(verdict: str) -> str:
    if verdict == "passed":
        return "passed"
    if verdict == "failed":
        return "failed"
    return "warning"


def checks_from_nodes(nodes: Any) -> list[dict[str, str]]:
    if not isinstance(nodes, dict):
        return []

    checks: list[dict[str, str]] = []
    for practice, items in nodes.items():
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            checks.append(
                {
                    "practice": str(practice),
                    "verdict": str(item.get("verdict", "")),
                    "description": str(item.get("description", "Sem descrição.")),
                    "code": str(item.get("resultCode", "")),
                    "elements": str(len(item.get("elements", [])))
                    if isinstance(item.get("elements"), list)
                    else "0",
                }
            )
    return checks


def make_report_html(payload: dict[str, Any], requested_url: str) -> str:
    data = payload["result"]["data"]
    total = data.get("tot", {}) if isinstance(data.get("tot"), dict) else {}
    info = total.get("info", {}) if isinstance(total.get("info"), dict) else {}
    checks = checks_from_nodes(data.get("nodes"))
    score = data.get("score", info.get("score", "—"))
    passed = sum(check["verdict"] == "passed" for check in checks)
    failed = sum(check["verdict"] == "failed" for check in checks)
    warnings = len(checks) - passed - failed
    practices = total.get("results", {})
    practice_count = len(practices) if isinstance(practices, dict) else len(checks)

    def value(item: Any) -> str:
        return html.escape(str(item if item not in (None, "") else "—"))

    rows = "".join(
        "<tr>"
        f"<td><code>{value(check['practice'])}</code></td>"
        f"<td><span class=\"status {status_class(check['verdict'])}\">{value(status_label(check['verdict']))}</span></td>"
        f"<td>{value(check['elements'])}</td>"
        f"<td>{value(check['description'])}</td>"
        "</tr>"
        for check in checks
    )
    if not rows:
        rows = "<tr><td colspan=\"4\">AMAWeb não retornou detalhes de práticas.</td></tr>"

    return f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Relatório AMAWeb — {value(data.get('title', requested_url))}</title>
  <style>
    @page {{ size: A4; margin: 14mm; }}
    * {{ box-sizing: border-box; }}
    body {{ color: #25343b; font: 10pt Arial, sans-serif; line-height: 1.4; }}
    h1 {{ color: #104736; font-size: 22pt; margin: 0; }}
    h2 {{ border-bottom: 2px solid #73e2c9; color: #104736; font-size: 14pt; margin: 26px 0 10px; padding-bottom: 4px; }}
    .muted {{ color: #566774; }}
    .url {{ overflow-wrap: anywhere; }}
    .score {{ background: #104736; border-radius: 8px; color: white; display: inline-block; font-size: 28pt; font-weight: bold; margin: 18px 0; padding: 12px 22px; }}
    .score small {{ display: block; font-size: 9pt; font-weight: normal; text-align: center; }}
    .cards {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }}
    .card {{ background: #eef3f6; border-radius: 5px; padding: 10px; }}
    .card b {{ display: block; font-size: 16pt; }}
    table {{ border-collapse: collapse; table-layout: fixed; width: 100%; }}
    th, td {{ border: 1px solid #d6e0e5; padding: 7px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }}
    th {{ background: #104736; color: white; }}
    th:nth-child(1) {{ width: 15%; }} th:nth-child(2) {{ width: 19%; }} th:nth-child(3) {{ width: 10%; }}
    tr {{ break-inside: avoid; }}
    code {{ font-size: 8pt; }}
    .status {{ border-radius: 10px; font-size: 8pt; font-weight: bold; padding: 3px 7px; white-space: nowrap; }}
    .passed {{ background: #dff5ea; color: #165c3d; }} .failed {{ background: #fbe4e4; color: #9b1c1c; }} .warning {{ background: #fff4d8; color: #7a5200; }}
    footer {{ color: #566774; font-size: 8pt; margin-top: 24px; }}
  </style>
</head>
<body>
  <header>
    <h1>Relatório de acessibilidade</h1>
    <p class="muted">Avaliação realizada pelo AMAWeb</p>
    <p><b>Página:</b> {value(data.get('title'))}<br><b>URL:</b> <span class="url">{value(data.get('rawUrl', requested_url))}</span><br><b>Data AMAWeb:</b> {value(data.get('date', info.get('date')))}</p>
  </header>
  <section>
    <div class="score">{value(score)}<small>Nota AMAWeb (0–10)</small></div>
    <div class="cards">
      <div class="card"><b>{value(info.get('htmlTags'))}</b>Elementos (x)HTML</div>
      <div class="card"><b>{value(practice_count)}</b>Práticas identificadas</div>
      <div class="card"><b>{value(info.get('size'))} bytes</b>Tamanho da página</div>
    </div>
  </section>
  <section>
    <h2>Resumo dos testes</h2>
    <div class="cards">
      <div class="card"><b>{passed}</b>Aceitáveis</div>
      <div class="card"><b>{failed}</b>Não aceitáveis</div>
      <div class="card"><b>{warnings}</b>Verificar manualmente</div>
    </div>
  </section>
  <section>
    <h2>Práticas retornadas pelo AMAWeb</h2>
    <table>
      <thead><tr><th>Prática</th><th>Status</th><th>Elementos</th><th>Descrição</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </section>
  <footer>JSON anexo contém resposta bruta completa do AMAWeb. Relatório gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')}.</footer>
</body>
</html>"""


def find_browser(browser: str | None) -> str:
    if browser:
        found = shutil.which(browser) or (browser if Path(browser).is_file() else None)
        if found:
            return found
        raise AMAWebError(f"Chromium não encontrado: {browser}")
    for candidate in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        found = shutil.which(candidate)
        if found:
            return found
    raise AMAWebError("Chromium/Google Chrome é necessário para gerar o PDF. Use --browser CAMINHO.")


def generate_pdf(browser: str, html_file: Path, pdf_file: Path) -> None:
    command = [
        browser,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_file}",
        html_file.resolve().as_uri(),
    ]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=60, check=False)
    except subprocess.TimeoutExpired as exc:
        raise AMAWebError("Chromium excedeu 60s ao gerar PDF.") from exc
    if completed.returncode != 0 or not pdf_file.is_file() or pdf_file.stat().st_size == 0:
        detail = completed.stderr.strip() or completed.stdout.strip() or "sem detalhes"
        raise AMAWebError(f"Falha ao gerar PDF com Chromium: {detail}")


def save_evaluation(
    payload: dict[str, Any],
    url: str,
    output_dir: Path,
    browser: str,
    keep_html: bool,
    position: int,
) -> tuple[Any, Path, Path, Path | None]:
    stem = f"amaweb_{safe_file_stem(url)}_{position:03d}"
    json_file = output_dir / f"{stem}.json"
    pdf_file = output_dir / f"{stem}.pdf"
    html_file = output_dir / f"{stem}.html"

    json_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    report_html = make_report_html(payload, url)

    if keep_html:
        html_file.write_text(report_html, encoding="utf-8")
        generate_pdf(browser, html_file, pdf_file)
    else:
        with tempfile.TemporaryDirectory(prefix="amaweb_") as temp_dir:
            source_html = Path(temp_dir) / "report.html"
            source_html.write_text(report_html, encoding="utf-8")
            generate_pdf(browser, source_html, pdf_file)

    data = payload["result"]["data"]
    return data.get("score", "—"), json_file, pdf_file, html_file if keep_html else None


def evaluate_one(
    position: int,
    url: str,
    timeout: int | None,
    output_dir: Path,
    browser: str,
    keep_html: bool,
) -> tuple[Any, Path, Path, Path | None]:
    payload = fetch_evaluation(url, timeout)
    return save_evaluation(payload, url, output_dir, browser, keep_html, position)


def run_batch(
    urls: list[str],
    timeout: int | None,
    workers: int,
    output_dir: Path,
    browser: str,
    keep_html: bool,
) -> int:
    failures = 0
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="amaweb") as executor:
        futures = {
            executor.submit(
                evaluate_one,
                position,
                url,
                timeout,
                output_dir,
                browser,
                keep_html,
            ): (position, url)
            for position, url in enumerate(urls, start=1)
        }
        for future in as_completed(futures):
            position, url = futures[future]
            try:
                score, json_file, pdf_file, html_file = future.result()
                print(f"[{position}/{len(urls)}] Concluído: {url}")
                print(f"  Nota AMAWeb: {score}")
                print(f"  JSON: {json_file.resolve()}")
                print(f"  PDF:  {pdf_file.resolve()}")
                if html_file:
                    print(f"  HTML: {html_file.resolve()}")
            except Exception as exc:
                failures += 1
                print(f"[{position}/{len(urls)}] Erro: {url} -> {exc}", file=sys.stderr)
    return failures


def wait_until_next_cycle(seconds: float, deadline: float | None) -> bool:
    wait_until = time.monotonic() + seconds
    if deadline is not None:
        wait_until = min(wait_until, deadline)
    while True:
        remaining = wait_until - time.monotonic()
        if remaining <= 0:
            return deadline is None or time.monotonic() < deadline
        time.sleep(min(remaining, 60))


def main() -> int:
    args = parse_args()
    try:
        if args.timeout < 0:
            raise AMAWebError("--timeout não pode ser negativo.")
        if args.workers <= 0:
            raise AMAWebError("--workers deve ser maior que zero.")
        if args.interval < 0:
            raise AMAWebError("--interval não pode ser negativo.")
        if args.duration_hours < 0:
            raise AMAWebError("--duration-hours não pode ser negativo.")
        urls = parse_urls(args.urls)
        browser = find_browser(args.browser)
        args.output_dir.mkdir(parents=True, exist_ok=True)
    except AMAWebError as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 1

    workers = min(args.workers, len(urls))
    deadline = (
        time.monotonic() + args.duration_hours * 3600 if args.interval and args.duration_hours else None
    )
    failures = 0
    cycle = 0
    try:
        while True:
            cycle += 1
            run_dir = create_run_dir(args.output_dir)
            print(f"Ciclo {cycle} | {len(urls)} URL(s) | {workers} worker(s)")
            print(f"Saída: {run_dir.resolve()}")
            failures += run_batch(
                urls, args.timeout or None, workers, run_dir, browser, args.keep_html
            )
            if args.interval == 0:
                break
            if deadline is not None and time.monotonic() >= deadline:
                break
            print(f"Próximo ciclo em {args.interval}s. Ctrl+C interrompe.")
            if not wait_until_next_cycle(args.interval, deadline):
                break
    except KeyboardInterrupt:
        print("\nInterrompido pelo usuário.", file=sys.stderr)
        return 130

    if failures:
        print(f"Concluído c/ {failures} falha(s).", file=sys.stderr)
        return 1
    print(f"Concluído: {cycle} ciclo(s), {len(urls)} URL(s)/ciclo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
