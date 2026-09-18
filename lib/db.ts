import { neon } from "@neondatabase/serverless";

// DATABASE_URL is read at request time so the route doesn't crash the whole
// build if the env var isn't set yet (e.g. first deploy before Neon is wired up).
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(url);
}
