// Server-only (build time). Do not import from client scripts.
import { parseDeployEnvironment } from "@platform/seo";
import type { DeployEnvironment } from "@platform/seo";

/**
 * The deployment this build is for, from the DEPLOY_ENV build variable (production | staging | preview).
 * `astro build` fails if it is missing or misspelt, so no deployment is ever indexable by accident (ADR 0005).
 * The local dev server falls back to "preview" (noindex).
 */
export function deployEnvironment(): DeployEnvironment {
  // Pages are pre-rendered in Node at build time, so the process environment is also readable here.
  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const raw: unknown = import.meta.env.DEPLOY_ENV ?? nodeEnv?.["DEPLOY_ENV"];
  if ((raw === undefined || raw === "") && import.meta.env.DEV) return "preview";
  return parseDeployEnvironment(raw);
}
