// @qualweb/counter 0.3.5 e publicado sem arquivo de tipos (dist/counter.bundle.js).
// Declaracao minima para uso com @qualweb/core.
declare module '@qualweb/counter' {
  import { ExecutableModuleContext } from '@qualweb/core';
  export class Counter extends ExecutableModuleContext {
    constructor(options?: Record<string, unknown>);
  }
}
