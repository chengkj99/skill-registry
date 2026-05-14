import { describe, it, expect } from 'vitest'
import { scanSkillsDir, inferSource } from '../src/scanner.js'
import { getPaths } from '../src/constants.js'
import { createFakeFs } from './fixtures/fs-helpers.js'

const homeDir = '/home/user'
const projectRoot = '/home/user/project'
const paths = getPaths(homeDir, projectRoot)

const noFs = createFakeFs({})

describe('inferSource', () => {
  it('项目目录下返回"自建"', () => {
    const result = inferSource(
      '/home/user/project/.claude/skills/my-skill',
      false, null, new Map(), paths, noFs
    )
    expect(result).toBe('自建')
  })

  it('全局目录下无注册表匹配返回"自建"', () => {
    const result = inferSource(
      '/home/user/.claude/skills/my-skill',
      false, null, new Map(), paths, noFs
    )
    expect(result).toBe('自建')
  })

  it('全局目录下有官方插件注册(isOfficial=true)返回"官方"', () => {
    const registry = new Map([['my-skill', { plugin: 'frontend-design', isOfficial: true }]])
    const result = inferSource(
      '/home/user/.claude/skills/my-skill',
      false, null, registry, paths, noFs
    )
    expect(result).toBe('官方')
  })

  it('全局目录下有社区插件注册返回"社区(插件名)"', () => {
    const registry = new Map([['my-skill', { plugin: 'oh-my-claudecode', isOfficial: false }]])
    const result = inferSource(
      '/home/user/.claude/skills/my-skill',
      false, null, registry, paths, noFs
    )
    expect(result).toBe('社区(oh-my-claudecode)')
  })

  it('软链指向 .agents/skills 返回"社区(agents)"', () => {
    const result = inferSource(
      '/home/user/.claude/skills/remotion',
      true, '/home/user/.agents/skills/remotion', new Map(), paths, noFs
    )
    expect(result).toBe('社区(agents)')
  })

  it('插件缓存路径中官方插件(author=Anthropic)返回"官方"', () => {
    const fs = createFakeFs({
      '/home/user/.claude/plugins/cache/claude-plugins-official/frontend-design/1.0.0/.claude-plugin/plugin.json':
        JSON.stringify({ name: 'frontend-design', author: { name: 'Anthropic' } }),
    })
    const result = inferSource(
      '/home/user/.claude/plugins/cache/claude-plugins-official/frontend-design/1.0.0/skills/autopilot',
      false, null, new Map(), paths, fs
    )
    expect(result).toBe('官方')
  })

  it('插件缓存路径中社区插件返回"社区(插件名)"', () => {
    const fs = createFakeFs({
      '/home/user/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/.claude-plugin/plugin.json':
        JSON.stringify({ name: 'superpowers', author: { name: 'Jesse Vincent' } }),
    })
    const result = inferSource(
      '/home/user/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/brainstorming',
      false, null, new Map(), paths, fs
    )
    expect(result).toBe('社区(superpowers)')
  })

  it('未知路径返回"其他"', () => {
    const result = inferSource(
      '/some/random/path',
      false, null, new Map(), paths, noFs
    )
    expect(result).toBe('其他')
  })

  it('全局目录：registry 仅能通过 frontmatter.name 命中时返回官方', () => {
    const registry = new Map([['doc-name', { plugin: 'frontend-design', isOfficial: true }]])
    const result = inferSource(
      '/home/user/.claude/skills/folder-name',
      false,
      null,
      registry,
      paths,
      noFs,
      { entryName: 'folder-name', fmName: 'doc-name' }
    )
    expect(result).toBe('官方')
  })

  it('全局软链：目标在插件 cache 下且 manifest 为 Anthropic 时返回官方', () => {
    const installBase = '/home/user/.claude/plugins/cache/claude-plugins-official/frontend-design/1.0.0'
    const skillInCache = `${installBase}/skills/autopilot`
    const fs = createFakeFs({
      [`${installBase}/.claude-plugin/plugin.json`]: JSON.stringify({
        name: 'frontend-design',
        author: { name: 'Anthropic' },
      }),
    })
    const result = inferSource(
      '/home/user/.claude/skills/autopilot',
      true,
      skillInCache,
      new Map(),
      paths,
      fs,
      { entryName: 'autopilot', fmName: '' }
    )
    expect(result).toBe('官方')
  })

  it('全局软链：目标在插件 cache 下且非官方时返回社区(插件目录名)', () => {
    const installBase = '/home/user/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0'
    const skillInCache = `${installBase}/skills/brainstorming`
    const fs = createFakeFs({
      [`${installBase}/.claude-plugin/plugin.json`]: JSON.stringify({
        name: 'superpowers',
        author: { name: 'Jesse Vincent' },
      }),
    })
    const result = inferSource(
      '/home/user/.claude/skills/brainstorming',
      true,
      skillInCache,
      new Map(),
      paths,
      fs,
      { entryName: 'brainstorming', fmName: '' }
    )
    expect(result).toBe('社区(superpowers)')
  })
})

