import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDb(connectionString?: string) {
  const url =
    connectionString ??
    process.env.DATABASE_URL ??
    "postgresql://rh_research:changeme_local_only@localhost:5432/rh_chain";
  const client = postgres(url, { max: 10 });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
