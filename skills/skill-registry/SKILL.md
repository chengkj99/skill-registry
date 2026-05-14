---
name: skill-registry
description: Skills 清单扫描与冲突检测。当用户说「列出所有 skill」「扫描 skill」「skill 清单」「查看 skill 冲突」「skill 报告」「skill 审计」「已安装的 skill」时使用。扫描全局和项目级 skill 目录及插件缓存，按来源分类，检测同名冲突，输出结构化报告。
version: 1.0.3
---

# Skill Registry

扫描、分类、检测所有已安装的 Claude Code skill，输出结构化报告。

## 何时触发

- 用户想看所有已安装的 skill 及其分类
- 用户想检查 skill 命名冲突
- 用户想要一份 skill 清单报告
- 用户想知道 skill 来自哪里（官方、社区子类、本地、项目级/全局级作用域等）

## 行为说明（与实现对齐）

- **扫描范围**：仅 `~/.claude/skills/`、`<项目>/.claude/skills/`、`~/.claude/plugins/cache/` 及 `installed_plugins.json` 所反映的安装路径；**不**单独扫描 Cursor 专有目录；若 Cursor 与 Claude Code 共用同一 `~/.claude`，则这些 skill 会被包含。
- **来源标签**：`官方`、`社区(插件名)`、`社区(agents)`（指向 `~/.agents/skills/` 的软链）、`本地`、`其他`；冲突排序中的「社区」包含以上所有 `社区(...)` 子类。
- **CLI 与 API**：命令行 `skill-registry` 与代码中的 `scan()` 使用同一套扫描顺序，避免「命令行与程序化结果来源不一致」。

## 工作流程

### 步骤 1：运行扫描器

执行 CLI 工具：

```bash
npx skill-registry --project $PROJECT_DIR
```

如果需要程序化处理结果：

```bash
npx skill-registry --json --project $PROJECT_DIR
```

保存报告到文件：

```bash
npx skill-registry --output skills-report.md --project $PROJECT_DIR
```

### 步骤 2：呈现结果

- Markdown 输出：直接呈现给用户
- JSON 输出：总结关键发现（skill 总数、冲突数、来源分布）
- 重点说明任何命名冲突，解释哪个 skill 生效以及原因

### 步骤 3：冲突建议

如果发现冲突：

- 解释优先级规则：项目级 > 全局级；同作用域内按 `constants.js` 中 `SOURCE_PRIORITY`：**本地 > 官方 > 社区 > 其他**（`社区(omc)`、`社区(agents)` 等均视为「社区」基数）
- 建议修复方式：移除重复、重命名 skill、调整软链
