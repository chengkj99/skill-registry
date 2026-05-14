# skill-registry：全局来源归类修正与清单展示增强

## 1. 背景与问题

`skill-registry` 扫描 `~/.claude/skills/` 与项目 `.claude/skills/` 等位置，为每条 skill 推断 `source`（官方 / 社区子类 / 自建 / 其他），并在终端树形、Markdown、JSON 中输出。

用户反馈：**位于全局 `~/.claude/skills/` 下的部分 skill，实际来自官方或社区插件，却被标为「自建」**（问题类型 B）。同时，默认树形清单展示字段偏少，不利于快速核对「这条到底是不是插件来的」。

## 2. 目标

1. **主目标**：降低全局目录下对插件来源 skill 的 **误判为「自建」** 的概率，使 `source` 与真实安装来源更一致。
2. **次目标**：在不过度加宽终端的前提下，为树形（或可选模式）增加 **少量高信号字段**（如作用域、plugin/marketplace），便于人工核对。

## 3. 范围与非目标

**本轮包含**

- 调整 `inferSource` 的判定依据及调用链上传入的信息（在已读取 frontmatter、已知软链目标时使用）。
- 软链指向插件 cache 目录结构时，按与现有 `classifyCachePath` 一致的方式解析官方/社区。
- 插件注册表查找时同时使用 **目录名** 与 **frontmatter 中的 `name`（若存在）**。
- 单元测试覆盖上述分支；必要时在 fixtures 中使用最小 `plugin.json` 片段以稳定「官方」判定。
- 树形输出的轻量增强或 `--verbose`（具体默认行为在实现阶段二选一或组合，见第 6 节）。

**本轮不包含**

- 将项目 `.claude/skills/` 下的 skill 从「自建」改为单独大类「项目」或与全局自建拆分展示（问题类型 A）。若后续需要，应另开规格说明。
- 调整 `SOURCE_PRIORITY` 冲突优先级数值语义（除非回归测试证明必须修改）；本轮以 **修正标签字符串** 为主。

## 4. 根因归纳（实现依据）

以下情况会导致「全局却显示自建」：

1. **注册表查找键不完整**：`inferSource` 若仅按目录 basename 查 `pluginRegistry`，而注册表条目主要通过 **frontmatter 中的 `name`** 与目录名双键登记，则当 **目录名与 `name` 不一致** 且仅 `name` 在表中有记录时，会漏匹配而落入自建。
2. **软链路径未参与 cache 判定**：全局路径 `~/.claude/skills/foo` 的字符串中不含 `plugins/cache`，但实际 **`symlinkTarget` 指向 cache 内安装目录** 时，若不解析目标路径，会跳过 cache/manifest 分支，仅依赖 registry；registry 未命中时即自建。

## 5. 方案选定

采用 **思路 1（推荐）为主，并包含思路 2 的基础能力**：

- **多信号归类**：registry **双键**（目录名 + `frontmatter.name`）+ 软链时检查 **目标路径** 是否落在插件 cache 结构下并复用现有 manifest 判定逻辑。
- **不引入**单独的「向上穷举父目录找 plugin.json」类弱启发式（思路 3），避免误报与维护成本；若上线后仍有漏网个案，再单独立项分析。

## 6. 归类算法（执行顺序）

在保持现有行为大框架的前提下，建议按以下顺序判定（与代码中实际 `if` 顺序需在实现时保持一致并注释说明）：

1. 若存在软链且目标路径包含 `.agents/skills` → `社区(agents)`（现有逻辑保留）。
2. 若 `skillPath` 位于项目 `projectSkillsDir` 下 → `自建`（现有逻辑保留，本轮不改语义）。
3. **若存在 `symlinkTarget`（或调用方提供的已解析真实路径）**，且该路径落在 `~/.claude/plugins/cache/` 约定结构下 → 调用与 `classifyCachePath` 等价逻辑：读取对应安装目录下 `plugin.json`（路径常量沿用 `PLUGIN_MANIFEST_PATH`），`author.name === OFFICIAL_AUTHOR` 则为 `官方`，否则为 `社区(<插件目录名>)`。
4. 若 `skillPath` 字符串本身包含插件 cache 路径（非软链、直铺在 cache 外不可见但字符串含 cache 的边界情况由现有分支处理）→ 沿用现有 `classifyCachePath` 分支。
5. 若 `skillPath` 位于全局 `globalSkillsDir` 下 → 使用 `pluginRegistry.get(目录名)` 与 `pluginRegistry.get(frontmatter.name)`（仅当 `name` 存在且非空时第二次查找），任一命中则 `classifyByRegEntry(regEntry)`。
6. 其余兜底：全局下无命中 → `自建`；既非项目、非全局、非 cache 等已知形态 → `其他`（与现有实现一致处不随意改动）。

**实现注意**：`inferSource` 当前签名不含 frontmatter；应在 `scanSkillsDir` 在已解析 frontmatter 之后调用推断函数，并传入 **`entry`（目录名）与 `frontmatter.name`（可选）** 或等价参数，避免重复读盘。

## 7. 冲突检测与兼容性

- 冲突排序仍依赖 `SOURCE_PRIORITY` 与 `baseSource()` 对 `社区(xxx)` 的大类归并。
- 将某条 skill 从「自建」纠正为「官方」或「社区」后，仅改变 **展示与统计分组**；若与另一条同名 skill 的优先级比较发生变化，属于 **更符合真实安装关系** 的预期结果，需在测试中固定用例断言。

## 8. 清单展示（次要）

**原则**：默认终端宽度下可读性优先。

**可选实现**（实现阶段择一或组合，以 PR 中最终实现为准）：

- **方案 A**：树形每行在描述前增加 `项目级|全局级` 与可选 `[plugin]` 缩写。
- **方案 B**：增加 `--verbose`，在 verbose 下输出扩展列；默认保持当前行宽。

规格层面要求：**至少一种**方式使用户在不打开 Markdown 的情况下能更快区分「是否插件关联」，且不强制默认行宽超过约 120 列。

## 9. 测试与验收标准

| 场景 | 期望 |
|------|------|
| 全局目录，registry 仅能通过 `frontmatter.name` 命中 | `source` 为官方或对应社区标签，非自建 |
| 全局目录，软链目标位于 cache 下且 manifest 为 Anthropic | `官方` |
| 全局目录，软链目标位于 cache 下且非官方 | `社区(<插件目录>)` |
| 无 `SKILL.md`、无 frontmatter、registry 无记录的真本地目录 | 仍为 `自建`（或与现有「其他」边界一致，不随意改变既有测试契约） |
| 回归 | 现有 scanner / reporter / conflict 相关测试全部通过 |

测试风格：延续仓库现有 **内存 mock fs**；若官方判定依赖 `plugin.json` 字段，可使用 **最小 JSON fixture** 固定 `author.name`，避免网络与真实安装路径依赖。

## 10. 文档与发布

- 若 README 中关于「自建」的说明与实现修正后的语义不一致，可在实现 PR 中 **小幅更新 README** 中与误判相关的说明句（不要求在本设计文档中预先改 README）。
- 版本号与 CHANGELOG 由实现阶段按仓库惯例处理。

---

**状态**：已通过产品/技术方案评审（用户确认 OK）。下一步为编写实现计划（`writing-plans` 技能流程），并在实现 PR 中落地代码与测试。
