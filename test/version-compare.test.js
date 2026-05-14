import { describe, it, expect } from 'vitest'
import { compareSemverLike, compareSemverLikeDesc } from '../src/version-compare.js'

describe('compareSemverLike', () => {
  it('10.0.0 > 9.0.0（非字符串序）', () => {
    expect(compareSemverLike('10.0.0', '9.0.0')).toBeGreaterThan(0)
    expect(compareSemverLike('9.0.0', '10.0.0')).toBeLessThan(0)
  })

  it('2.0.0 > 1.0.0', () => {
    expect(compareSemverLike('2.0.0', '1.0.0')).toBeGreaterThan(0)
  })

  it('相等返回 0', () => {
    expect(compareSemverLike('1.2.3', '1.2.3')).toBe(0)
  })

  it('compareSemverLikeDesc 用于从新到旧排序', () => {
    const dirs = ['9.0.0', '10.0.0', '1.0.0'].sort(compareSemverLikeDesc)
    expect(dirs[0]).toBe('10.0.0')
    expect(dirs[1]).toBe('9.0.0')
    expect(dirs[2]).toBe('1.0.0')
  })

  it('忽略 v 前缀', () => {
    expect(compareSemverLike('v1.0.0', '1.0.0')).toBe(0)
  })
})
