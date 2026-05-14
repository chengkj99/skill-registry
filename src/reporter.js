import { relative } from 'node:path'
import { SOURCE_ORDER, SOURCE_COLORS, RESET, BOLD, DIM, RED, YELLOW, GRAY } from './constants.js'

/**
 * 树形行内灰色元信息：作用域 + 可选插件名（控制宽度）
 */
function formatTreeSkillMeta(s, c) {
  let inner = s.scope
  if (s.plugin) {
    let p = String(s.plugin)
    if (p.length > 14) p = `${p.slice(0, 13)}…`
    inner += ` · ${p}`
  }
  return `${c.dim}[${inner}]${c.reset} `
}

/**
 * 获取来源的基础类别：'社区(omc)' → '社区'，其他原样返回
 */
function baseSource(source) {
  const idx = source.indexOf('(')
  return idx > 0 ? source.slice(0, idx) : source
}

/**
 * 按来源排序：先按 SOURCE_ORDER 中基础类别的顺序，同大类内按子类名字典序
 */
function sortSources(a, b) {
  const baseA = baseSource(a), baseB = baseSource(b)
  const idxA = SOURCE_ORDER.indexOf(baseA), idxB = SOURCE_ORDER.indexOf(baseB)
  if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB)
  return a.localeCompare(b)
}

/**
 * 生成 Markdown 报告
 */
