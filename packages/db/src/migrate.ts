import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url =
    process.env.DATABASE_URL ??
    "postgresql://rh_research:changeme_local_only@localhost:5432/rh_chain";
  const sql = postgres(url, { max: 1 });

  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const drizzleDir = join(__dirname, "..", "drizzle");
  const files = readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const applied = await sql`SELECT id FROM _migrations WHERE id = ${file}`;
    if (applied.length) {
      console.log(`skip ${file}`);
      continue;
    }
    const body = readFileSync(join(drizzleDir, file), "utf8");
    console.log(`apply ${file}`);
    await sql.unsafe(body);
    await sql`INSERT INTO _migrations (id) VALUES (${file})`;
  }

  console.log("migrations complete");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
