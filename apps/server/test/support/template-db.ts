import postgres from 'postgres'
import type { TestProject } from 'vitest/node'
import { databaseUrl, migrateDb, openDb } from '../../src/db/client.js'
import { staleTestDbs, testDbName } from './db-names.js'

declare module 'vitest' {
  export interface ProvidedContext {
    templateDb: string
  }
}

/** Migrates one template per run; `createTestDb` clones it instead of replaying every migration per test. */
export default async function setup(project: TestProject) {
  const name = testDbName('tpl')
  const admin = postgres(databaseUrl('postgres'), { onnotice: () => {} })
  const all = await admin<{ datname: string }[]>`SELECT datname FROM pg_database`
  for (const stale of staleTestDbs(all.map((d) => d.datname)))
    await admin.unsafe(`DROP DATABASE ${stale} WITH (FORCE)`)
  await admin.unsafe(`CREATE DATABASE ${name}`)
  const { db, sql } = openDb(databaseUrl(name))
  await migrateDb(db)
  // CREATE DATABASE … TEMPLATE refuses while any session is connected to the template.
  await sql.end()
  project.provide('templateDb', name)
  return async () => {
    await admin.unsafe(`DROP DATABASE ${name} WITH (FORCE)`)
    await admin.end()
  }
}
