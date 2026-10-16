import { afterAll } from 'vitest'
import { dropTestDbs } from './db.js'

afterAll(dropTestDbs)
