/**
 * Forma do relatorio bruto do QualWeb 0.9.x, redeclarada aqui de proposito.
 *
 * O normalizador nao importa @qualweb/core: assim ele pode ler tambem JSONs
 * gravados por execucoes antigas, e os testes rodam sem instanciar o motor.
 * Todos os campos sao opcionais porque o objetivo e degradar com elegancia
 * quando o QualWeb mudar de formato, em vez de estourar.
 */

export interface RawSuccessCriteria {
  name?: string;
  level?: string;
  principle?: string;
  url?: string;
}

export interface RawEvaluationElement {
  pointer?: string;
  htmlCode?: string;
  accessibleName?: string;
  attributes?: string | string[];
  cssCode?: string;
}

export interface RawTestResult {
  verdict?: string;
  description?: string;
  resultCode?: string;
  elements?: RawEvaluationElement[];
  attributes?: string[];
}

export interface RawAssertion {
  name?: string;
  code?: string;
  mapping?: string;
  description?: string;
  metadata?: {
    'success-criteria'?: RawSuccessCriteria[];
    related?: string[];
    url?: string;
    passed?: number;
    warning?: number;
    failed?: number;
    inapplicable?: number;
    outcome?: string;
    description?: string;
  };
  results?: RawTestResult[];
}

export interface RawEvaluationModule {
  type?: string;
  metadata?: { passed?: number; warning?: number; failed?: number; inapplicable?: number };
  assertions?: Record<string, RawAssertion>;
  /** Modulo counter nao tem assertions, tem data. */
  data?: { roles?: Record<string, number>; tags?: Record<string, number> };
}

export interface RawQualwebReport {
  type?: string;
  system?: {
    name?: string;
    version?: string;
    date?: string;
    hash?: string;
    url?: {
      inputUrl?: string;
      protocol?: string;
      domainName?: string;
      domain?: string;
      uri?: string;
      completeUrl?: string;
    };
    page?: {
      viewport?: {
        mobile?: boolean;
        landscape?: boolean;
        userAgent?: string;
        resolution?: { width?: number; height?: number };
      };
      dom?: { html?: string; title?: string; elementCount?: number };
    };
  };
  metadata?: { passed?: number; warning?: number; failed?: number; inapplicable?: number };
  modules?: Record<string, RawEvaluationModule | undefined>;
}
