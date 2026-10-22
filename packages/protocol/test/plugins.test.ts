import { describe, expect, it } from 'vitest'
import { PLUGIN_MAX_FILES, PluginFiles, PluginManifest } from '../src/index.js'

const base = {
  name: 'web-prototype',
  version: '1.0.0',
  title: '网页原型',
  description: '网页',
  category: 'web',
  agents: ['claude'],
  minDaemon: '0.5.0',
  entry: 'web-prototype',
  license: 'Apache-2.0',
}
const tpl = (i: number, group?: string) => ({
  id: `t${i}`,
  title: `模板 ${i}`,
  ...(group === undefined ? {} : { group }),
})
const ds = (i: number, category?: string) => ({
  id: `d${i}`,
  title: `设计 ${i}`,
  swatches: ['#111111', '#ffffff'],
  dir: `design-systems/d${i}`,
  ...(category === undefined ? {} : { category }),
})

describe('plugin manifest', () => {
  it('groups templates and categorises design systems, both optional', () => {
    const m = PluginManifest.parse({
      ...base,
      templates: [tpl(1, '营销网页'), tpl(2)],
      designSystems: [ds(1, '现代极简'), ds(2)],
    })
    expect(m.templates.map((t) => t.group)).toEqual(['营销网页', null])
    expect(m.designSystems.map((d) => d.category)).toEqual(['现代极简', null])
    expect(PluginManifest.safeParse({ ...base, templates: [tpl(1, '')] }).success).toBe(false)
    expect(PluginManifest.safeParse({ ...base, designSystems: [ds(1, 'x'.repeat(21))] }).success).toBe(false)
  })

  it('takes up to 80 templates and 80 design systems', () => {
    const n = (k: number) => Array.from({ length: k }, (_, i) => i)
    const ok = PluginManifest.safeParse({
      ...base,
      templates: n(80).map((i) => tpl(i, '营销网页')),
      designSystems: n(80).map((i) => ds(i, '入门')),
    })
    expect(ok.success).toBe(true)
    expect(PluginManifest.safeParse({ ...base, templates: n(81).map((i) => tpl(i)) }).success).toBe(false)
    expect(PluginManifest.safeParse({ ...base, designSystems: n(81).map((i) => ds(i)) }).success).toBe(false)
  })

  it('takes up to 600 files', () => {
    expect(PLUGIN_MAX_FILES).toBe(600)
    const files = (k: number) => Array.from({ length: k }, (_, i) => ({ path: `f${i}`, content: '' }))
    expect(PluginFiles.safeParse(files(600)).success).toBe(true)
    expect(PluginFiles.safeParse(files(601)).success).toBe(false)
  })
})
