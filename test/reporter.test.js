import { describe, it, expect } from 'vitest'
import { generateMarkdownReport, generateJsonReport, generateTreeReport } from '../src/reporter.js'

const homeDir = '/home/user'
const projectRoot = '/home/user/projects/demo'

function makeSkill(overrides = {}) {
  return {
    name: 'test-skill',
    description: 'A test skill',
    descriptionZh: '测试技能',
    category: '通用工具',
    descriptionLang: 'en',
    version: '1.0.0',
    source: '本地',
    scope: '全局级',
    path: '/home/user/.claude/skills/test-skill',
    isSymlink: false,
    symlinkTarget: null,
    hasSkillMd: true,
    marketplace: null,
    plugin: null,
    usage: { count: 0, sessions: 0, lastUsed: null, lastUsedLabel: '从未调用', heat: 0, heatStars: '☆☆☆☆☆' },
    status: 'idle',
    ...overrides,
  }
}

describe('generateMarkdownReport', () => {
  it('生成包含总览的 Markdown', () => {
    const skills = [
      makeSkill({ name: 'a', source: '本地', scope: '全局级' }),
      makeSkill({ name: 'b', source: '社区(superpowers)', scope: '项目级', path: '/home/user/projects/demo/.claude/skills/b' }),
    ]
    const md = generateMarkdownReport(skills, [], homeDir, projectRoot, { enrichedSkills: skills })
    expect(md).toContain('# Skills 健康报告')
    expect(md).toContain('共发现 | 2 个 skill')
    expect(md).toContain('全局级 | 1 个')
    expect(md).toContain('项目级 | 1 个')
  })

  it('无冲突时显示"无冲突"', () => {
    const md = generateMarkdownReport([makeSkill()], [], homeDir, projectRoot)
    expect(md).toContain('无冲突')
  })

  it('有冲突时显示冲突清单', () => {
    const s1 = makeSkill({ name: 'dup', source: '本地', scope: '全局级' })
    const s2 = makeSkill({ name: 'dup', source: '官方', scope: '全局级', path: '/home/user/.claude/skills/dup2' })
    const conflicts = [{
      name: 'dup',
      active: s1,
      overridden: [s2],
      locations: [s1, s2],
    }]
    const md = generateMarkdownReport([s1, s2], conflicts, homeDir, projectRoot)
    expect(md).toContain('## ⚠️ 冲突清单')
    expect(md).toContain('dup')
    expect(md).toContain('本地')
    expect(md).toContain('官方')
  })

  it('长描述被截断', () => {
    const longDesc = 'A'.repeat(50)
    const skills = [makeSkill({ description: longDesc, descriptionZh: 'A'.repeat(50) })]
    const md = generateMarkdownReport(skills, [], homeDir, projectRoot, { enrichedSkills: skills })
    expect(md).toContain('A'.repeat(33) + '...')
  })

  it('软链技能显示软链追踪', () => {
    const skills = [makeSkill({
      isSymlink: true,
      symlinkTarget: '/home/user/.agents/skills/test-skill',
    })]
    const md = generateMarkdownReport(skills, [], homeDir, projectRoot, { enrichedSkills: skills })
    expect(md).toContain('## 软链追踪')
  })

  it('路径相对于 homeDir 显示', () => {
    const skills = [makeSkill({ path: '/home/user/.claude/skills/test-skill' })]
    const md = generateMarkdownReport(skills, [], homeDir, projectRoot, { enrichedSkills: skills })
    expect(md).toContain('.claude/skills/test-skill')
    expect(md).not.toContain('/home/user/.claude/skills/test-skill')
  })
})

