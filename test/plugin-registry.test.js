import { describe, it, expect } from 'vitest'
import { loadPluginRegistry } from '../src/plugin-registry.js'
import { getPaths } from '../src/constants.js'
import { createFakeFs } from './fixtures/fs-helpers.js'

const homeDir = '/home/user'
const projectRoot = '/home/user/project'
const paths = getPaths(homeDir, projectRoot)

describe('loadPluginRegistry', () => {
  it('installed_plugins.json 不存在时返回空 Map', () => {
    const fs = createFakeFs({})
    const registry = loadPluginRegistry(paths, fs)
    expect(registry.size).toBe(0)
  })

  it('JSON 格式无效时返回空 Map', () => {
    const fs = createFakeFs({
      [paths.installedPluginsJson]: 'not valid json',
    })
    const registry = loadPluginRegistry(paths, fs)
    expect(registry.size).toBe(0)
  })

  it('解析有效的 installed_plugins.json', () => {
    const installPath = '/home/user/.claude/plugins/cache/omc/test-plugin/1.0.0'
    const skillMdContent = '---\nname: my-skill\ndescription: Test\n---\nBody'
    const fs = createFakeFs({
      [paths.installedPluginsJson]: JSON.stringify({
        plugins: {
          'test-plugin@omc': [{
            version: '1.0.0',
            installPath,
          }],
        },
      }),
      [`${installPath}/skills/my-skill/SKILL.md`]: skillMdContent,
      [`${installPath}/skills/my-skill`]: null,
    })
    const registry = loadPluginRegistry(paths, fs)
    expect(registry.get('my-skill')).toEqual({
      marketplace: 'omc',
      plugin: 'test-plugin',
      version: '1.0.0',
      installPath,
      skillPath: `${installPath}/skills/my-skill`,
    })
    // 目录名也应注册
    expect(registry.get('my-skill')).toBeTruthy()
  })

  it('扫描 agents/ 目录（OMC 格式）', () => {
    const installPath = '/home/user/.claude/plugins/cache/omc/omc-plugin/4.11.5'
    const fs = createFakeFs({
      [paths.installedPluginsJson]: JSON.stringify({
        plugins: {
          'omc-plugin@omc': [{
            version: '4.11.5',
            installPath,
          }],
        },
      }),
      [`${installPath}/agents/autopilot/SKILL.md`]: '---\nname: autopilot\ndescription: Auto mode\n---',
      [`${installPath}/agents/autopilot`]: null,
    })
    const registry = loadPluginRegistry(paths, fs)
    expect(registry.get('autopilot')).toBeTruthy()
  })

  it('跳过没有 installPath 的安装记录', () => {
    const fs = createFakeFs({
      [paths.installedPluginsJson]: JSON.stringify({
        plugins: {
          'bad@omc': [{ version: '1.0.0' }],
        },
      }),
    })
    const registry = loadPluginRegistry(paths, fs)
    expect(registry.size).toBe(0)
  })
})
