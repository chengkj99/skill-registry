import { join } from 'node:path'
import { parseFrontmatter } from './parser.js'

/**
 * 读取 installed_plugins.json，构建 skill 名 → { marketplace, plugin, version, installPath, skillPath } 映射
 * @param {object} paths - getPaths() 返回的路径对象
 * @param {object} fs - 文件系统操作接口
 */
export function loadPluginRegistry(paths, fs) {
  const registry = new Map()

  if (!fs.existsSync(paths.installedPluginsJson)) return registry

  let data
  try {
    data = JSON.parse(fs.readFileSync(paths.installedPluginsJson, 'utf8'))
  } catch { return registry }

  const plugins = data?.plugins
  if (!plugins || typeof plugins !== 'object') return registry

  for (const [pluginKey, installs] of Object.entries(plugins)) {
    const atIdx = pluginKey.lastIndexOf('@')
    const pluginName = atIdx > 0 ? pluginKey.slice(0, atIdx) : pluginKey
    const marketplace = atIdx > 0 ? pluginKey.slice(atIdx + 1) : 'unknown'

    if (!Array.isArray(installs)) continue

    for (const inst of installs) {
      if (!inst.installPath) continue

      for (const subDir of ['skills', 'agents']) {
        const skillsDir = join(inst.installPath, subDir)
        if (!fs.existsSync(skillsDir)) continue

        try {
          const entries = fs.readdirSync(skillsDir)
          for (const entry of entries) {
            const skillPath = join(skillsDir, entry)
            try {
              const st = fs.lstatSync(skillPath)
              if (!st.isDirectory()) continue
            } catch { continue }

            const skillMdPath = join(skillPath, 'SKILL.md')
            let skillName = entry
            if (fs.existsSync(skillMdPath)) {
              try {
                const fm = parseFrontmatter(fs.readFileSync(skillMdPath, 'utf8'))
                if (fm.name) skillName = fm.name
              } catch {}
            }

            const entry2 = {
              marketplace,
              plugin: pluginName,
              version: inst.version || '',
              installPath: inst.installPath,
              skillPath,
            }
            registry.set(skillName, entry2)
            registry.set(entry, entry2)
          }
        } catch { continue }
      }
    }
  }

  return registry
}
