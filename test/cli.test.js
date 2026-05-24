import { describe, it, expect } from 'vitest'
import { run } from '../src/cli.js'
import { getPaths } from '../src/constants.js'
import { createFakeFs } from './fixtures/fs-helpers.js'

const homeDir = '/home/user'
const projectRoot = '/home/user/project'

function createTestEnv() {
  const paths = getPaths(homeDir, projectRoot)
  const skillMd = (name, desc = 'Test') => `---\nname: ${name}\ndescription: ${desc}\n---`

  const fileTree = {
    // 全局 skill
    [paths.globalSkillsDir]: null,
    [`${paths.globalSkillsDir}/global-skill`]: null,
    [`${paths.globalSkillsDir}/global-skill/SKILL.md`]: skillMd('global-skill', 'Global'),

    // 项目 skill
    [paths.projectSkillsDir]: null,
    [`${paths.projectSkillsDir}/project-skill`]: null,
    [`${paths.projectSkillsDir}/project-skill/SKILL.md`]: skillMd('project-skill', 'Project'),

    // 插件缓存
    [paths.pluginCacheDir]: null,
    [`${paths.pluginCacheDir}/omc`]: null,
    [`${paths.pluginCacheDir}/omc/test-plugin`]: null,
    [`${paths.pluginCacheDir}/omc/test-plugin/1.0.0`]: null,
    [`${paths.pluginCacheDir}/omc/test-plugin/1.0.0/skills`]: null,
    [`${paths.pluginCacheDir}/omc/test-plugin/1.0.0/skills/plugin-skill`]: null,
    [`${paths.pluginCacheDir}/omc/test-plugin/1.0.0/skills/plugin-skill/SKILL.md`]: skillMd('plugin-skill', 'From plugin'),
  }

  const fs = createFakeFs(fileTree)
  const output = []
  const errors = []
  const fakeConsole = {
    log: (...args) => output.push(args.join(' ')),
    error: (...args) => errors.push(args.join(' ')),
  }

  return { fs, fakeConsole, output, errors, paths }
}

describe('run', () => {
  it('--help 返回 0', () => {
    const { fs, fakeConsole } = createTestEnv()
    const code = run(['--help'], { cwd: projectRoot, homedir: homeDir, fs, console: fakeConsole })
    expect(code).toBe(0)
  })

  it('默认输出树形报告', () => {
    const { fs, fakeConsole, output } = createTestEnv()
    const code = run([], { cwd: projectRoot, homedir: homeDir, fs, console: fakeConsole })
    expect(code).toBe(0)
    const result = output.join('\n')
    expect(result).toContain('Skills 健康仪表盘')
    expect(result).toContain('global-skill')
    expect(result).toContain('project-skill')
    expect(result).toContain('└──')
  })

  it('--md 输出 Markdown 格式', () => {
    const { fs, fakeConsole, output } = createTestEnv()
    const code = run(['--md'], { cwd: projectRoot, homedir: homeDir, fs, console: fakeConsole })
    expect(code).toBe(0)
    const result = output.join('\n')
    expect(result).toContain('# Skills 健康报告')
    expect(result).toContain('global-skill')
  })

  it('--json 输出 JSON 格式', () => {
    const { fs, fakeConsole, output } = createTestEnv()
    const code = run(['--json'], { cwd: projectRoot, homedir: homeDir, fs, console: fakeConsole })
    expect(code).toBe(0)
    const result = output.join('\n')
    const parsed = JSON.parse(result)
    expect(parsed.summary.total).toBeGreaterThanOrEqual(2)
    expect(parsed.skills.some(s => s.name === 'global-skill')).toBe(true)
    expect(parsed.skills.some(s => s.name === 'project-skill')).toBe(true)
  })

  it('--output 写入文件（tree 模式，去色）', () => {
    const { fs, fakeConsole, output } = createTestEnv()
    const outPath = '/tmp/test-report.txt'
    const code = run(['--output', outPath], { cwd: projectRoot, homedir: homeDir, fs, console: fakeConsole })
    expect(code).toBe(0)
    expect(output[0]).toContain('报告已写入')
  })

  it('--md --output 写入 Markdown 文件', () => {
    const { fs, fakeConsole, output } = createTestEnv()
    const outPath = '/tmp/test-report.md'
    const code = run(['--md', '--output', outPath], { cwd: projectRoot, homedir: homeDir, fs, console: fakeConsole })
    expect(code).toBe(0)
    expect(output[0]).toContain('Markdown 报告已写入')
  })

  it('--project 指定项目路径', () => {
    const { fs, fakeConsole, output } = createTestEnv()
    const code = run(['--project', projectRoot], { cwd: '/other', homedir: homeDir, fs, console: fakeConsole })
    expect(code).toBe(0)
    const result = output.join('\n')
    expect(result).toContain('project-skill')
  })

  it('扫描失败返回 1', () => {
    const { fs, fakeConsole, errors } = createTestEnv()
    const brokenFs = { ...fs, readdirSync: () => { throw new Error('broken') } }
    const code = run([], { cwd: projectRoot, homedir: homeDir, fs: brokenFs, console: fakeConsole })
    expect(code).toBe(1)
    expect(errors.length).toBeGreaterThan(0)
  })
})
