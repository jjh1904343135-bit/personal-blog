import { getDatabase } from '@netlify/database'

let instance
export function database() {
  if (!instance) instance = getDatabase()
  return instance
}

// Used by local integration tests before shutting down the temporary database.
export async function closeDatabase() {
  if (instance) await instance.pool.end()
  instance = undefined
}
