import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PLUGIN_MANIFEST, PLUGIN_MAX_BYTES, PLUGIN_MAX_FILES, PluginManifest } from '@gonggong/protocol'
import { describe, expect, it } from 'vitest'
import { frontmatter } from '../src/modules/skills/service.js'

const ROOT = join(import.meta.dirname, '../../../plugins/official/web-prototype')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  )
}

describe('official plugin web-prototype', () => {
  const manifest = PluginManifest.parse(JSON.parse(readFileSync(join(ROOT, PLUGIN_MANIFEST), 'utf8')))
  const skillDir = join(ROOT, 'skills', manifest.entry)

  it('has a valid manifest', () => {
    expect(manifest.name).toBe('web-prototype')
    expect(manifest.templates.map((t) => t.id)).toEqual(['saas', 'event', 'brand', 'docs'])
    expect(manifest.designSystems.map((d) => d.id)).toEqual(['neutral-modern', 'warm-editorial'])
    expect(manifest.inputs.find((i) => i.id === 'title')?.required).toBe(true)
  })

  it('has an entry SKILL.md whose frontmatter names the entry', () => {
    const content = readFileSync(join(skillDir, 'SKILL.md'), 'utf8')
    expect(frontmatter([{ path: 'SKILL.md', content, encoding: 'utf8' }]).name).toBe(manifest.entry)
  })

  it('ships DESIGN.md and tokens.css for every design system', () => {
    for (const ds of manifest.designSystems) {
      expect(existsSync(join(skillDir, ds.dir, 'DESIGN.md')), ds.dir).toBe(true)
      expect(existsSync(join(skillDir, ds.dir, 'tokens.css')), ds.dir).toBe(true)
    }
  })

  it('stays within the upload limits', () => {
    const files = walk(ROOT)
    expect(files.length).toBeLessThan(PLUGIN_MAX_FILES)
    expect(files.reduce((n, f) => n + statSync(f).size, 0)).toBeLessThan(PLUGIN_MAX_BYTES)
  })

  it('carries no open-design specifics', () => {
    for (const f of walk(skillDir))
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/data-od-id|lint-artifact|<artifact>/)
  })
})