describe('generateJsonReport', () => {
  it('生成正确的 JSON 结构', () => {
    const skills = [
      makeSkill({ name: 'a', source: '本地', scope: '全局级' }),
      makeSkill({ name: 'b', source: '官方', scope: '项目级', path: '/home/user/projects/demo/.claude/skills/b' }),
    ]
    const result = generateJsonReport(skills, [], homeDir, projectRoot, { enrichedSkills: skills })
    expect(result.projectRoot).toBe(projectRoot)
    expect(result.summary.total).toBe(2)
    expect(result.summary.global).toBe(1)
    expect(result.summary.project).toBe(1)
    expect(result.summary.active).toBe(0)
    expect(result.skills).toHaveLength(2)
    expect(result.insights).toBeDefined()
  })

  it('路径相对于 homeDir', () => {
    const skills = [makeSkill({ path: '/home/user/.claude/skills/test-skill' })]
    const result = generateJsonReport(skills, [], homeDir, projectRoot)
    expect(result.skills[0].path).toBe('.claude/skills/test-skill')
  })

  it('bySource 按预定义顺序输出', () => {
    const skills = [
      makeSkill({ source: '本地', scope: '全局级' }),
      makeSkill({ source: '官方', scope: '全局级' }),
      makeSkill({ source: '社区(oh-my-claudecode)', scope: '全局级' }),
    ]
    const result = generateJsonReport(skills, [], homeDir, projectRoot)
    const sources = Object.keys(result.summary.bySource)
    // 官方应排在社区前面，社区排在本地前面（按 SOURCE_ORDER 顺序）
    expect(sources.indexOf('官方')).toBeLessThan(sources.indexOf('社区(oh-my-claudecode)'))
    expect(sources.indexOf('社区(oh-my-claudecode)')).toBeLessThan(sources.indexOf('本地'))
  })

  it('冲突信息正确映射', () => {
    const s1 = makeSkill({ name: 'dup', source: '本地', scope: '全局级' })
    const s2 = makeSkill({ name: 'dup', source: '官方', scope: '全局级', path: '/home/user/.claude/skills/dup2' })
    const conflicts = [{ name: 'dup', active: s1, overridden: [s2], locations: [s1, s2] }]
    const result = generateJsonReport([s1, s2], conflicts, homeDir, projectRoot)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].name).toBe('dup')
    expect(result.conflicts[0].active.source).toBe('本地')
    expect(result.conflicts[0].overridden).toHaveLength(1)
  })
})

describe('generateTreeReport', () => {
  it('输出包含仪表盘标题和技能名', () => {
    const skills = [
      makeSkill({ name: 'my-skill', source: '本地', scope: '全局级', plugin: 'my-plugin' }),
    ]
    const tree = generateTreeReport(skills, [], homeDir, projectRoot, { enrichedSkills: skills, noColor: true })
    expect(tree).toContain('Skills 健康仪表盘')
    expect(tree).toContain('[全局级]')
    expect(tree).toContain('my-plugin')
  })

  it('热门技能区块', () => {
    const skills = [
      makeSkill({ name: 'hot-skill', usage: { count: 10, sessions: 3, lastUsedLabel: '1 天前', heat: 5, heatStars: '★★★★★' } }),
    ]
    const tree = generateTreeReport(skills, [], homeDir, projectRoot, { enrichedSkills: skills, noColor: true })
    expect(tree).toContain('🔥 热门技能')
    expect(tree).toContain('10次')
  })

  it('按来源分组显示', () => {
    const skills = [
      makeSkill({ name: 'a', source: '本地', scope: '全局级' }),
      makeSkill({ name: 'b', source: '官方', scope: '全局级', path: '/home/user/projects/demo/.claude/skills/b' }),
    ]
    const tree = generateTreeReport(skills, [], homeDir, projectRoot, { enrichedSkills: skills, noColor: true })
    expect(tree).toContain('本地')
    expect(tree).toContain('官方')
  })

  it('使用树形连接符', () => {
    const skills = [
      makeSkill({ name: 'a', source: '本地', scope: '全局级' }),
      makeSkill({ name: 'b', source: '本地', scope: '全局级', path: '/home/user/.claude/skills/b' }),
    ]
    const tree = generateTreeReport(skills, [], homeDir, projectRoot, { enrichedSkills: skills, noColor: true })
    expect(tree).toContain('├──')
    expect(tree).toContain('└──')
  })

  it('冲突显示警告标记', () => {
    const s1 = makeSkill({ name: 'dup', source: '本地', scope: '全局级' })
    const s2 = makeSkill({ name: 'dup', source: '官方', scope: '全局级', path: '/home/user/.claude/skills/dup2' })
    const conflicts = [{ name: 'dup', active: s1, overridden: [s2], locations: [s1, s2] }]
    const tree = generateTreeReport([s1, s2], conflicts, homeDir, projectRoot, { noColor: true })
    expect(tree).toContain('冲突')
    expect(tree).toContain('dup')
  })

  it('noColor 模式无 ANSI 码', () => {
    const skills = [makeSkill()]
    const tree = generateTreeReport(skills, [], homeDir, projectRoot, { enrichedSkills: skills, noColor: true })
    expect(tree).not.toMatch(/\x1b\[/)
  })

  it('彩色模式包含 ANSI 码', () => {
    const skills = [makeSkill()]
    const tree = generateTreeReport(skills, [], homeDir, projectRoot)
    expect(tree).toMatch(/\x1b\[/)
  })
})
