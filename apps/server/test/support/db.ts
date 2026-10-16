import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { inject } from 'vitest'
import { databaseUrl, openDb } from '../../src/db/client.js'
import { testDbName } from './db-names.js'

let admin: postgres.Sql | undefined
const adminSql = () => (admin ??= postgres(databaseUrl('postgres'), { onnotice: () => {} }))

/** Migrated databases of this test file. Released ones are emptied and reused: cloning one per test took longer than most tests. */
const created: string[] = []
const free: string[] = []

/** A fully migrated (unless told otherwise), empty database; released by `close()`. */
export async function createTestDb({ migrate = true } = {}) {
  let name = migrate ? free.pop() : undefined
  const reused = name !== undefined
  if (!name) {
    name = testDbName('t')
    await adminSql().unsafe(
      migrate ? `CREATE DATABASE ${name} TEMPLATE ${inject('templateDb')}` : `CREATE DATABASE ${name}`,
    )
    if (migrate) created.push(name)
  }
  const { db, sql: conn } = openDb(databaseUrl(name))
  if (reused) await db.execute(sql.raw(EMPTY))
  const released = name
  return {
    db,
    close: async () => {
      await conn.end()
      if (migrate) free.push(released)
      else await adminSql().unsafe(`DROP DATABASE ${released} WITH (FORCE)`)
    },
  }
}

// DELETE with FK triggers off (superuser): an order of magnitude faster than TRUNCATE, which recreates every file.
const EMPTY = `DO $$ DECLARE r record; BEGIN
  SET LOCAL session_replication_role = replica;
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DELETE FROM %I', r.tablename);
  END LOOP;
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER SEQUENCE %I RESTART', r.sequencename);
  END LOOP;
END $$`

/** Drops this file's databases; registered as an afterAll in test/support/setup.ts. */
export async function dropTestDbs() {
  for (const name of created.splice(0)) await adminSql().unsafe(`DROP DATABASE ${name} WITH (FORCE)`)
  free.length = 0
  await admin?.end()
  admin = undefined
}
