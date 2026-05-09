import { SOURCE_PRIORITY } from './constants.js'

/**
 * 获取来源的基础类别：'社区(omc)' → '社区'，其他原样返回
 */
function baseSource(source) {
  const idx = source.indexOf('(')
  return idx > 0 ? source.slice(0, idx) : source
}

/**
 * 检测冲突：同名 skill 出现在多个位置
 * 返回冲突列表，每项包含：name, active(生效), overridden(被覆盖), locations(全部位置)
 */
export function detectConflicts(skills) {
  const nameMap = new Map()
  for (const s of skills) {
    const key = s.name.toLowerCase()
    if (!nameMap.has(key)) nameMap.set(key, [])
    nameMap.get(key).push(s)
  }

  const conflicts = []
  for (const [, entries] of nameMap) {
    if (entries.length > 1) {
      const sorted = [...entries].sort((a, b) => {
        // 项目级优先生效
        if (a.scope === '项目级' && b.scope !== '项目级') return -1
        if (a.scope !== '项目级' && b.scope === '项目级') return 1
        // 同作用域内按来源优先级排序
        return (SOURCE_PRIORITY[baseSource(a.source)] ?? 9) - (SOURCE_PRIORITY[baseSource(b.source)] ?? 9)
      })
      conflicts.push({
        name: entries[0].name,
        active: sorted[0],
        overridden: sorted.slice(1),
        locations: entries,
      })
    }
  }
  return conflicts
}
