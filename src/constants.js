import { join } from 'node:path'

export const OFFICIAL_MARKETPLACES = new Set([
  'claude-plugins-official',
  'omc',
  'superpowers-marketplace',
])

// 来源分类（用于冲突排序：索引越小优先级越高）
export const SOURCE_PRIORITY = {
  '项目': 0,
  '自建': 1,
  '官方插件': 2,
  '社区插件': 3,
  '三方(agents)': 4,
  '三方': 4,
  '团队': 5,
  '未知': 6,
}

/**
 * 根据主目录和项目根目录计算所有路径常量
 * 不读取 process.cwd() 或 homedir()，便于测试注入
 */
export function getPaths(homeDir, projectRoot) {
  return {
    homeDir,
    projectRoot,
    globalSkillsDir: join(homeDir, '.claude', 'skills'),
    projectSkillsDir: join(projectRoot, '.claude', 'skills'),
    pluginsDir: join(homeDir, '.claude', 'plugins'),
    installedPluginsJson: join(homeDir, '.claude', 'plugins', 'installed_plugins.json'),
    pluginCacheDir: join(homeDir, '.claude', 'plugins', 'cache'),
  }
}
