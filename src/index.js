import { homedir } from 'node:os'
import { cwd } from 'node:process'
import * as nativeFs from 'node:fs'
import { getPaths } from './constants.js'
import { loadPluginRegistry } from './plugin-registry.js'
import { scanSkillsDir } from './scanner.js'
import { scanPluginCacheSkills } from './plugin-cache-scanner.js'
import { detectConflicts } from './conflict-detector.js'
import { generateMarkdownReport, generateJsonReport } from './reporter.js'

export { parseFrontmatter } from './parser.js'
export { loadPluginRegistry } from './plugin-registry.js'
export { scanSkillsDir, inferSource } from './scanner.js'
export { scanPluginCacheSkills } from './plugin-cache-scanner.js'
export { detectConflicts } from './conflict-detector.js'
export { generateMarkdownReport, generateJsonReport, generateTreeReport } from './reporter.js'
export { getPaths, OFFICIAL_AUTHOR, PLUGIN_MANIFEST_PATH, SOURCE_ORDER, SOURCE_PRIORITY } from './constants.js'

/**
 * 便捷函数：运行完整扫描流程
 * @param {object} options
 * @param {string} [options.homeDir] - 主目录
 * @param {string} [options.projectRoot] - 项目根目录
 * @param {object} [options.fs] - 文件系统接口
 * @returns {{ skills: Array, conflicts: Array, paths: object }}
 */
export function scan({ homeDir = homedir(), projectRoot = cwd(), fs = nativeFs } = {}) {
  const paths = getPaths(homeDir, projectRoot)
  const pluginRegistry = loadPluginRegistry(paths, fs)

  // 先扫描插件缓存，填充 registry（含 isOfficial 信息）
  const pluginCacheSkills = scanPluginCacheSkills(paths, pluginRegistry, fs)

  // 再扫描全局/项目目录，此时 registry 已完整
  const allSkills = [
    ...scanSkillsDir(paths.globalSkillsDir, '全局级', pluginRegistry, paths, fs),
    ...scanSkillsDir(paths.projectSkillsDir, '项目级', pluginRegistry, paths, fs),
  ]

  // 合并缓存中未被全局/项目目录覆盖的 skill
  const existingNames = new Set(allSkills.map(s => s.name.toLowerCase()))
  allSkills.push(...pluginCacheSkills.filter(s => !existingNames.has(s.name.toLowerCase())))

  const conflicts = detectConflicts(allSkills)

  return { skills: allSkills, conflicts, paths }
}
