// Test helper: a D1Like backed by a real SQLite database (node:sqlite), with the real migrations applied.
// It mimics the D1 behaviour the app relies on: a batch is one transaction, and errors carry SQLite's text.
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like, D1Result, D1Statement } from "../src/index.ts";

const MIGRATIONS = new URL("../migrations/", import.meta.url);

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
}

export function sqliteD1(options: { upTo?: string } = {}): D1Like & { sqlite: DatabaseSync; migrate(file: string): void } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrate = (file: string) => sqlite.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  for (const file of migrationFiles()) {
    migrate(file);
    if (options.upTo === file) break;
  }

  const d1Error = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`D1_ERROR: ${message}: SQLITE_CONSTRAINT`);
  };

  const statement = (sql: string, values: unknown[] = []): D1Statement & { exec(): D1Result } => ({
    bind: (...v: unknown[]) => statement(sql, v),
    all: <T,>() => Promise.resolve({ results: sqlite.prepare(sql).all(...(values as never[])) as T[] }),
    first: <T,>() => Promise.resolve((sqlite.prepare(sql).get(...(values as never[])) as T | undefined) ?? null),
    run: () => {
      try {
        const r = sqlite.prepare(sql).run(...(values as never[]));
        return Promise.resolve({ meta: { changes: Number(r.changes) } });
      } catch (error) {
        return Promise.reject(d1Error(error));
      }
    },
    exec: () => {
      const r = sqlite.prepare(sql).run(...(values as never[]));
      return { meta: { changes: Number(r.changes) } };
    },
  });

  return {
    sqlite,
    migrate,
    prepare: (sql) => statement(sql),
    batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((s) => (s as ReturnType<typeof statement>).exec());
        sqlite.exec("COMMIT");
        return Promise.resolve(results);
      } catch (error) {
        sqlite.exec("ROLLBACK");
        return Promise.reject(d1Error(error));
      }
    },
  };
}