export function generateMarkdownReport(skills, conflicts, homeDir, projectRoot) {
  const globalCount = skills.filter(s => s.scope === '全局级').length
  const projectCount = skills.filter(s => s.scope === '项目级').length
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  let md = `# Skills 清单报告

> 生成时间：${now}
> 项目路径：${projectRoot}

## 总览

| 指标 | 数值 |
|------|------|
| 共发现 | ${skills.length} 个 skill |
| 冲突 | ${conflicts.length} 处 |
| 全局级 | ${globalCount} 个 |
| 项目级 | ${projectCount} 个 |
`

  // 按来源统计
  const sourceStats = {}
  for (const s of skills) {
    sourceStats[s.source] = (sourceStats[s.source] || 0) + 1
  }
  const sortedSources = Object.keys(sourceStats).sort(sortSources)
  md += `\n### 来源分布\n\n| 来源 | 数量 |\n|------|------|\n`
  for (const src of sortedSources) {
    md += `| ${src} | ${sourceStats[src]} |\n`
  }

  // 按来源分组明细
  md += `\n### 来源分类明细\n\n`
  const grouped = new Map()
  for (const s of skills) {
    if (!grouped.has(s.source)) grouped.set(s.source, [])
    grouped.get(s.source).push(s)
  }
  for (const src of sortedSources) {
    const group = grouped.get(src)
    if (!group || group.length === 0) continue
    md += `#### ${src}（${group.length} 个）\n\n`
    md += `| skill 名 | 描述 | marketplace | plugin | 路径 |\n`
    md += `| --------- | ---- | ---------- | ------ | ---- |\n`
    for (const s of [...group].sort((a, b) => a.name.localeCompare(b.name))) {
      const desc = s.description.length > 30 ? s.description.slice(0, 27) + '...' : s.description
      const displayPath = relative(homeDir, s.path)
      md += `| ${s.name} | ${desc} | ${s.marketplace || '-'} | ${s.plugin || '-'} | ${displayPath} |\n`
    }
    md += '\n'
  }

  // 冲突清单
  if (conflicts.length > 0) {
    md += `## 冲突清单\n\n`
    md += `| skill 名 | 生效（来源） | 被覆盖（来源） |\n`
    md += `| --------- | ------------ | -------------- |\n`
    for (const c of conflicts) {
      const activeInfo = `${relative(homeDir, c.active.path)} (${c.active.source})`
      for (const ov of c.overridden) {
        const ovInfo = `${relative(homeDir, ov.path)} (${ov.source})`
        md += `| ${c.name} | ${activeInfo} | ${ovInfo} |\n`
      }
    }
    md += `\n> 作用域近的优先（项目级 > 全局级），同作用域内按 \`SOURCE_PRIORITY\`：本地 > 官方 > 社区（含 \`社区(...)\` 子类）> 其他。\n`
  } else {
    md += `## 冲突清单\n\n无冲突。\n`
  }

  // 完整清单
  md += `\n## 完整清单\n\n`
  md += `| skill 名 | 描述 | 来源 | 作用域 | marketplace | 软链 | 路径 |\n`
  md += `| --------- | ---- | ---- | ------ | ---------- | ---- | ---- |\n`
  for (const s of [...skills].sort((a, b) => a.name.localeCompare(b.name))) {
    const desc = s.description.length > 35 ? s.description.slice(0, 32) + '...' : s.description
    const linkMark = s.isSymlink ? '→' : ''
    const displayPath = relative(homeDir, s.path)
    md += `| ${s.name} | ${desc} | ${s.source} | ${s.scope} | ${s.marketplace || '-'} | ${linkMark} | ${displayPath} |\n`
  }

  // 软链清单
  const symlinks = skills.filter(s => s.isSymlink)
  if (symlinks.length > 0) {
    md += `\n## 软链追踪\n\n`
    md += `| skill 名 | 指向 |\n`
    md += `| --------- | ---- |\n`
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
export function generateJsonReport(skills, conflicts, homeDir, projectRoot) {
  return {
    generatedAt: new Date().toISOString(),
    projectRoot,
    summary: {
      total: skills.length,
      conflicts: conflicts.length,
      global: skills.filter(s => s.scope === '全局级').length,
      project: skills.filter(s => s.scope === '项目级').length,
      bySource: Object.fromEntries(
        [...new Set(skills.map(s => s.source))]
          .sort(sortSources)
          .map(src => [src, skills.filter(s => s.source === src).length])
      ),
    },
    conflicts: conflicts.map(c => ({
      name: c.name,
      active: { path: relative(homeDir, c.active.path), source: c.active.source },
      overridden: c.overridden.map(o => ({ path: relative(homeDir, o.path), source: o.source })),
    })),
    skills: skills.map(s => ({
      name: s.name,
      description: s.description,
      source: s.source,
      scope: s.scope,
      marketplace: s.marketplace || null,
      plugin: s.plugin || null,
      isSymlink: s.isSymlink,
      symlinkTarget: s.symlinkTarget ? relative(homeDir, s.symlinkTarget) : null,
      path: relative(homeDir, s.path),
    })),
  }
}

/**
 * 去除 ANSI 颜色码
 */
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}

/**
 * 生成终端彩色树形报告
 * @param {Array} skills
 * @param {Array} conflicts
 * @param {string} homeDir
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {boolean} [options.noColor] - 写文件时去色
 */
export function generateTreeReport(skills, conflicts, homeDir, projectRoot, options = {}) {
  const c = options.noColor
    ? new Proxy({}, { get: () => '' })
    : { reset: RESET, bold: BOLD, dim: DIM, red: RED, yellow: YELLOW, gray: GRAY, ...Object.fromEntries(Object.entries(SOURCE_COLORS).map(([k, v]) => [k, v])) }

  const lines = []

  // 标题行
  const conflictTag = conflicts.length > 0 ? `, ${c.yellow}${c.bold}${conflicts.length} conflicts${c.reset}` : ''
  lines.push(`${c.bold}Skills 清单报告${c.reset} (${skills.length} skills${conflictTag})`)
  lines.push('')

  // 按来源分组
  const grouped = new Map()
  for (const s of skills) {
    if (!grouped.has(s.source)) grouped.set(s.source, [])
    grouped.get(s.source).push(s)
  }

  for (const src of [...grouped.keys()].sort(sortSources)) {
    const group = grouped.get(src)
    if (!group || group.length === 0) continue

    const srcColor = c[src] || c[baseSource(src)] || ''
    const separator = '─'.repeat(Math.max(1, 40 - src.length * 2))
    lines.push(`${srcColor}${c.bold}${src}${c.reset} ${c.dim}${separator}${c.reset} ${srcColor}${c.bold}${group.length}${c.reset}`)

    const sorted = [...group].sort((a, b) => a.name.localeCompare(b.name))
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i]
      const isLast = i === sorted.length - 1
      const prefix = isLast ? '└──' : '├──'
      const desc = s.description.length > 50 ? s.description.slice(0, 47) + '...' : s.description
      const linkMark = s.isSymlink ? ` ${c.yellow}→${c.reset}` : ''
      lines.push(`  ${c.dim}${prefix}${c.reset} ${formatTreeSkillMeta(s, c)}${c.bold}${s.name}${c.reset}${linkMark}  ${c.gray}${desc}${c.reset}`)
    }
    lines.push('')
  }

  // 冲突
  if (conflicts.length > 0) {
    lines.push(`${c.yellow}${c.bold}⚠ Conflicts${c.reset} ${c.yellow}(${conflicts.length})${c.reset}`)
    for (const conflict of conflicts) {
      const activeLabel = `${c.bold}${conflict.active.source}${c.reset} (active)`
      const overriddenLabels = conflict.overridden.map(o => `${c.red}${o.source}${c.reset} (overridden)`).join(', ')
      lines.push(`  ${c.yellow}●${c.reset} ${conflict.name}  ${activeLabel} ← ${overriddenLabels}`)
    }
  }

  return lines.join('\n') + '\n'
}
