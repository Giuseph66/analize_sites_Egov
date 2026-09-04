import { ExecutableModuleContext, type ModuleType } from '@qualweb/core';

type ExecuteArgs = Parameters<ExecutableModuleContext['execute']>;
type ExecuteReturn = ReturnType<ExecutableModuleContext['execute']>;

export interface ModuleHooks {
  onStart(moduleName: ModuleType): void;
  onEnd(moduleName: ModuleType, durationMs: number, report: Awaited<ExecuteReturn>): void;
  onError(moduleName: ModuleType, durationMs: number, error: unknown): void;
}

/**
 * Decorador que envolve um modulo do QualWeb para medir e anunciar sua execucao.
 *
 * Por que existe: EvaluationManager.evaluate() percorre options.modules num laco
 * `for` e nao emite nenhum evento de progresso. Como `execute()` e publico, um
 * decorador que delega ao modulo real nos da inicio/fim/duracao reais de cada
 * modulo sem alterar o core.
 *
 * getModulePackage() e runModule() nunca sao chamados porque execute() esta
 * sobrescrito e delega ao modulo interno.
 */
export class InstrumentedModule extends ExecutableModuleContext {
  public readonly name: ModuleType;

  constructor(
    private readonly inner: ExecutableModuleContext,
    private readonly hooks: ModuleHooks,
  ) {
    super(inner.options);
    this.name = inner.name;
  }

  public override async execute(...args: ExecuteArgs): Promise<Awaited<ExecuteReturn>> {
    this.hooks.onStart(this.name);
    const startedAt = performance.now();
    try {
      const report = await this.inner.execute(...args);
      this.hooks.onEnd(this.name, performance.now() - startedAt, report);
      return report;
    } catch (error) {
      this.hooks.onError(this.name, performance.now() - startedAt, error);
      throw error;
    }
  }

  protected getModulePackage(): string {
    throw new Error('InstrumentedModule.getModulePackage should never be called');
  }

  protected runModule(): ExecuteReturn {
    throw new Error('InstrumentedModule.runModule should never be called');
  }
}
