import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// A single shared connection pool. `prepare: false` is required for
// pooled/serverless Postgres providers (e.g. Neon's pooled connection
// string, Supabase's pgbouncer transaction pooler).
const client = postgres(process.env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });
