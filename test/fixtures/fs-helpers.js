import { join, resolve, dirname, basename } from 'node:path'

/**
 * 基于 fileTree 的 fake 文件系统
 * fileTree 格式: { '/absolute/path': 'content' | null }
 *   - 字符串值 = 文件内容
 *   - null = 目录标记
 */
export function createFakeFs(fileTree) {
  // 收集所有目录路径
  const dirs = new Set()
  for (const p of Object.keys(fileTree)) {
    let cur = p
    while (cur !== '/') {
      dirs.add(cur)
      cur = dirname(cur)
    }
  }

  // 构建每个目录的直接子项映射
  const childrenOf = new Map()
  for (const p of Object.keys(fileTree)) {
    const parent = dirname(p)
    if (!childrenOf.has(parent)) childrenOf.set(parent, [])
    childrenOf.get(parent).push(basename(p))
  }
  for (const d of dirs) {
    const parent = dirname(d)
    if (!childrenOf.has(parent)) childrenOf.set(parent, [])
    if (!childrenOf.get(parent).includes(basename(d))) {
      childrenOf.get(parent).push(basename(d))
    }
  }

  return {
    existsSync(path) {
      const p = String(path)
      return fileTree.hasOwnProperty(p) || dirs.has(p)
    },

    readFileSync(path, encoding) {
      const p = String(path)
      if (!fileTree.hasOwnProperty(p)) {
        const err = new Error(`ENOENT: no such file '${p}'`)
        err.code = 'ENOENT'
        throw err
      }
      return fileTree[p] ?? ''
    },

    readdirSync(path) {
      const p = String(path)
      const children = childrenOf.get(p)
      if (!children) {
        const err = new Error(`ENOENT: no such directory '${p}'`)
        err.code = 'ENOENT'
        throw err
      }
      return [...children]
    },

    lstatSync(path) {
      const p = String(path)
      const entry = fileTree[p]
      const isFile = fileTree.hasOwnProperty(p) && entry !== null
      const isDir = dirs.has(p) && !isFile
      const isSymlink = p.includes('__symlink__')

      return {
        isFile: () => isFile && !isSymlink,
        isDirectory: () => isDir && !isSymlink,
        isSymbolicLink: () => isSymlink,
      }
    },

    realpathSync(path) {
      const p = String(path)
      // 如果路径含 __symlink__，返回 fileTree 中的值作为目标
      if (fileTree.hasOwnProperty(p) && fileTree[p] !== null) {
        return fileTree[p]
      }
      return p
    },

    writeFileSync(path, content) {
      fileTree[String(path)] = content
    },
  }
}
