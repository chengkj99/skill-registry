import { join } from 'node:path'
import { parseFrontmatter } from './parser.js'
import { OFFICIAL_AUTHOR, PLUGIN_MANIFEST_PATH } from './constants.js'
import { compareSemverLikeDesc } from './version-compare.js'

/**
 * 读取插件 manifest 中的 author.name 判断是否 Anthropic 官方
 */
function isOfficialPlugin(installPath, fs) {
  const manifestPath = join(installPath, PLUGIN_MANIFEST_PATH)
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8')
    const manifest = JSON.parse(raw)
    return manifest?.author?.name === OFFICIAL_AUTHOR
  } catch {
    return false
  }
}

/**
 * 从插件缓存目录发现所有 skill（补充 registry 未覆盖的版本）
 * @param {object} paths - 路径对象
 * @param {Map} pluginRegistry - 插件注册表（会被就地补充）
 * @param {object} fs - 文件系统操作接口
 */
export function scanPluginCacheSkills(paths, pluginRegistry, fs) {
  const cacheDir = paths.pluginCacheDir
  if (!fs.existsSync(cacheDir)) return []

  const skills = []
  const entries = fs.readdirSync(cacheDir)

  for (const marketplace of entries) {
    const marketplacePath = join(cacheDir, marketplace)
    if (!fs.lstatSync(marketplacePath).isDirectory()) continue

    const pluginDirs = fs.readdirSync(marketplacePath)
    for (const pluginDir of pluginDirs) {
      const pluginPath = join(marketplacePath, pluginDir)
      if (!fs.lstatSync(pluginPath).isDirectory()) continue

      // 找最新版本（semver 风格比较，避免 "10.0.0" 字符串序小于 "9.0.0"）
      const versions = fs
        .readdirSync(pluginPath)
        .filter((v) => {
          try {
            return fs.lstatSync(join(pluginPath, v)).isDirectory()
          } catch {
            return false
          }
        })
        .sort(compareSemverLikeDesc)
      if (versions.length === 0) continue
      const latestVersionPath = join(pluginPath, versions[0])

      // 检查 skills/ 和 agents/ 目录
      for (const subDir of ['skills', 'agents']) {
        const skillsDir = join(latestVersionPath, subDir)
        if (!fs.existsSync(skillsDir)) continue

        try {
          const skillEntries = fs.readdirSync(skillsDir)
          for (const skillEntry of skillEntries) {
            const skillPath = join(skillsDir, skillEntry)
            try {
              const st = fs.lstatSync(skillPath)
              if (!st.isDirectory()) continue
            } catch { continue }

            const skillMdPath = join(skillPath, 'SKILL.md')
            let frontmatter = {}
            if (fs.existsSync(skillMdPath)) {
              try { frontmatter = parseFrontmatter(fs.readFileSync(skillMdPath, 'utf8')) } catch {}
            }

            const skillName = frontmatter.name || skillEntry
            const official = isOfficialPlugin(latestVersionPath, fs)

            skills.push({
              name: skillName,
              description: frontmatter.description || '',
              version: frontmatter.version || versions[0],
              source: official ? '官方' : `社区(${pluginDir})`,
              scope: '全局级',
              path: skillPath,
              isSymlink: false,
              symlinkTarget: null,
              hasSkillMd: fs.existsSync(skillMdPath),
              marketplace,
              plugin: pluginDir,
            })

            // 也注册到 registry
            pluginRegistry.set(skillName, {
              marketplace,
              plugin: pluginDir,
              version: versions[0],
              installPath: latestVersionPath,
              skillPath,
              isOfficial: official,
            })
          }
        } catch { continue }
      }
    }
  }

  return skills
}
