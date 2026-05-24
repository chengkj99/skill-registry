import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { createFakeFs } from './fixtures/fs-helpers.js'
import { analyzeSkillUsage, parseSince, extractSkillInvocations } from '../src/usage-analyzer.js'
import { enrichSkills, generateInsights } from '../src/skill-enricher.js'

const homeDir = '/home/user'
const projectsDir = join(homeDir, '.claude', 'projects')

describe('parseSince', () => {
  it('解析 7d', () => {
    const d = parseSince('7d')
    expect(d).toBeInstanceOf(Date)
    expect(Date.now() - d.getTime()).toBeGreaterThan(6 * 86400000)
  })

  it('无效值返回 null', () => {
    expect(parseSince('invalid')).toBeNull()
    expect(parseSince(null)).toBeNull()
  })
})

describe('analyzeSkillUsage', () => {
  it('从 transcript 统计 Skill 调用', () => {
    const transcript = [
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-05-20T10:00:00Z',
        sessionId: 'sess-1',
        message: {
          content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'brainstorming' } }],
        },
      }),
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-05-21T10:00:00Z',
        sessionId: 'sess-2',
        message: {
          content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'brainstorming' } }],
        },
      }),
    ].join('\n')

    const fs = createFakeFs({
      [join(projectsDir, 'proj', 'abc.jsonl')]: transcript,
    })

    const usage = analyzeSkillUsage({ homeDir, fs, projectsDir })
    const stat = usage.get('brainstorming')
    expect(stat.count).toBe(2)
    expect(stat.sessions).toBe(2)
    expect(stat.lastUsed).toBe('2026-05-21T10:00:00Z')
  })

  it('since 过滤旧记录', () => {
    const transcript = [
      JSON.stringify({
        type: 'assistant',
        timestamp: '2020-01-01T10:00:00Z',
        sessionId: 'old',
        message: {
          content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'old-skill' } }],
        },
      }),
    ].join('\n')

    const fs = createFakeFs({
      [join(projectsDir, 'proj', 'old.jsonl')]: transcript,
    })

    const since = new Date('2026-01-01T00:00:00Z')
    const usage = analyzeSkillUsage({ homeDir, fs, projectsDir, since })
    expect(usage.size).toBe(0)
  })

  it('Cursor manually_attached_skills 计入调用', () => {
    const cursorDir = join(homeDir, '.cursor', 'projects', 'proj', 'agent-transcripts', 'sess-1')
    const transcript = [
      JSON.stringify({
        role: 'user',
        message: {
          content: [{
            type: 'text',
            text: '<manually_attached_skills>\nSkill Name: brainstorming\nPath: /path/SKILL.md\n</manually_attached_skills>\n<user_query>\ntest',
          }],
        },
      }),
    ].join('\n')

    const fs = createFakeFs({
      [join(cursorDir, 'sess-1.jsonl')]: transcript,
    })

    const usage = analyzeSkillUsage({
      homeDir,
      fs,
      projectsDir: join(homeDir, '.empty'),
      cursorProjectsDir: join(homeDir, '.cursor', 'projects'),
    })
    expect(usage.get('brainstorming')?.count).toBe(1)
  })
})

describe('extractSkillInvocations', () => {
  it('Claude Code Skill 工具', () => {
    const names = extractSkillInvocations({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'llm-docs-generator' } }] },
    })
    expect(names).toEqual(['llm-docs-generator'])
  })

  it('Cursor attached skills', () => {
    const names = extractSkillInvocations({
      role: 'user',
      message: { content: [{ type: 'text', text: 'Skill Name: brainstorming\nPath: x' }] },
    })
    expect(names).toEqual(['brainstorming'])
  })
})

describe('enrichSkills', () => {
  it('注入 usage 与中文摘要', () => {
    const skills = [{
      name: 'brainstorming',
      description: 'Use when starting creative work',
      source: '社区(superpowers)',
      scope: '全局级',
      path: '/home/user/.claude/skills/brainstorming',
      isSymlink: false,
      version: '5.1.0',
    }]
    const usage = new Map([['brainstorming', { name: 'brainstorming', count: 5, lastUsed: '2026-05-20T00:00:00Z', sessions: 2 }]])
    const enriched = enrichSkills(skills, usage)
    expect(enriched[0].usage.count).toBe(5)
    expect(enriched[0].descriptionZh).toBeTruthy()
    expect(enriched[0].category).toBe('规划协作')
    expect(enriched[0].status).toBe('active')
  })
})

describe('generateInsights', () => {
  it('生成热门与闲置洞察', () => {
    const enriched = [
      { name: 'hot', usage: { count: 10 }, descriptionLang: 'en', isSymlink: false },
      { name: 'cold', usage: { count: 0 }, descriptionLang: 'en', isSymlink: false },
    ]
    const insights = generateInsights(enriched, [])
    expect(insights.some(i => i.type === 'hot')).toBe(true)
    expect(insights.some(i => i.type === 'idle')).toBe(true)
  })
})
