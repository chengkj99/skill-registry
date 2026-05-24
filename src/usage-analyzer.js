import { join } from 'node:path'

/**
 * 解析 --since 参数
 * @param {string|null} since - ISO 日期或 7d / 24h
 */
export function parseSince(since) {
  if (!since) return null
  const m = /^(\d+)([dhm])$/.exec(String(since).trim())
  if (m) {
    const n = parseInt(m[1], 10)
    const unitMs = { d: 86400000, h: 3600000, m: 60000 }
    return new Date(Date.now() - n * (unitMs[m[2]] || 86400000))
  }
  const d = new Date(since)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * 递归收集目录下所有 .jsonl 文件
 */
function collectJsonlFiles(dir, fs, out = []) {
  if (!fs.existsSync(dir)) return out
  let entries
  try { entries = fs.readdirSync(dir) } catch { return out }

  for (const entry of entries) {
    const full = join(dir, entry)
    let stat
    try { stat = fs.lstatSync(full) } catch { continue }
    if (stat.isDirectory()) {
      collectJsonlFiles(full, fs, out)
    } else if (entry.endsWith('.jsonl')) {
      out.push(full)
    }
  }
  return out
}

/**
 * 收集 Claude Code + Cursor 会话 transcript 路径
 */
export function getTranscriptRoots(homeDir, options = {}) {
  const roots = []
  const claudeDir = options.projectsDir || join(homeDir, '.claude', 'projects')
  const cursorDir = options.cursorProjectsDir || join(homeDir, '.cursor', 'projects')
  if (claudeDir) roots.push(claudeDir)
  if (cursorDir) roots.push(cursorDir)
  return roots
}

/**
 * 从 entry 中提取所有文本块
 */
function collectTextBlocks(entry) {
  const texts = []
  const content = entry?.message?.content
  if (typeof content === 'string') {
    texts.push(content)
    return texts
  }
  if (!Array.isArray(content)) return texts
  for (const block of content) {
    if (block?.type === 'text' && block.text) texts.push(block.text)
    if (typeof block === 'string') texts.push(block)
  }
  return texts
}

/**
 * 从用户消息中的 manually_attached_skills 块提取 skill 名
 */
function extractAttachedSkillNames(text) {
  if (!text || !text.includes('Skill Name:')) return []
  const names = []
  for (const m of text.matchAll(/^Skill Name:\s*(.+)$/gm)) {
    const name = m[1]?.trim()
    if (name) names.push(name)
  }
  return names
}

/**
 * 从 slash command 提取 skill 名（如 /brainstorming）
 */
function extractSlashSkillNames(text) {
  if (!text) return []
  const names = []
  for (const m of text.matchAll(/(?:^|\n)\/([a-z][a-z0-9-]*)\b/gi)) {
    names.push(m[1])
  }
  return names
}

/**
 * 从单条 transcript entry 提取 skill 调用
 * 支持：
 * - Claude Code: type=assistant + Skill tool_use
 * - Cursor: role=assistant + Skill tool_use
 * - Cursor/Claude: user 消息中的 manually_attached_skills（/skill 命令）
 */
export function extractSkillInvocations(entry) {
  const names = []
  const isAssistant = entry?.type === 'assistant' || entry?.role === 'assistant'
  const isUser = entry?.type === 'user' || entry?.role === 'user'

  if (isAssistant) {
    const content = entry.message?.content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'tool_use' && block.name === 'Skill' && block.input?.skill) {
          names.push(String(block.input.skill))
        }
      }
    }
  }

  if (isUser) {
    for (const text of collectTextBlocks(entry)) {
      if (text.includes('<manually_attached_skills>') || text.includes('Skill Name:')) {
        names.push(...extractAttachedSkillNames(text))
      } else {
        names.push(...extractSlashSkillNames(text))
      }
    }
  }

  return names
}

/**
 * 从 transcript 文件路径推断 sessionId
 */
function sessionIdFromPath(filePath) {
  const m = filePath.match(/agent-transcripts\/([0-9a-f-]{36})\//i)
    || filePath.match(/\/([0-9a-f-]{36})\.jsonl$/i)
  return m?.[1] || null
}

/**
 * 扫描 Claude Code / Cursor 会话 transcript，统计 skill 调用频次
 */
export function analyzeSkillUsage({ homeDir, fs, projectsDir, cursorProjectsDir, since = null }) {
  const roots = getTranscriptRoots(homeDir, { projectsDir, cursorProjectsDir })
  const files = roots.flatMap(root => collectJsonlFiles(root, fs))
  const stats = new Map()
  const sinceMs = since ? since.getTime() : null

  for (const filePath of files) {
    let content
    try { content = fs.readFileSync(filePath, 'utf8') } catch { continue }

    let fileMtime = null
    try { fileMtime = fs.statSync(filePath).mtime.toISOString() } catch {}

    const defaultSessionId = sessionIdFromPath(filePath)

    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      let entry
      try { entry = JSON.parse(line) } catch { continue }

      const iso = entry.timestamp || fileMtime
      const ts = iso ? Date.parse(iso) : null
      if (sinceMs && ts && ts < sinceMs) continue

      const sessionId = entry.sessionId || defaultSessionId
      const skills = extractSkillInvocations(entry)
      if (skills.length === 0) continue

      for (const rawName of skills) {
        const key = rawName.toLowerCase()
        if (!stats.has(key)) {
          stats.set(key, {
            name: rawName,
            count: 0,
            lastUsed: null,
            firstUsed: null,
            sessionIds: new Set(),
          })
        }
        const s = stats.get(key)
        s.count++
        if (sessionId) s.sessionIds.add(sessionId)
        if (iso) {
          if (!s.lastUsed || iso > s.lastUsed) s.lastUsed = iso
          if (!s.firstUsed || iso < s.firstUsed) s.firstUsed = iso
        }
      }
    }
  }

  const result = new Map()
  for (const [key, s] of stats) {
    result.set(key, {
      name: s.name,
      count: s.count,
      lastUsed: s.lastUsed,
      firstUsed: s.firstUsed,
      sessions: s.sessionIds.size,
    })
  }
  return result
}

/**
 * 获取 usage 统计摘要
 */
export function summarizeUsage(usageMap) {
  const entries = [...usageMap.values()]
  const totalInvocations = entries.reduce((n, e) => n + e.count, 0)
  const activeSkills = entries.length
  const maxCount = entries.reduce((m, e) => Math.max(m, e.count), 0)
  return { totalInvocations, activeSkills, maxCount }
}
