import {
  toChineseSummary,
  inferCategory,
  formatRelativeTime,
  usageHeatLevel,
  heatStars,
  hasChinese,
} from './description-zh.js'

/**
 * 为 skill 列表注入使用统计、中文摘要、健康指标
 * @param {Array} skills
 * @param {Map} usageMap - analyzeSkillUsage 返回值
 * @param {object} [options]
 * @param {object} [options.fs] - 用于读取文件 mtime
 */
export function enrichSkills(skills, usageMap = new Map(), options = {}) {
  const fs = options.fs
  const maxCount = [...usageMap.values()].reduce((m, u) => Math.max(m, u.count), 0)

  return skills.map(skill => {
    const usageKey = skill.name.toLowerCase()
    const usage = usageMap.get(usageKey) || null
    const count = usage?.count || 0
    const heat = usageHeatLevel(count, maxCount)

    let fileAge = null
    if (fs) {
      try {
        const st = fs.statSync(skill.path)
        fileAge = st.mtime.toISOString()
      } catch {}
    }

    const descriptionZh = toChineseSummary(skill.description, skill.name)
    const category = inferCategory(skill.name, skill.description)

    return {
      ...skill,
      descriptionZh,
      category,
      descriptionLang: hasChinese(skill.description) ? 'zh' : 'en',
      usage: {
        count,
        sessions: usage?.sessions || 0,
        lastUsed: usage?.lastUsed || null,
        firstUsed: usage?.firstUsed || null,
        lastUsedLabel: formatRelativeTime(usage?.lastUsed),
        heat,
        heatStars: heatStars(heat),
      },
      fileAge,
      status: count > 0 ? 'active' : 'idle',
    }
  })
}

/**
 * 生成洞察建议
 */
export function generateInsights(enrichedSkills, conflicts) {
  const insights = []
  const idle = enrichedSkills.filter(s => s.usage.count === 0)
  const hot = [...enrichedSkills]
    .filter(s => s.usage.count > 0)
    .sort((a, b) => b.usage.count - a.usage.count)
    .slice(0, 5)

  if (hot.length > 0) {
    insights.push({
      type: 'hot',
      title: '热门技能',
      items: hot.map(s => ({
        name: s.name,
        count: s.usage.count,
        label: (s.descriptionZh || s.description || '').slice(0, 40),
      })),
    })
  }

  if (idle.length > 0) {
    insights.push({
      type: 'idle',
      title: '从未调用',
      count: idle.length,
      items: idle.slice(0, 8).map(s => s.name),
      more: idle.length > 8 ? idle.length - 8 : 0,
    })
  }

  if (conflicts.length > 0) {
    insights.push({
      type: 'conflict',
      title: '名称冲突',
      count: conflicts.length,
      items: conflicts.map(c => ({
        name: c.name,
        active: c.active.source,
        overridden: c.overridden.map(o => o.source),
      })),
    })
  }

  const enOnly = enrichedSkills.filter(s => s.descriptionLang === 'en')
  if (enOnly.length > 5) {
    insights.push({
      type: 'i18n',
      title: '英文描述技能',
      count: enOnly.length,
      hint: '已为英文描述生成中文摘要，建议后续补充 description 中文字段',
    })
  }

  const symlinks = enrichedSkills.filter(s => s.isSymlink)
  if (symlinks.length > 0) {
    insights.push({
      type: 'symlink',
      title: '软链技能',
      count: symlinks.length,
    })
  }

  return insights
}
