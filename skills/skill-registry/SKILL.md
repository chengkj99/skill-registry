---
name: skill-registry
description: Skills 清单扫描与冲突检测。当用户说「列出所有 skill」「扫描 skill」「skill 清单」「查看 skill 冲突」「skill 报告」「skill 审计」「已安装的 skill」时使用。扫描全局和项目级 skill 目录及插件缓存，按来源分类，检测同名冲突，输出结构化报告。
version: 1.0.0
---

# Skill Registry

扫描、分类、检测所有已安装的 Claude Code skill，输出结构化报告。

## 何时触发

- 用户想看所有已安装的 skill 及其分类
- 用户想检查 skill 命名冲突
- 用户想要一份 skill 清单报告
- 用户想知道 skill 来自哪里（官方插件、社区、自建、项目等）

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

- 解释优先级规则：项目级 > 全局级；同作用域内自建 > 插件
- 建议修复方式：移除重复、重命名 skill、调整软链
