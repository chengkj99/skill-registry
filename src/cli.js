import { resolve } from 'node:path'
import { homedir } from 'node:os'
import * as nativeFs from 'node:fs'
import { scan } from './index.js'
import { generateMarkdownReport, generateJsonReport, generateTreeReport } from './reporter.js'

function printHelp() {
  console.log(`skill-registry — Skills 清单扫描、来源分类与健康仪表盘

用法:
  skill-registry [选项]

选项:
  --project <path>   指定项目路径（默认当前目录）
  --tree             终端彩色仪表盘输出（默认）
  --md               Markdown 格式输出
  --json             JSON 格式输出
  --output <file>    输出到文件
  --since <窗口>     调用统计时间窗口（默认 30d，如 7d / 90d / all）
  --no-usage         跳过会话调用统计（更快）
  --sort <字段>      组内排序：usage（默认）| name
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

  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project' && argv[i + 1]) opts.project = resolve(cwd, argv[++i])
    else if (argv[i] === '--json') opts.json = true
    else if (argv[i] === '--md') opts.md = true
    else if (argv[i] === '--tree') opts.tree = true
    else if (argv[i] === '--output' && argv[i + 1]) opts.output = resolve(cwd, argv[++i])
    else if (argv[i] === '--since' && argv[i + 1]) opts.since = argv[++i]
    else if (argv[i] === '--no-usage') opts.noUsage = true
    else if (argv[i] === '--sort' && argv[i + 1]) opts.sort = argv[++i]
    else if (argv[i] === '--help' || argv[i] === '-h') { printHelp(); return 0 }
  }

  const projectRoot = opts.project || cwd
  const since = opts.since === 'all' ? null : (opts.since || '30d')

  try {
    const { skills, enrichedSkills, conflicts, usageWindow } = scan({
      homeDir: home,
      projectRoot,
      fs,
      since: opts.noUsage ? null : since,
      noUsage: !!opts.noUsage,
    })

    const reportOpts = {
      enrichedSkills,
      usageWindow: opts.noUsage ? '未统计' : (since || '全部'),
      sortBy: opts.sort || 'usage',
    }

    if (opts.json) {
      const result = generateJsonReport(skills, conflicts, home, projectRoot, reportOpts)
      const json = JSON.stringify(result, null, 2)
      if (opts.output) {
        fs.writeFileSync(opts.output, json, 'utf8')
        log.log(`JSON 报告已写入：${opts.output}`)
      } else {
        log.log(json)
      }
    } else if (opts.md) {
      const md = generateMarkdownReport(skills, conflicts, home, projectRoot, reportOpts)
      if (opts.output) {
        fs.writeFileSync(opts.output, md, 'utf8')
        log.log(`Markdown 报告已写入：${opts.output}`)
      } else {
        log.log(md)
      }
    } else {
      const noColor = !!opts.output
      const tree = generateTreeReport(skills, conflicts, home, projectRoot, { ...reportOpts, noColor })
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