describe('scanSkillsDir', () => {
  it('目录不存在时返回空数组', () => {
    const fs = createFakeFs({})
    const result = scanSkillsDir('/nonexistent', '全局级', new Map(), paths, fs)
    expect(result).toEqual([])
  })

  it('扫描包含 SKILL.md 的目录', () => {
    const fs = createFakeFs({
      '/home/user/.claude/skills/my-skill': null,
      '/home/user/.claude/skills/my-skill/SKILL.md': '---\nname: my-skill\ndescription: A test\n---',
    })
    const result = scanSkillsDir(paths.globalSkillsDir, '全局级', new Map(), paths, fs)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('my-skill')
    expect(result[0].description).toBe('A test')
    expect(result[0].scope).toBe('全局级')
    expect(result[0].source).toBe('自建')
    expect(result[0].hasSkillMd).toBe(true)
  })

  it('跳过隐藏目录', () => {
    const fs = createFakeFs({
      '/home/user/.claude/skills/.hidden': null,
      '/home/user/.claude/skills/.hidden/SKILL.md': '---\nname: hidden\n---',
      '/home/user/.claude/skills/visible': null,
      '/home/user/.claude/skills/visible/SKILL.md': '---\nname: visible\n---',
    })
    const result = scanSkillsDir(paths.globalSkillsDir, '全局级', new Map(), paths, fs)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('visible')
  })

  it('无 SKILL.md 时用目录名作为 skill 名', () => {
    const fs = createFakeFs({
      '/home/user/.claude/skills/no-skill-md': null,
    })
    const result = scanSkillsDir(paths.globalSkillsDir, '全局级', new Map(), paths, fs)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('no-skill-md')
    expect(result[0].hasSkillMd).toBe(false)
  })

  it('从插件注册表附加 marketplace 和 plugin 信息', () => {
    const registry = new Map([['reg-skill', { marketplace: 'omc', plugin: 'test-plugin', version: '1.0.0' }]])
    const fs = createFakeFs({
      '/home/user/.claude/skills/reg-skill': null,
      '/home/user/.claude/skills/reg-skill/SKILL.md': '---\nname: reg-skill\n---',
    })
    const result = scanSkillsDir(paths.globalSkillsDir, '全局级', registry, paths, fs)
    expect(result[0].marketplace).toBe('omc')
    expect(result[0].plugin).toBe('test-plugin')
    expect(result[0].version).toBe('1.0.0')
  })

  it('目录名与 frontmatter.name 不一致时仍能用 name 命中注册表来源', () => {
    const registry = new Map([
      ['doc-skill', { marketplace: 'm', plugin: 'my-plugin', version: '1.0.0', isOfficial: false }],
    ])
    const fs = createFakeFs({
      '/home/user/.claude/skills/dir-a': null,
      '/home/user/.claude/skills/dir-a/SKILL.md': '---\nname: doc-skill\ndescription: d\n---',
    })
    const result = scanSkillsDir(paths.globalSkillsDir, '全局级', registry, paths, fs)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('doc-skill')
    expect(result[0].source).toBe('社区(my-plugin)')
  })
})
