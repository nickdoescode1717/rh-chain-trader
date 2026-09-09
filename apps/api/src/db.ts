import { createDb, type Db } from "@rh/db";
import { sql } from "drizzle-orm";
import { config } from "./config.js";

let db: Db | null = null;
let dbAvailable = false;

export async function initDb(): Promise<{ db: Db | null; available: boolean }> {
  try {
    db = createDb(config.databaseUrl);
    await db.execute(sql`SELECT 1`);
    dbAvailable = true;
    console.log("[db] connected");
  } catch (err) {
    console.warn(
      "[db] unavailable — using FICTIONAL in-memory store:",
      (err as Error).message
    );
    db = null;
    dbAvailable = false;
  }
  return { db, available: dbAvailable };
}

export function getDb(): Db | null {
  return dbAvailable ? db : null;
}

export function isDbAvailable(): boolean {
  return dbAvailable;
}
