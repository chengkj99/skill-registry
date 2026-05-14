import { join, basename } from 'node:path'
import { parseFrontmatter } from './parser.js'
import { OFFICIAL_AUTHOR, PLUGIN_MANIFEST_PATH } from './constants.js'

/**
 * 根据插件注册表条目判断来源标签
 * 官方(author=Anthropic) → '官方'，社区 → '社区(插件名)'
 */
function classifyByRegEntry(regEntry) {
  if (regEntry?.isOfficial) return '官方'
  if (regEntry?.plugin) return `社区(${regEntry.plugin})`
  return '自建'
}

/**
 * 从插件缓存路径推断来源
 * 读取 plugin.json 判断官方/社区
 */
function classifyCachePath(skillPath, paths, fs) {
  const cachePrefix = join(paths.homeDir, '.claude', 'plugins', 'cache') + '/'
  if (!skillPath.startsWith(cachePrefix)) return null

  const relPath = skillPath.slice(cachePrefix.length)
  // cache/<marketplace>/<plugin>/<version>/skills/<skill> 或 agents/<skill>
  const parts = relPath.split('/')
  if (parts.length < 5) return null

  const [, pluginDir, version] = parts
  const installPath = join(cachePrefix, parts[0], pluginDir, version)

  try {
    const manifestPath = join(installPath, PLUGIN_MANIFEST_PATH)
    const raw = fs.readFileSync(manifestPath, 'utf8')
    const manifest = JSON.parse(raw)
    if (manifest?.author?.name === OFFICIAL_AUTHOR) return '官方'
  } catch {}
  return `社区(${pluginDir})`
}

/**
 * 推断 skill 来源（4 类：官方 / 社区 / 自建 / 其他）
 * @param {object} [lookup] - 目录扫描侧提供的补充键（避免仅用 basename 漏匹配 registry）
 * @param {string} [lookup.entryName] - skills 目录下条目名（文件夹名），默认取 skillPath 的 basename
 * @param {string} [lookup.fmName] - SKILL.md frontmatter 中的 name，可选
 */
export function inferSource(skillPath, isSymlink, symlinkTarget, pluginRegistry, paths, fs, lookup = {}) {
  const entryName = lookup.entryName ?? basename(skillPath)
  const fmName = (lookup.fmName || '').trim()

  // 1. 软链指向 .agents/skills → 社区(agents)
  if (isSymlink && symlinkTarget && symlinkTarget.includes('.agents/skills')) return '社区(agents)'

  // 2. 项目目录下 → 自建
  if (skillPath.startsWith(paths.projectSkillsDir)) return '自建'

  // 3. 软链目标在插件缓存内 → 按安装目录 manifest 判断（全局 skills 常见为链向 cache）
  if (isSymlink && symlinkTarget) {
    const viaTarget = classifyCachePath(symlinkTarget, paths, fs)
    if (viaTarget) return viaTarget
  }

  // 4. 插件缓存路径 → 读 plugin.json 判断
  if (skillPath.includes(join('.claude', 'plugins', 'cache'))) {
    const cacheResult = classifyCachePath(skillPath, paths, fs)
    if (cacheResult) return cacheResult
  }

  // 5. 全局 skills/ 目录 → 目录名与 frontmatter.name 双键交叉比对插件注册表
  if (skillPath.startsWith(paths.globalSkillsDir)) {
    let regEntry = pluginRegistry.get(entryName)
    if (!regEntry && fmName) regEntry = pluginRegistry.get(fmName)
    if (regEntry) return classifyByRegEntry(regEntry)
    return '自建'
  }

  return '其他'
}

/**
 * 扫描单个目录下的所有 skill
 * @param {string} dir - 要扫描的目录
 * @param {string} scope - 作用域（'全局级' 或 '项目级'）
 * @param {Map} pluginRegistry - 插件注册表
 * @param {object} paths - 路径对象
 * @param {object} fs - 文件系统操作接口
 */
export function scanSkillsDir(dir, scope, pluginRegistry, paths, fs) {
  if (!fs.existsSync(dir)) return []

  const entries = fs.readdirSync(dir)
  const skills = []

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    let stat
    try { stat = fs.lstatSync(fullPath) } catch { continue }

    // 跳过非目录（.zip 等文件）和隐藏目录
    if (stat.isFile() && !entry.endsWith('.md')) continue
    if (entry.startsWith('.')) continue

    const isSymlink = stat.isSymbolicLink()
    let symlinkTarget = null

    if (isSymlink) {
      try { symlinkTarget = fs.realpathSync(fullPath) } catch { symlinkTarget = null }
    }

    // 查找 SKILL.md
    const skillMdPath = join(fullPath, 'SKILL.md')
    let frontmatter = {}
    let hasSkillMd = false

    if (fs.existsSync(skillMdPath)) {
      hasSkillMd = true
      try {
        const content = fs.readFileSync(skillMdPath, 'utf8')
        frontmatter = parseFrontmatter(content)
      } catch {}
    } else if (stat.isFile() && entry.endsWith('.md')) {
      // 单文件 skill（直接是 .md 文件）
      try {
        const content = fs.readFileSync(fullPath, 'utf8')
        frontmatter = parseFrontmatter(content)
      } catch {}
    }

    // 目录下的 skill
    if (stat.isDirectory() || isSymlink) {
      const source = inferSource(fullPath, isSymlink, symlinkTarget, pluginRegistry, paths, fs, {
        entryName: entry,
        fmName: frontmatter.name || '',
      })
      const skillName = frontmatter.name || entry
      const regEntry = pluginRegistry.get(skillName) || pluginRegistry.get(entry)

      skills.push({
        name: skillName,
        description: frontmatter.description || '',
        version: frontmatter.version || (regEntry?.version || ''),
        source,
        scope,
        path: fullPath,
        isSymlink,
        symlinkTarget,
        hasSkillMd,
        marketplace: regEntry?.marketplace || null,
        plugin: regEntry?.plugin || null,
      })
    }
  }

  return skills
}
