const PRODUCTION_NODE_ENVS = new Set(["production", "prod"])

/** NODE_ENV says production, as Medusa reads it ("production" or "prod"). */
export function isProductionNodeEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return PRODUCTION_NODE_ENVS.has(env.NODE_ENV ?? "")
}
