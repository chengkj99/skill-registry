/**
 * 比较插件缓存目录下的版本文件夹名（semver 风格，无运行时依赖）。
 * 用于在 readdir 结果中选取「最新」安装目录，避免字符串排序把 10.x 排在 9.x 之前等问题。
 *
 * 限制：仅比较「主版本号」数字段（`-` 后的预发布标签会被丢弃），故 `1.0.0-beta` 与 `1.0.0`
 * 视为相等；若缓存目录名从不含此类后缀，可忽略。
 */

/**
 * 取 semver 主版本号段（忽略 build/metadata，+ 号后丢弃常见 npm 目录名无此情况）
 * @param {string} id
 * @returns {string[]}
 */
function coreSegments(id) {
  const s = String(id).trim().replace(/^v/i, '')
  const core = s.split('+')[0].split('-')[0]
  return core === '' ? [] : core.split('.')
}

/**
 * @param {string} seg
 * @returns {{ kind: 'num', n: number } | { kind: 'str', s: string }}
 */
function segmentToken(seg) {
  if (seg === undefined || seg === '') return { kind: 'num', n: 0 }
  const n = Number.parseInt(seg, 10)
  if (seg === String(n) && !Number.isNaN(n)) return { kind: 'num', n }
  return { kind: 'str', s: seg }
}

/**
 * 语义化比较两个版本标识符（仅主版本数值段优先，其余按字符串）
 * @param {string} a
 * @param {string} b
 * @returns {number} 负数 a<b，0 相等，正数 a>b
 */
export function compareSemverLike(a, b) {
  const sa = coreSegments(a)
  const sb = coreSegments(b)
  const len = Math.max(sa.length, sb.length)
  for (let i = 0; i < len; i++) {
    const ta = segmentToken(sa[i])
    const tb = segmentToken(sb[i])
    if (ta.kind === 'num' && tb.kind === 'num') {
      if (ta.n !== tb.n) return ta.n - tb.n
      continue
    }
    const stra = ta.kind === 'num' ? String(ta.n) : ta.s
    const strb = tb.kind === 'num' ? String(tb.n) : tb.s
    if (stra < strb) return -1
    if (stra > strb) return 1
  }
  return 0
}

/**
 * 按从新到旧排序用的比较函数（传给 Array.prototype.sort）
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareSemverLikeDesc(a, b) {
  return compareSemverLike(b, a)
}
