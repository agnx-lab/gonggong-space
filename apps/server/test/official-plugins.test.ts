import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PLUGIN_MANIFEST, PLUGIN_MAX_BYTES, PLUGIN_MAX_FILES, PluginManifest } from '@gonggong/protocol'
import { describe, expect, it } from 'vitest'
import { frontmatter } from '../src/modules/skills/service.js'

const OFFICIAL = join(import.meta.dirname, '../plugins/official')
/** Templates that share another template's guide. */
const SHARED_GUIDES: Record<string, string> = {
  saas: 'web-prototype',
  event: 'web-prototype',
  brand: 'web-prototype',
  docs: 'web-prototype',
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  )
}

function load(name: string) {
  const root = join(OFFICIAL, name)
  const manifest = PluginManifest.parse(JSON.parse(readFileSync(join(root, PLUGIN_MANIFEST), 'utf8')))
  return { root, manifest, skillDir: join(root, 'skills', manifest.entry) }
}

describe.each(readdirSync(OFFICIAL).sort())('official plugin %s', (name) => {
  const { root, manifest, skillDir } = load(name)

  it('has a valid manifest named after its folder', () => {
    expect(manifest.name).toBe(name)
    expect(manifest.templates.every((t) => t.group)).toBe(true)
    expect(manifest.designSystems.every((d) => d.category)).toBe(true)
    expect(manifest.inputs.find((i) => i.id === 'title')?.required).toBe(true)
  })

  it('has a guide for every template and every preview file', () => {
    for (const t of manifest.templates) {
      const guide = SHARED_GUIDES[t.id] ?? t.id
      expect(existsSync(join(skillDir, 'templates', guide, 'GUIDE.md')), t.id).toBe(true)
      if (t.preview) expect(existsSync(join(root, t.preview)), t.preview).toBe(true)
    }
  })

  it('lists every template in the entry skill index', () => {
    const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8')
    for (const t of manifest.templates) expect(skill, t.id).toContain(`\`${t.id}\``)
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
    const files = walk(root)
    expect(files.length).toBeLessThan(PLUGIN_MAX_FILES)
    expect(files.reduce((n, f) => n + statSync(f).size, 0)).toBeLessThan(PLUGIN_MAX_BYTES)
  })

  it('carries no open-design specifics', () => {
    for (const f of walk(skillDir))
      expect(readFileSync(f, 'utf8'), f).not.toMatch(
        /data-od-id|lint-artifact|<artifact>|discovery-question-form/,
      )
  })
})

describe('official plugin web-prototype', () => {
  const { manifest } = load('web-prototype')

  it('leads with the four classic templates and the neutral design system', () => {
    expect(manifest.templates.slice(0, 4).map((t) => t.id)).toEqual(['saas', 'event', 'brand', 'docs'])
    expect(manifest.designSystems[0]?.id).toBe('neutral-modern')
  })
})

describe('official plugin slides', () => {
  const { manifest } = load('slides')

  it('is a deck plugin whose templates carry their own visual systems', () => {
    expect(manifest.category).toBe('deck')
    expect(manifest.designSystems).toEqual([])
    expect(manifest.templates[0]?.id).toBe('html-ppt')
  })
})
