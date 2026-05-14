# skill-registry

Scan, classify, and detect conflicts in your Claude Code skills — from CLI or inside Claude Code.

## What It Does

- **Scans** all installed skills from global `~/.claude/skills/`, project `.claude/skills/`, and plugin cache under `~/.claude/plugins/cache/`
- **Classifies** each skill by source label (examples: `官方`, `社区(<plugin>)`, `社区(agents)`, `本地`, `其他`) plus **scope** (`全局级` vs `项目级`). The CLI and the `scan()` API share the same pipeline so labels stay consistent.
- **全局来源推断**：同时用 skill **目录名**与 `SKILL.md` frontmatter 中的 **`name`** 去匹配插件注册表；`~/.claude/skills/` 下指向 `~/.claude/plugins/cache/` 的软链会按对应安装目录的 `plugin.json` 判定官方或社区。指向 `~/.agents/skills/` 的软链显示为 **`社区(agents)`**。
- **Cursor / IDE note**: only paths under **`~/.claude/`** (as above) are scanned. If your Cursor + Claude Code setup shares that directory with Claude Code, those skills are included; this package does **not** read Cursor-specific paths outside `~/.claude/`.
- **Detects** naming conflicts and reports which skill takes priority
- **Outputs** colored tree view (default), Markdown, or JSON；树形模式下每行附带灰色 **[作用域 · 插件名]** 提示（无插件则仅作用域）。

## Install

```bash
# Use without installing
npx skill-registry

# Or install globally
npm i -g skill-registry
```

## CLI Usage

```bash
# Scan current project (default: colored tree output)
skill-registry

# Specify project path
skill-registry --project /path/to/project

# Markdown format
skill-registry --md

# JSON format
skill-registry --json

# Save to file (auto strip colors)
skill-registry --output report.txt

# Help
skill-registry --help
```

## Output Modes

### Tree (default)

Color-coded, grouped by source, with tree-style indentation. Best for terminal.

```
Skills 清单报告 (131 skills, 3 conflicts)

官方插件 ──────────────────────────────── 52
  ├── brainstorming          You MUST use this before...
  ├── autopilot              Full autonomous execution...
  └── ...

本地 ─────────────────────────────────── 25
  ├── content-creator        自动化内容创作工作流系统
  └── ...

项目 ──────────────────────────────────── 51
  ├── codebase-audit         全代码库安全审计
  └── ...

⚠ Conflicts (3)
  ● codebase-audit  本地 (active) ← 社区(omc) (overridden)
  ● ...
```

### Markdown (`--md`)

Structured tables for documentation or further processing.

### JSON (`--json`)

Machine-readable output for scripting and automation.

## Claude Code Skill Mode

This package doubles as a Claude Code skill. After installing:

```bash
# Link the skill into your global skills directory
ln -s $(npm root -g)/skill-registry/skills/skill-registry ~/.claude/skills/skill-registry
```

Then in Claude Code, you can say:

- "列出所有 skill"
- "扫描 skill 冲突"
- "生成 skill 报告"

## Programmatic API

```js
import { scan, generateTreeReport, parseFrontmatter, detectConflicts } from 'skill-registry'

// Full pipeline
const { skills, conflicts } = scan({ projectRoot: '/my/project' })

// Generate colored tree report
console.log(generateTreeReport(skills, conflicts, homeDir, projectRoot))

// Individual functions
const fm = parseFrontmatter('---\nname: test\n---')
const conflicts = detectConflicts(skills)
```

### Exports

| Function | Description |
|----------|-------------|
| `scan(options)` | Full pipeline: scan + classify + detect conflicts |
| `parseFrontmatter(content)` | Parse YAML frontmatter from SKILL.md |
| `loadPluginRegistry(paths, fs)` | Load skill→plugin mapping from installed_plugins.json |
| `scanSkillsDir(dir, scope, registry, paths, fs)` | Scan a single skills directory |
| `scanPluginCacheSkills(paths, registry, fs)` | Scan plugin cache for skills |
| `detectConflicts(skills)` | Detect naming conflicts |
| `generateTreeReport(skills, conflicts, homeDir, projectRoot, options)` | Generate colored tree report |
| `generateMarkdownReport(skills, conflicts, homeDir, projectRoot)` | Generate Markdown report |
| `generateJsonReport(skills, conflicts, homeDir, projectRoot)` | Generate JSON report object |

## Source Classification

Report **source** is a string; grouping in the tree uses a base category (`官方`, `社区`, `本地`, `其他`) plus optional suffix in parentheses.

| Source (examples) | Color | Meaning |
|-------------------|-------|---------|
| `官方` | Cyan | `plugin.json` author is Anthropic (official marketplace plugin install under cache, or matching registry entry after cache scan) |
| `社区(<plugin>)` | Blue | Community plugin from cache / registry (plugin folder name in parentheses) |
| `社区(agents)` | Blue (same base as 社区) | Global skill entry is a symlink whose target path contains `.agents/skills` |
| `本地` | Green | Project `.claude/skills/` copies, or global skills not matched to a plugin registry entry |
| `其他` | Gray | Paths outside the known layout rules |

## Conflict Priority

When two skills share the same name (case-insensitive):

1. **Project scope** (`项目级`) wins over **global scope** (`全局级`).
2. Within the same scope, **source base** order from `SOURCE_PRIORITY` in `src/constants.js`: **本地** > **官方** > **社区** (includes `社区(omc)`, `社区(agents)`, etc.) > **其他**.

## Zero Dependencies

This package has zero runtime dependencies. It uses only Node.js built-in modules (`fs`, `path`, `os`).

## License

MIT
