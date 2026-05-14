import { describe, it, expect } from 'vitest'
import { detectConflicts } from '../src/conflict-detector.js'

function makeSkill(name, source, scope) {
  return {
    name,
    source,
    scope,
    path: `/fake/${scope === '项目级' ? 'project' : 'global'}/.claude/skills/${name}`,
    description: '',
    version: '',
    isSymlink: false,
    symlinkTarget: null,
    hasSkillMd: true,
    marketplace: null,
    plugin: null,
  }
}

describe('detectConflicts', () => {
  it('无冲突时返回空数组', () => {
    const skills = [
      makeSkill('skill-a', '本地', '全局级'),
      makeSkill('skill-b', '项目', '项目级'),
    ]
    expect(detectConflicts(skills)).toEqual([])
  })

  it('检测到同名冲突', () => {
    const skills = [
      makeSkill('my-skill', '本地', '全局级'),
      makeSkill('my-skill', '官方', '全局级'),
    ]
    const conflicts = detectConflicts(skills)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].name).toBe('my-skill')
    expect(conflicts[0].active.source).toBe('本地')
    expect(conflicts[0].overridden).toHaveLength(1)
    expect(conflicts[0].overridden[0].source).toBe('官方')
  })

  it('项目级优先于全局级', () => {
    const skills = [
      makeSkill('my-skill', '官方', '全局级'),
      makeSkill('my-skill', '本地', '项目级'),
    ]
    const conflicts = detectConflicts(skills)
    expect(conflicts[0].active.scope).toBe('项目级')
    expect(conflicts[0].active.source).toBe('本地')
  })

  it('大小写不敏感的冲突检测', () => {
    const skills = [
      makeSkill('My-Skill', '本地', '全局级'),
      makeSkill('my-skill', '官方', '全局级'),
    ]
    const conflicts = detectConflicts(skills)
    expect(conflicts).toHaveLength(1)
  })

  it('三方冲突（3个同名）', () => {
    const skills = [
      makeSkill('x', '本地', '全局级'),
      makeSkill('x', '官方', '全局级'),
      makeSkill('x', '社区(oh-my-claudecode)', '全局级'),
    ]
    const conflicts = detectConflicts(skills)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].active.source).toBe('本地')
    expect(conflicts[0].overridden).toHaveLength(2)
  })

  it('locations 包含所有出现位置', () => {
    const skills = [
      makeSkill('dup', '本地', '全局级'),
      makeSkill('dup', '官方', '项目级'),
    ]
    const conflicts = detectConflicts(skills)
    expect(conflicts[0].locations).toHaveLength(2)
  })
})
