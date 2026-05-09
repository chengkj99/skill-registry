/**
 * 解析 SKILL.md 的 YAML frontmatter
 * 仅支持扁平 key: value 格式，不处理嵌套
 */
export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const fm = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    // 去掉引号包裹
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    fm[key] = val
  }
  return fm
}
