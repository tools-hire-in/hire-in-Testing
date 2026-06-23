import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "path";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Single shared connection pool for the whole app (and the session store, which
// imports this pool — see server/auth.ts). Bounding `max` here prevents a
// shift-start login burst from opening unbounded connections and exhausting
// Postgres' connection limit (which previously caused 500s on the root path).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// Never let a background idle-client error crash the process.
pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client:", err);
});

export const db = drizzle(pool, { schema });

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: path.resolve("migrations") });
}
