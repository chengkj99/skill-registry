import { resolve } from 'node:path'
import { homedir } from 'node:os'
import * as nativeFs from 'node:fs'
import { scan } from './index.js'
import { generateMarkdownReport, generateJsonReport, generateTreeReport } from './reporter.js'

function printHelp() {
  console.log(`skill-registry — Skills 清单扫描与来源分类

用法:
  skill-registry [选项]

选项:
  --project <path>   指定项目路径（默认当前目录）
  --tree             终端彩色树形输出（默认）
  --md               Markdown 格式输出
  --json             JSON 格式输出
  --output <file>    输出到文件
  -h, --help         显示帮助
`)
}

/**
 * CLI 主入口
 * @param {string[]} argv - 命令行参数
 * @param {object} options - 注入选项（测试用）
 * @returns {number} 退出码
 */
export function run(argv, options = {}) {
  const cwd = options.cwd || process.cwd()
  const home = options.homedir || homedir()
  const fs = options.fs || nativeFs
  const log = options.console || console

  // 参数解析
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project' && argv[i + 1]) opts.project = resolve(cwd, argv[++i])
    else if (argv[i] === '--json') opts.json = true
    else if (argv[i] === '--md') opts.md = true
    else if (argv[i] === '--tree') opts.tree = true
    else if (argv[i] === '--output' && argv[i + 1]) opts.output = resolve(cwd, argv[++i])
    else if (argv[i] === '--help' || argv[i] === '-h') { printHelp(); return 0 }
  }

  const projectRoot = opts.project || cwd

  try {
    // 与 programmatic API `scan()` 共用同一管线（先插件缓存填充 registry，再扫目录）
    const { skills: allSkills, conflicts } = scan({ homeDir: home, projectRoot, fs })

    // 2. 输出 — 优先级: --json > --md > --tree(默认)
    if (opts.json) {
      const result = generateJsonReport(allSkills, conflicts, home, projectRoot)
      const json = JSON.stringify(result, null, 2)
      if (opts.output) {
        fs.writeFileSync(opts.output, json, 'utf8')
        log.log(`JSON 报告已写入：${opts.output}`)
      } else {
        log.log(json)
      }
    } else if (opts.md) {
      const md = generateMarkdownReport(allSkills, conflicts, home, projectRoot)
      if (opts.output) {
        fs.writeFileSync(opts.output, md, 'utf8')
        log.log(`Markdown 报告已写入：${opts.output}`)
      } else {
        log.log(md)
      }
    } else {
      // 默认：tree 模式，写文件时去色
      const noColor = !!opts.output
      const tree = generateTreeReport(allSkills, conflicts, home, projectRoot, { noColor })
      if (opts.output) {
        fs.writeFileSync(opts.output, tree, 'utf8')
        log.log(`报告已写入：${opts.output}`)
      } else {
        log.log(tree)
      }
    }

    return 0
  } catch (err) {
    log.error('扫描失败：', err.message)
    return 1
  }
}
