import { describe, it, expect } from 'vitest'
import { scan } from '../src/index.js'
import { run } from '../src/cli.js'
import { getPaths } from '../src/constants.js'
import { createFakeFs } from './fixtures/fs-helpers.js'

/**
 * 全局 ~/.claude/skills 下已有与插件缓存同名的 skill 目录；
 * 来源依赖「先扫缓存写入 registry.isOfficial」才能判为官方。
 */
function createOfficialGlobalMirrorFixture() {
  const homeDir = '/home/user'
  const projectRoot = '/home/user/project'
  const paths = getPaths(homeDir, projectRoot)
  const anthropicManifest = JSON.stringify({
    name: 'frontend-design',
    author: { name: 'Anthropic' },
  })
  const skillMd = '---\nname: brainstorming\ndescription: From official plugin\n---'

  const cacheBase = `${paths.pluginCacheDir}/claude-plugins-official/frontend-design/1.0.0`
  const skillPath = `${cacheBase}/skills/brainstorming`

  const fileTree = {
    [paths.globalSkillsDir]: null,
    [`${paths.globalSkillsDir}/brainstorming`]: null,
    [`${paths.globalSkillsDir}/brainstorming/SKILL.md`]: skillMd,

    [paths.pluginCacheDir]: null,
    [`${paths.pluginCacheDir}/claude-plugins-official`]: null,
    [`${paths.pluginCacheDir}/claude-plugins-official/frontend-design`]: null,
    [cacheBase]: null,
    [`${cacheBase}/.claude-plugin/plugin.json`]: anthropicManifest,
    [`${cacheBase}/skills`]: null,
    [skillPath]: null,
    [`${skillPath}/SKILL.md`]: skillMd,

    [paths.projectSkillsDir]: null,
    // 空目录在 fakeFs 中无法 readdir，需至少一个子路径
    [`${paths.projectSkillsDir}/.placeholder`]: '',
  }

  const fs = createFakeFs(fileTree)
  return { homeDir, projectRoot, fs, paths }
}

describe('CLI 与 scan() 来源一致', () => {
  it('同一 fixture 下 JSON 中全局镜像 skill 的 source 与 scan() 一致（官方）', () => {
    const { homeDir, projectRoot, fs } = createOfficialGlobalMirrorFixture()

    const { skills: apiSkills } = scan({ homeDir, projectRoot, fs })
    const apiBrain = apiSkills.find((s) => s.name === 'brainstorming')
    expect(apiBrain).toBeTruthy()
    expect(apiBrain.source).toBe('官方')

    const output = []
    const fakeConsole = { log: (msg) => output.push(msg), error: () => {} }
    const code = run(['--json'], { cwd: projectRoot, homedir: homeDir, fs, console: fakeConsole })
    expect(code).toBe(0)
    const parsed = JSON.parse(output.join('\n'))
    const cliBrain = parsed.skills.find((s) => s.name === 'brainstorming')
    expect(cliBrain).toBeTruthy()
    expect(cliBrain.source).toBe(apiBrain.source)
  })
})
