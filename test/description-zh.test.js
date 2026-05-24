import { describe, it, expect } from 'vitest'
import {
  toChineseSummary,
  inferCategory,
  formatRelativeTime,
  usageHeatLevel,
  heatStars,
  hasChinese,
} from '../src/description-zh.js'

describe('description-zh', () => {
  it('hasChinese 识别中文', () => {
    expect(hasChinese('你好 world')).toBe(true)
    expect(hasChinese('hello world')).toBe(false)
  })

  it('中文描述原样保留', () => {
    const desc = '当用户提问如何找技能时使用此技能。'
    expect(toChineseSummary(desc, 'find-skills')).toContain('当用户')
  })

  it('英文描述生成中文摘要', () => {
    const desc = 'Use when encountering any bug, test failure, or unexpected behavior'
    const summary = toChineseSummary(desc, 'systematic-debugging')
    expect(summary).toContain('【测试质量】')
    expect(summary).toContain('bug')
  })

  it('inferCategory 按关键词分类', () => {
    expect(inferCategory('build-mcp-server', 'build MCP server')).toBe('MCP 集成')
    expect(inferCategory('brainstorming', 'creative work')).toBe('规划协作')
  })

  it('formatRelativeTime 中文相对时间', () => {
    const now = Date.parse('2026-05-24T12:00:00Z')
    expect(formatRelativeTime('2026-05-24T11:30:00Z', now)).toBe('30 分钟前')
    expect(formatRelativeTime(null, now)).toBe('从未调用')
  })

  it('heatStars 生成星级', () => {
    expect(heatStars(3)).toBe('★★★☆☆')
    expect(heatStars(0)).toBe('☆☆☆☆☆')
  })

  it('usageHeatLevel 按占比分级', () => {
    expect(usageHeatLevel(10, 10)).toBe(5)
    expect(usageHeatLevel(0, 10)).toBe(0)
  })
})
