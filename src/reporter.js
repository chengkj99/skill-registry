import { relative } from 'node:path'
import { SOURCE_ORDER, SOURCE_COLORS, RESET, BOLD, DIM, RED, YELLOW, GRAY, CYAN, GREEN, MAGENTA } from './constants.js'
import { generateInsights } from './skill-enricher.js'

/**
 * 获取来源的基础类别
 */
function baseSource(source) {
  const idx = source.indexOf('(')
  return idx > 0 ? source.slice(0, idx) : source
}

/**
 * 按来源排序
 */
function sortSources(a, b) {
  const baseA = baseSource(a), baseB = baseSource(b)
  const idxA = SOURCE_ORDER.indexOf(baseA), idxB = SOURCE_ORDER.indexOf(baseB)
  if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB)
  return a.localeCompare(b)
}

function pad(str, len) {
  const s = String(str)
  if (s.length >= len) return s.slice(0, len - 1) + '…'
  return s + ' '.repeat(len - s.length)
}

function bar(ratio, width = 16) {
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function scopeBadge(scope, c) {
  if (scope === '项目级') return `${c.magenta}[项目级]${c.reset}`
  return `${c.cyan}[全局级]${c.reset}`
}

function pluginLabel(skill) {
  if (skill.plugin) return skill.plugin.length > 14 ? skill.plugin.slice(0, 12) + '..' : skill.plugin
  if (skill.source.startsWith('社区(')) {
    const inner = skill.source.slice(3, -1)
    return inner.length > 14 ? inner.slice(0, 12) + '..' : inner
  }
  return '—'
}

/**
 * 生成 Markdown 报告
 */
export function generateMarkdownReport(skills, conflicts, homeDir, projectRoot, options = {}) {
  const enriched = options.enrichedSkills || skills
  const usageWindow = options.usageWindow || '全部'
  const globalCount = skills.filter(s => s.scope === '全局级').length
  const projectCount = skills.filter(s => s.scope === '项目级').length
  const activeCount = enriched.filter(s => s.usage?.count > 0).length
  const idleCount = enriched.length - activeCount
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  let md = `# Skills 健康报告

> 生成时间：${now}
> 项目路径：${projectRoot}
> 调用统计窗口：${usageWindow}

## 总览

| 指标 | 数值 |
|------|------|
| 共发现 | ${skills.length} 个 skill |
| 冲突 | ${conflicts.length} 处 |
| 全局级 | ${globalCount} 个 |
| 项目级 | ${projectCount} 个 |
| 有调用记录 | ${activeCount} 个 |
| 从未调用 | ${idleCount} 个 |
`

  const hot = [...enriched].filter(s => s.usage?.count > 0).sort((a, b) => b.usage.count - a.usage.count).slice(0, 10)
  if (hot.length > 0) {
    md += `\n## 🔥 热门技能\n\n| 排名 | skill | 调用次数 | 会话数 | 最近调用 | 中文摘要 |\n|------|-------|---------|--------|---------|----------|\n`
    hot.forEach((s, i) => {
      md += `| ${i + 1} | ${s.name} | ${s.usage.count} | ${s.usage.sessions} | ${s.usage.lastUsedLabel} | ${s.descriptionZh?.slice(0, 40) || ''} |\n`
    })
  }

  const sourceStats = {}
  for (const s of skills) sourceStats[s.source] = (sourceStats[s.source] || 0) + 1
  const sortedSources = Object.keys(sourceStats).sort(sortSources)
  md += `\n### 来源分布\n\n| 来源 | 数量 |\n|------|------|\n`
  for (const src of sortedSources) md += `| ${src} | ${sourceStats[src]} |\n`

  md += `\n### 来源分类明细\n\n`
  const grouped = new Map()
  for (const s of enriched) {
    if (!grouped.has(s.source)) grouped.set(s.source, [])
    grouped.get(s.source).push(s)
  }
  for (const src of sortedSources) {
    const group = grouped.get(src)
    if (!group?.length) continue
    md += `#### ${src}（${group.length} 个）\n\n`
    md += `| skill | 作用域 | 分类 | 调用 | 最近 | 中文摘要 | 版本 | 路径 |\n`
    md += `| ----- | ------ | ---- | ---- | ---- | -------- | ---- | ---- |\n`
    for (const s of [...group].sort((a, b) => (b.usage?.count || 0) - (a.usage?.count || 0) || a.name.localeCompare(b.name))) {
      const displayPath = relative(homeDir, s.path)
      md += `| ${s.name} | ${s.scope} | ${s.category || '-'} | ${s.usage?.count || 0} | ${s.usage?.lastUsedLabel || '-'} | ${((s.descriptionZh || '').length > 36 ? (s.descriptionZh || '').slice(0, 33) + '...' : (s.descriptionZh || ''))} | ${s.version || '-'} | ${displayPath} |\n`
    }
    md += '\n'
  }

  if (conflicts.length > 0) {
    md += `## ⚠️ 冲突清单\n\n| skill | 生效（来源） | 被覆盖（来源） |\n| ----- | ------------ | -------------- |\n`
    for (const c of conflicts) {
      const activeInfo = `${relative(homeDir, c.active.path)} (${c.active.source})`
      for (const ov of c.overridden) {
        md += `| ${c.name} | ${activeInfo} | ${relative(homeDir, ov.path)} (${ov.source}) |\n`
      }
    }
    md += `\n> 作用域近的优先（项目级 > 全局级），同作用域内按 \`SOURCE_PRIORITY\`：本地 > 官方 > 社区（含 \`社区(...)\` 子类）> 其他。\n`
  } else {
    md += `## 冲突清单\n\n无冲突。\n`
  }

  const symlinks = enriched.filter(s => s.isSymlink)
  if (symlinks.length > 0) {
    md += `\n## 软链追踪\n\n| skill | 指向 |\n| ----- | ---- |\n`
    for (const s of symlinks) {
      const target = s.symlinkTarget ? relative(homeDir, s.symlinkTarget) : '(无法解析)'
      md += `| ${s.name} | ${target} |\n`
    }
  }

  return md
}

/**
 * 生成 JSON 报告对象
 */
export function generateJsonReport(skills, conflicts, homeDir, projectRoot, options = {}) {
  const enriched = options.enrichedSkills || skills
  const insights = generateInsights(enriched, conflicts)

  return {
    generatedAt: new Date().toISOString(),
    projectRoot,
    usageWindow: options.usageWindow || 'all',
    summary: {
      total: skills.length,
      conflicts: conflicts.length,
      global: skills.filter(s => s.scope === '全局级').length,
      project: skills.filter(s => s.scope === '项目级').length,
      active: enriched.filter(s => s.usage?.count > 0).length,
      idle: enriched.filter(s => s.usage?.count === 0).length,
      bySource: Object.fromEntries(
        [...new Set(skills.map(s => s.source))].sort(sortSources)
          .map(src => [src, skills.filter(s => s.source === src).length])
      ),
    },
    insights,
    conflicts: conflicts.map(c => ({
      name: c.name,
      active: { path: relative(homeDir, c.active.path), source: c.active.source },
      overridden: c.overridden.map(o => ({ path: relative(homeDir, o.path), source: o.source })),
    })),
    skills: enriched.map(s => ({
      name: s.name,
      description: s.description,
      descriptionZh: s.descriptionZh,
      category: s.category,
      descriptionLang: s.descriptionLang,
      source: s.source,
      scope: s.scope,
      version: s.version || null,
      marketplace: s.marketplace || null,
      plugin: s.plugin || null,
      usage: s.usage,
      isSymlink: s.isSymlink,
      symlinkTarget: s.symlinkTarget ? relative(homeDir, s.symlinkTarget) : null,
      path: relative(homeDir, s.path),
      status: s.status,
    })),
  }
}

/**
 * 生成终端彩色仪表盘报告
 */
export function generateTreeReport(skills, conflicts, homeDir, projectRoot, options = {}) {
  const enriched = options.enrichedSkills || skills
  const usageWindow = options.usageWindow || '全部'
  const sortBy = options.sortBy || 'usage'
  const c = options.noColor
    ? { reset: '', bold: '', dim: '', red: '', yellow: '', gray: '', cyan: '', green: '', magenta: '' }
    : {
        reset: RESET, bold: BOLD, dim: DIM, red: RED, yellow: YELLOW, gray: GRAY,
        cyan: CYAN, green: GREEN, magenta: MAGENTA,
        ...Object.fromEntries(Object.entries(SOURCE_COLORS).map(([k, v]) => [k, v])),
      }

  const lines = []
  const globalCount = skills.filter(s => s.scope === '全局级').length
  const projectCount = skills.filter(s => s.scope === '项目级').length
  const activeCount = enriched.filter(s => s.usage?.count > 0).length
  const idleCount = enriched.length - activeCount
  const totalCalls = enriched.reduce((n, s) => n + (s.usage?.count || 0), 0)
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  // 仪表盘头部
  const w = 68
  lines.push(`${c.bold}╔${'═'.repeat(w)}╗${c.reset}`)
  lines.push(`${c.bold}║${c.reset} ${c.bold}Skills 健康仪表盘${c.reset}${' '.repeat(w - 22)}${c.dim}${now.slice(0, 10)}${c.reset} ${c.bold}║${c.reset}`)
  lines.push(`${c.bold}╠${'═'.repeat(w)}╣${c.reset}`)
  const row1 = ` 共 ${skills.length} 个 │ 全局 ${globalCount} │ 项目 ${projectCount} │ 冲突 ${conflicts.length} │ 活跃 ${activeCount} │ 闲置 ${idleCount} │ 调用 ${totalCalls} 次`
  lines.push(`${c.bold}║${c.reset}${pad(row1, w)}${c.bold}║${c.reset}`)
  lines.push(`${c.bold}║${c.reset}${pad(` 统计窗口：${usageWindow}（Claude Code + Cursor 会话记录）`, w)}${c.bold}║${c.reset}`)
  lines.push(`${c.bold}╚${'═'.repeat(w)}╝${c.reset}`)
  lines.push('')

  // 热门 Top 5
  const hot = [...enriched].filter(s => s.usage?.count > 0).sort((a, b) => b.usage.count - a.usage.count).slice(0, 5)
  const maxHot = hot[0]?.usage?.count || 1
  if (hot.length > 0) {
    lines.push(`${c.yellow}${c.bold}🔥 热门技能${c.reset}`)
    for (const s of hot) {
      const ratio = s.usage.count / maxHot
      lines.push(`  ${c.bold}${pad(s.name, 28)}${c.reset} ${c.yellow}${String(s.usage.count).padStart(3)}次${c.reset}  ${c.dim}${bar(ratio)}${c.reset}  ${c.gray}${s.descriptionZh?.slice(0, 28) || ''}${c.reset}`)
    }
    lines.push('')
  }

  // 洞察条
  if (idleCount > 0) {
    const idleNames = enriched.filter(s => !s.usage?.count).slice(0, 4).map(s => s.name).join(', ')
    const more = idleCount > 4 ? ` 等 ${idleCount} 个` : ''
    lines.push(`${c.dim}💤 从未调用：${idleNames}${more}${c.reset}`)
    lines.push('')
  }

  // 按来源分组
  const grouped = new Map()
  for (const s of enriched) {
    if (!grouped.has(s.source)) grouped.set(s.source, [])
    grouped.get(s.source).push(s)
  }

  for (const src of [...grouped.keys()].sort(sortSources)) {
    const group = grouped.get(src)
    if (!group?.length) continue

    const srcColor = c[src] || c[baseSource(src)] || ''
    const sepLen = Math.max(1, 52 - src.length)
    lines.push(`${srcColor}${c.bold}${src}${c.reset} ${c.dim}${'─'.repeat(sepLen)}${c.reset} ${srcColor}${c.bold}${group.length}${c.reset}`)

    const sorted = [...group].sort((a, b) => {
      if (sortBy === 'usage') {
        const diff = (b.usage?.count || 0) - (a.usage?.count || 0)
        if (diff !== 0) return diff
      }
      return a.name.localeCompare(b.name)
    })

    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i]
      const isLast = i === sorted.length - 1
      const prefix = isLast ? '└──' : '├──'
      const linkMark = s.isSymlink ? ` ${c.yellow}→${c.reset}` : ''
      const usage = s.usage || { count: 0, heatStars: '☆☆☆☆☆', lastUsedLabel: '从未调用' }
      const ver = s.version ? ` · v${s.version}` : ''
      const plugin = pluginLabel(s)

      lines.push(`  ${c.dim}${prefix}${c.reset} ${scopeBadge(s.scope, c)} ${c.dim}${pad(plugin, 16)}${c.reset} ${c.bold}${s.name}${c.reset}${linkMark}`)
      lines.push(`  ${c.dim}${isLast ? '    ' : '│   '}${c.reset} ${c.yellow}${usage.heatStars}${c.reset}  ${usage.count > 0 ? `${c.green}调用 ${usage.count} 次${c.reset}` : `${c.dim}未调用${c.reset}`} · ${c.dim}${usage.lastUsedLabel}${c.reset}${ver} · ${c.cyan}${s.category || '通用'}${c.reset}`)
      lines.push(`  ${c.dim}${isLast ? '    ' : '│   '}${c.reset} ${c.gray}${(s.descriptionZh || s.description || '（暂无描述）').slice(0, 62)}${c.reset}`)
    }
    lines.push('')
  }

  // 冲突
  if (conflicts.length > 0) {
    lines.push(`${c.yellow}${c.bold}⚠️  冲突 (${conflicts.length})${c.reset}  ${c.dim}项目级 > 全局级；同作用域内 本地 > 官方 > 社区${c.reset}`)
    for (const conflict of conflicts) {
      const overriddenLabels = conflict.overridden.map(o => `${c.red}${o.source}${c.reset}`).join(', ')
      lines.push(`  ${c.yellow}●${c.reset} ${c.bold}${conflict.name}${c.reset}  ${c.green}${conflict.active.source}${c.reset} 生效 ← 被覆盖: ${overriddenLabels}`)
    }
    lines.push('')
  }

  // 底部建议
  const insights = generateInsights(enriched, conflicts)
  const i18n = insights.find(i => i.type === 'i18n')
  if (i18n) {
    lines.push(`${c.dim}💡 ${i18n.count} 个技能仍为英文描述，已自动生成中文摘要${c.reset}`)
  }

  return lines.join('\n') + '\n'
}
