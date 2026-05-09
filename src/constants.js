import { join } from 'node:path'

// 判断官方的标准：plugin.json 中 author.name 包含此值
export const OFFICIAL_AUTHOR = 'Anthropic'

// plugin.json 相对路径
export const PLUGIN_MANIFEST_PATH = join('.claude-plugin', 'plugin.json')

// 来源大类排序（社区子类如 社区(omc) 动态插入"官方"之后）
export const SOURCE_ORDER = ['官方', '社区', '自建', '其他']

// ANSI 颜色常量
export const RESET = '\x1b[0m'
export const BOLD = '\x1b[1m'
export const DIM = '\x1b[2m'
export const RED = '\x1b[31m'
export const YELLOW = '\x1b[33m'
export const GRAY = '\x1b[90m'

// 来源对应的 ANSI 颜色（社区子类继承"社区"颜色）
export const SOURCE_COLORS = {
  '官方': '\x1b[36m',     // 青色
  '社区': '\x1b[34m',     // 蓝色
  '自建': '\x1b[32m',     // 绿色
  '其他': '\x1b[90m',     // 灰色
}

// 来源分类（用于冲突排序：索引越小优先级越高，社区子类共享"社区"优先级）
export const SOURCE_PRIORITY = {
  '自建': 0,
  '官方': 1,
  '社区': 2,
  '其他': 3,
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
