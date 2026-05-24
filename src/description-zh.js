/**
 * 技能描述中文化与分类标签（纯启发式，零依赖）
 */

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/

/** 常见英文描述前缀 → 中文 */
const PREFIX_RULES = [
  [/^(This skill should be used when (the user )?)/i, '适用场景：'],
  [/^(Use this skill when (the user )?)/i, '适用场景：'],
  [/^(Use when (the user )?)/i, '适用场景：'],
  [/^(You MUST use this before )/i, '前置必备：'],
  [/^(MANDATORY prerequisite[^—]*— )/i, '前置必备：'],
  [/^(Helps users )/i, '帮助用户'],
  [/^(Create )/i, '创建'],
  [/^(Generate )/i, '生成'],
  [/^(Configure )/i, '配置'],
  [/^(Diagnose and fix )/i, '诊断并修复'],
  [/^(Diagnose )/i, '诊断'],
  [/^(Install or refresh )/i, '安装或更新'],
  [/^(Manage local skills[^.]*\. )/i, '管理本地技能。'],
  [/^(Clean AI-generated )/i, '清理 AI 生成'],
  [/^(Orchestrate )/i, '编排'],
  [/^(Full autonomous )/i, '全自动'],
  [/^(Self-referential )/i, '自循环'],
  [/^(Evidence-driven )/i, '证据驱动'],
  [/^(Strategic planning )/i, '战略规划'],
  [/^(Process-first )/i, '流程优先'],
  [/^(Verify that )/i, '验证'],
  [/^(Audit and improve )/i, '审计并改进'],
  [/^(Analyze )/i, '分析'],
  [/^(Build or update )/i, '构建或更新'],
  [/^(Produce )/i, '产出'],
  [/^(Solve )/i, '求解'],
]

/** 关键词 → 中文分类标签 */
const CATEGORY_RULES = [
  { re: /\b(mcp|model context protocol)\b/i, tag: 'MCP 集成' },
  { re: /\b(debug|diagnos|troubleshoot)\b/i, tag: '调试诊断' },
  { re: /\b(test|qa|verify|tdd)\b/i, tag: '测试质量' },
  { re: /\b(git|commit|branch|worktree|pr|pull request)\b/i, tag: 'Git 工作流' },
  { re: /\b(brainstorm|plan|interview|spec|requirement|creative)\b/i, tag: '规划协作' },
  { re: /\b(skill|plugin|hook|command|slash)\b/i, tag: '技能生态' },
  { re: /\b(frontend|design|ui|ux|figma|d2c|d-d2c)\b/i, tag: '前端设计' },
  { re: /\b(agent|subagent|team|swarm|orchestrat)\b/i, tag: 'Agent 编排' },
  { re: /\b(security|audit|vulnerabilit)\b/i, tag: '安全审计' },
  { re: /\b(release|deploy|ci|cd)\b/i, tag: '发布部署' },
  { re: /\b(wiki|document|docs|llm-docs|markdown)\b/i, tag: '文档知识' },
  { re: /\b(session|report|monitor|hud|notification)\b/i, tag: '会话监控' },
  { re: /\b(autopilot|ralph|ultra|parallel)\b/i, tag: '自动化执行' },
  { re: /\b(interview|resume|candidate)\b/i, tag: '面试评估' },
  { re: /\b(lowcode|amis)\b/i, tag: '低代码' },
  { re: /\b(math|olympiad|proof)\b/i, tag: '数学竞赛' },
]

/**
 * 检测文本是否含中文
 */
export function hasChinese(text) {
  return CJK_RE.test(text || '')
}

/**
 * 从描述提取中文片段（若混合语言则优先中文句）
 */
function extractChineseSnippet(text) {
  const parts = (text || '').split(/(?<=[。！？；])|(?<=[.!?;]\s)/)
  const cn = parts.filter(p => hasChinese(p)).join('').trim()
  if (cn.length >= 4) return cn.replace(/\s+/g, ' ')
  const m = (text || '').match(/[\u4e00-\u9fff\u3400-\u4dbf][\u4e00-\u9fff\u3400-\u4dbf\w\s，、：；（）「」【】—\-·]{3,}/)
  return m ? m[0].trim() : ''
}

/**
 * 英文描述启发式转中文摘要
 */
export function toChineseSummary(description, skillName = '') {
  const raw = (description || '').trim()
  if (!raw) return '（暂无描述）'

  if (hasChinese(raw)) {
    const snippet = extractChineseSnippet(raw)
    return snippet || raw.slice(0, 80)
  }

  const category = inferCategory(skillName, raw)
  let core = raw

  for (const [re] of PREFIX_RULES) {
    core = core.replace(re, '')
  }
  core = core
    .replace(/^(the user (asks|wants|mentions|says|provides|is)\s+)/i, '')
    .replace(/^(when (the user )?)/i, '')
    .replace(/\.\s*$/, '')
    .trim()

  if (core.length > 48) core = core.slice(0, 45) + '…'

  return `【${category}】${core || raw.slice(0, 48)}`
}

/**
 * 推断技能分类标签
 */
export function inferCategory(skillName, description = '') {
  const hay = `${skillName} ${description}`
  for (const { re, tag } of CATEGORY_RULES) {
    if (re.test(hay)) return tag
  }
  return '通用工具'
}

/**
 * 格式化相对时间（中文）
 */
export function formatRelativeTime(isoOrMs, now = Date.now()) {
  if (!isoOrMs) return '从未调用'
  const ts = typeof isoOrMs === 'string' ? Date.parse(isoOrMs) : isoOrMs
  if (Number.isNaN(ts)) return '从未调用'

  const diff = now - ts
  if (diff < 0) return '刚刚'

  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month} 个月前`
  return `${Math.floor(month / 12)} 年前`
}

/**
 * 调用频次 → 热度星级 (0-5)
 */
export function usageHeatLevel(count, maxCount) {
  if (!count || count <= 0) return 0
  if (!maxCount || maxCount <= 0) return count >= 5 ? 3 : 1
  const ratio = count / maxCount
  if (ratio >= 0.8) return 5
  if (ratio >= 0.5) return 4
  if (ratio >= 0.25) return 3
  if (ratio >= 0.1) return 2
  return 1
}

/**
 * 热度星级 → 可视化字符串
 */
export function heatStars(level) {
  const filled = '★'.repeat(Math.min(5, Math.max(0, level)))
  const empty = '☆'.repeat(5 - filled.length)
  return filled + empty
}
