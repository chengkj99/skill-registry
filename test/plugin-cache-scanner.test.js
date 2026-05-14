import { describe, it, expect } from 'vitest'
import { scanPluginCacheSkills } from '../src/plugin-cache-scanner.js'
import { getPaths } from '../src/constants.js'
import { createFakeFs } from './fixtures/fs-helpers.js'

const homeDir = '/home/user'
const projectRoot = '/home/user/project'
const paths = getPaths(homeDir, projectRoot)

describe('scanPluginCacheSkills', () => {
  it('缓存目录不存在时返回空数组', () => {
    const fs = createFakeFs({})
    const registry = new Map()
    const result = scanPluginCacheSkills(paths, registry, fs)
    expect(result).toEqual([])
  })

  it('扫描官方插件(author=Anthropic)下的 skill', () => {
    const skillPath = '/home/user/.claude/plugins/cache/claude-plugins-official/frontend-design/1.0.0/skills/brainstorming'
    const fs = createFakeFs({
      '/home/user/.claude/plugins/cache/claude-plugins-official': null,
      '/home/user/.claude/plugins/cache/claude-plugins-official/frontend-design': null,
      '/home/user/.claude/plugins/cache/claude-plugins-official/frontend-design/1.0.0': null,
      '/home/user/.claude/plugins/cache/claude-plugins-official/frontend-design/1.0.0/skills': null,
      '/home/user/.claude/plugins/cache/claude-plugins-official/frontend-design/1.0.0/.claude-plugin/plugin.json':
        JSON.stringify({ name: 'frontend-design', author: { name: 'Anthropic' } }),
      [skillPath]: null,
      [`${skillPath}/SKILL.md`]: '---\nname: brainstorming\ndescription: Brainstorm skill\n---',
    })
    const registry = new Map()
    const result = scanPluginCacheSkills(paths, registry, fs)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('brainstorming')
    expect(result[0].source).toBe('官方')
    expect(result[0].marketplace).toBe('claude-plugins-official')
  })

  it('扫描社区插件(非Anthropic)下的 skill', () => {
    const skillPath = '/home/user/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/cool-skill'
    const fs = createFakeFs({
      '/home/user/.claude/plugins/cache/claude-plugins-official': null,
      '/home/user/.claude/plugins/cache/claude-plugins-official/superpowers': null,
      '/home/user/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0': null,
      '/home/user/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills': null,
      '/home/user/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/.claude-plugin/plugin.json':
        JSON.stringify({ name: 'superpowers', author: { name: 'Jesse Vincent' } }),
      [skillPath]: null,
      [`${skillPath}/SKILL.md`]: '---\nname: cool-skill\ndescription: Community\n---',
    })
    const registry = new Map()
    const result = scanPluginCacheSkills(paths, registry, fs)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('社区(superpowers)')
  })

  it('多版本时取最新', () => {
    const v1 = '/home/user/.claude/plugins/cache/omc/test-plugin/1.0.0/skills'
    const v2 = '/home/user/.claude/plugins/cache/omc/test-plugin/2.0.0/skills'
    const fs = createFakeFs({
      '/home/user/.claude/plugins/cache/omc': null,
      '/home/user/.claude/plugins/cache/omc/test-plugin': null,
      '/home/user/.claude/plugins/cache/omc/test-plugin/1.0.0': null,
      '/home/user/.claude/plugins/cache/omc/test-plugin/2.0.0': null,
      '/home/user/.claude/plugins/cache/omc/test-plugin/2.0.0/.claude-plugin/plugin.json':
        JSON.stringify({ name: 'test-plugin', author: { name: 'Community' } }),
      [v1]: null,
      [v2]: null,
      [`${v2}/my-skill`]: null,
      [`${v2}/my-skill/SKILL.md`]: '---\nname: my-skill\n---',
    })
    const registry = new Map()
    const result = scanPluginCacheSkills(paths, registry, fs)
    expect(result).toHaveLength(1)
    expect(result[0].version).toBe('2.0.0')
  })

  it('10.0.0 与 9.0.0 并存时选 10.0.0（非字典序）', () => {
    const v9 = '/home/user/.claude/plugins/cache/omc/semver-test/9.0.0/skills'
    const v10 = '/home/user/.claude/plugins/cache/omc/semver-test/10.0.0/skills'
    const fs = createFakeFs({
      '/home/user/.claude/plugins/cache/omc': null,
      '/home/user/.claude/plugins/cache/omc/semver-test': null,
      '/home/user/.claude/plugins/cache/omc/semver-test/9.0.0': null,
      '/home/user/.claude/plugins/cache/omc/semver-test/10.0.0': null,
      '/home/user/.claude/plugins/cache/omc/semver-test/10.0.0/.claude-plugin/plugin.json':
        JSON.stringify({ name: 'semver-test', author: { name: 'Community' } }),
      [v9]: null,
      [v10]: null,
      [`${v10}/x`]: null,
      [`${v10}/x/SKILL.md`]: '---\nname: x\n---',
    })
    const registry = new Map()
    const result = scanPluginCacheSkills(paths, registry, fs)
    expect(result).toHaveLength(1)
    expect(result[0].path).toContain('10.0.0')
    expect(result[0].version).toBe('10.0.0')
  })

  it('扫描 agents/ 目录（OMC 格式）', () => {
    const agentPath = '/home/user/.claude/plugins/cache/omc/omc-plugin/4.11.5/agents/autopilot'
    const fs = createFakeFs({
      '/home/user/.claude/plugins/cache/omc': null,
      '/home/user/.claude/plugins/cache/omc/omc-plugin': null,
      '/home/user/.claude/plugins/cache/omc/omc-plugin/4.11.5': null,
      '/home/user/.claude/plugins/cache/omc/omc-plugin/4.11.5/agents': null,
      '/home/user/.claude/plugins/cache/omc/omc-plugin/4.11.5/.claude-plugin/plugin.json':
        JSON.stringify({ name: 'omc-plugin', author: { name: 'Community' } }),
      [agentPath]: null,
      [`${agentPath}/SKILL.md`]: '---\nname: autopilot\ndescription: Auto mode\n---',
    })
    const registry = new Map()
    const result = scanPluginCacheSkills(paths, registry, fs)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('autopilot')
  })

  it('发现的 skill 同时注册到 pluginRegistry', () => {
    const skillPath = '/home/user/.claude/plugins/cache/omc/test-plugin/1.0.0/skills/my-skill'
    const fs = createFakeFs({
      '/home/user/.claude/plugins/cache/omc': null,
      '/home/user/.claude/plugins/cache/omc/test-plugin': null,
      '/home/user/.claude/plugins/cache/omc/test-plugin/1.0.0': null,
      '/home/user/.claude/plugins/cache/omc/test-plugin/1.0.0/skills': null,
      '/home/user/.claude/plugins/cache/omc/test-plugin/1.0.0/.claude-plugin/plugin.json':
        JSON.stringify({ name: 'test-plugin', author: { name: 'Community' } }),
      [skillPath]: null,
      [`${skillPath}/SKILL.md`]: '---\nname: my-skill\n---',
    })
    const registry = new Map()
    scanPluginCacheSkills(paths, registry, fs)
    expect(registry.get('my-skill')).toBeTruthy()
    expect(registry.get('my-skill').marketplace).toBe('omc')
  })
})
