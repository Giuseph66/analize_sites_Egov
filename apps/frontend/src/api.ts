import type {
  CreateEvaluationResponse,
  EvaluationEvent,
  EvaluationMetadata,
  EvaluationReport,
  HealthResponse,
  LogEntry,
} from '@lae/shared-types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });

  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

export const api = {
  health: () => request<HealthResponse>('/api/health'),

  createEvaluation: (url: string) =>
    request<CreateEvaluationResponse>('/api/evaluations', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  getEvaluation: (id: string) => request<EvaluationMetadata>(`/api/evaluations/${id}`),
  listEvaluations: () => request<EvaluationMetadata[]>('/api/evaluations?limit=20'),
  getReport: (id: string) => request<EvaluationReport>(`/api/evaluations/${id}/report`),
  getLogs: (id: string) => request<LogEntry[]>(`/api/evaluations/${id}/logs`),

  reportUrl: (id: string) => `/api/evaluations/${id}/report`,
  rawReportUrl: (id: string) => `/api/evaluations/${id}/report/raw`,
  earlReportUrl: (id: string) => `/api/evaluations/${id}/report/earl`,
  screenshotUrl: (id: string) => `/api/evaluations/${id}/screenshot`,
};

/** Assina o stream SSE da avaliacao. Devolve a funcao de cancelamento. */
export function subscribeToEvaluation(
  id: string,
  onEvent: (event: EvaluationEvent) => void,
  onError?: (error: Event) => void,
): () => void {
  const source = new EventSource(`/api/evaluations/${id}/events`);

  const handle = (event: MessageEvent<string>): void => {
    try {
      onEvent(JSON.parse(event.data) as EvaluationEvent);
    } catch {
      // Linha malformada: ignorada de proposito, o stream continua.
    }
  };

  for (const type of ['log', 'stage', 'status', 'done']) {
    source.addEventListener(type, handle as EventListener);
  }
  if (onError) source.addEventListener('error', onError);

  return () => source.close();
}
