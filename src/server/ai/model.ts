// A missing model is a deployment mistake, not a transient outage — fail-open paths
// (guardrail, embeddings) rethrow it so it reaches the user instead of being swallowed.
export class ModelConfigError extends Error {
  constructor(envName: string) {
    super(`Brak konfiguracji modelu językowego: zmienna ${envName} nie jest ustawiona.`)
    this.name = 'ModelConfigError'
  }
}

export const requireModel = (envName: string): string => {
  const model = process.env[envName]
  if (!model) throw new ModelConfigError(envName)
  return model
}
