/**
 * Validacao e resolucao de URLs (§12 e §21).
 *
 * Dois problemas distintos, resolvidos aqui:
 *
 * 1. Politica de seguranca: a ferramenta recebe URLs arbitrarias e as abre num
 *    navegador real. Bloqueamos protocolos perigosos (file:, data:, javascript:)
 *    e, opcionalmente, a rede local. Por padrao a rede local e PERMITIDA — avaliar
 *    localhost e o proposito da ferramenta —, mas isso e configuravel.
 *
 * 2. Traducao de host: dentro de um container, `localhost` aponta para o proprio
 *    container. Reescrevemos para o alias do host, registrando as duas URLs.
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]']);

const PRIVATE_IPV4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

export class UrlPolicyError extends Error {
  constructor(
    message: string,
    readonly kind: 'invalid-url' | 'blocked-url',
  ) {
    super(message);
    this.name = 'UrlPolicyError';
  }
}

export interface UrlPolicyOptions {
  allowLocalNetwork: boolean;
  allowFileProtocol: boolean;
  localhostAlias: string | null;
}

export interface ResolvedUrl {
  /** URL como o usuario informou (normalizada). */
  inputUrl: string;
  /** URL que o navegador vai carregar. */
  resolvedUrl: string;
  /** true quando o host foi reescrito por causa do container. */
  rewritten: boolean;
  isLocal: boolean;
}

export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (LOCAL_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.localhost')) return true;
  return PRIVATE_IPV4.some((pattern) => pattern.test(host));
}

export function resolveUrl(rawUrl: string, options: UrlPolicyOptions): ResolvedUrl {
  const trimmed = (rawUrl ?? '').trim();
  if (!trimmed) throw new UrlPolicyError('URL vazia.', 'invalid-url');

  // Sem esquema explicito, assume http:// (o caso comum e digitar "localhost:5173").
  //
  // Cuidado: `localhost:5173` casa com a forma generica de um esquema URI, e tratar
  // "localhost" como esquema faria a URL ser rejeitada. Por isso um prefixo seguido
  // de digitos e lido como host:porta, nao como esquema. Formas sem "//" que sao
  // esquemas de verdade (javascript:, data:, mailto:) continuam sendo detectadas,
  // porque nao vem seguidas de digito.
  const hasScheme =
    /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) || /^[a-zA-Z][a-zA-Z0-9+.-]*:(?!\d)/.test(trimmed);
  const withScheme = hasScheme ? trimmed : `http://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new UrlPolicyError(`URL malformada: ${rawUrl}`, 'invalid-url');
  }

  const protocol = parsed.protocol.toLowerCase();

  if (protocol === 'file:') {
    if (!options.allowFileProtocol) {
      throw new UrlPolicyError('Protocolo file: bloqueado (ALLOW_FILE_PROTOCOL=false).', 'blocked-url');
    }
  } else if (protocol !== 'http:' && protocol !== 'https:') {
    throw new UrlPolicyError(
      `Protocolo nao suportado: ${protocol} (permitidos: http, https${options.allowFileProtocol ? ', file' : ''}).`,
      'blocked-url',
    );
  }

  if (protocol === 'file:') {
    return { inputUrl: parsed.href, resolvedUrl: parsed.href, rewritten: false, isLocal: true };
  }

  if (!parsed.hostname) throw new UrlPolicyError(`URL sem host: ${rawUrl}`, 'invalid-url');

  const isLocal = isLocalHostname(parsed.hostname);

  if (isLocal && !options.allowLocalNetwork) {
    throw new UrlPolicyError(
      `Endereco de rede local bloqueado: ${parsed.hostname} (ALLOW_LOCAL_NETWORK=false).`,
      'blocked-url',
    );
  }

  const inputUrl = parsed.href;
  let rewritten = false;

  if (options.localhostAlias && LOCAL_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    parsed.hostname = options.localhostAlias;
    rewritten = true;
  }

  return { inputUrl, resolvedUrl: parsed.href, rewritten, isLocal };
}
