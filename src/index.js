import { homedir } from 'node:os'
import { cwd } from 'node:process'
import * as nativeFs from 'node:fs'
import { getPaths } from './constants.js'
import { loadPluginRegistry } from './plugin-registry.js'
import { scanSkillsDir } from './scanner.js'
import { scanPluginCacheSkills } from './plugin-cache-scanner.js'
import { detectConflicts } from './conflict-detector.js'
import { generateMarkdownReport, generateJsonReport } from './reporter.js'
import { analyzeSkillUsage, parseSince } from './usage-analyzer.js'
import { enrichSkills } from './skill-enricher.js'

export { parseFrontmatter } from './parser.js'
export { loadPluginRegistry } from './plugin-registry.js'
export { scanSkillsDir, inferSource } from './scanner.js'
export { scanPluginCacheSkills } from './plugin-cache-scanner.js'
export { detectConflicts } from './conflict-detector.js'
export { generateMarkdownReport, generateJsonReport, generateTreeReport } from './reporter.js'
export { getPaths, OFFICIAL_AUTHOR, PLUGIN_MANIFEST_PATH, SOURCE_ORDER, SOURCE_PRIORITY } from './constants.js'
export { analyzeSkillUsage, parseSince, summarizeUsage } from './usage-analyzer.js'
export { enrichSkills, generateInsights } from './skill-enricher.js'
export {
  toChineseSummary,
  inferCategory,
  formatRelativeTime,
  usageHeatLevel,
  heatStars,
  hasChinese,
} from './description-zh.js'

/**
 * 便捷函数：运行完整扫描流程
 * @param {object} options
 * @param {string} [options.homeDir] - 主目录
 * @param {string} [options.projectRoot] - 项目根目录
 * @param {object} [options.fs] - 文件系统接口
 * @param {string|null} [options.since] - 调用统计窗口，如 30d / 7d
 * @param {boolean} [options.noUsage] - 跳过调用统计
 * @returns {{ skills: Array, enrichedSkills: Array, conflicts: Array, paths: object, usage: Map, usageWindow: string }}
 */
export function scan({ homeDir = homedir(), projectRoot = cwd(), fs = nativeFs, since = '30d', noUsage = false } = {}) {
  const paths = getPaths(homeDir, projectRoot)
  const pluginRegistry = loadPluginRegistry(paths, fs)

  const pluginCacheSkills = scanPluginCacheSkills(paths, pluginRegistry, fs)

  const allSkills = [
    ...scanSkillsDir(paths.globalSkillsDir, '全局级', pluginRegistry, paths, fs),
    ...scanSkillsDir(paths.projectSkillsDir, '项目级', pluginRegistry, paths, fs),
  ]

  const existingNames = new Set(allSkills.map(s => s.name.toLowerCase()))
  allSkills.push(...pluginCacheSkills.filter(s => !existingNames.has(s.name.toLowerCase())))

  const conflicts = detectConflicts(allSkills)

  let usage = new Map()
  let usageWindow = '未统计'
  if (!noUsage) {
    const sinceDate = since ? parseSince(since) : parseSince('30d')
    usage = analyzeSkillUsage({
      homeDir,
      fs,
      projectsDir: paths.projectsDir,
      cursorProjectsDir: paths.cursorProjectsDir,
      since: sinceDate,
    })
    usageWindow = since || '30d'
  }

  const enrichedSkills = enrichSkills(allSkills, usage, { fs })

  return { skills: allSkills, enrichedSkills, conflicts, paths, usage, usageWindow }
}
