# skill-registry 全局来源归类与树形展示 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正全局 `~/.claude/skills/` 下 skill 的 `source` 误判（注册表双键 + 软链指向插件 cache 时的 manifest 判定），并在默认树形输出中增加简短的作用域与插件提示，满足设计规格 `docs/superpowers/specs/2026-05-15-skill-registry-source-classification-design.md`。

**Architecture:** 在 `src/scanner.js` 中扩展 `inferSource` 的判定顺序与可选入参（目录名 + frontmatter `name`）；复用现有内部函数 `classifyCachePath` 解析软链目标路径。在 `src/reporter.js` 的 `generateTreeReport` 中为每行追加灰色短标签（作用域 + 可选 plugin），不新增 CLI 开关即可满足规格「至少一种」终端增强；`src/cli.js` 将 `generateTreeReport` 的调用保持不变或仅传入已有 `options` 对象扩展位。

**Tech Stack:** Node.js ≥18、ESM、`vitest` 单测、现有 `test/fixtures/fs-helpers.js` 的 `createFakeFs`。

---

## 文件与职责

| 文件 | 职责 |
|------|------|
| `src/scanner.js` | `inferSource` 算法与 `scanSkillsDir` 调用处传入 `entry` / `frontmatter.name` |
| `src/reporter.js` | `generateTreeReport` 每行展示增强 |
| `test/scanner.test.js` | 新增/更新 `inferSource` 与 `scanSkillsDir` 用例 |
| `test/reporter.test.js` | 若树形字符串格式变化，更新快照式断言或子串断言 |
| `src/index.js` | 若重新导出 `inferSource` 签名，确保 JSDoc/导出与实现一致（通常仅签名变更无需改 `scan()`） |
| `README.md` | 可选：用 1～2 句说明「全局目录下双键匹配与软链 cache 归类」，避免与旧描述矛盾 |

**不修改：** `src/conflict-detector.js`、`src/constants.js` 中的 `SOURCE_PRIORITY`（除非回归失败再评估）。

---

### Task 1: 扩展 `inferSource` 签名与判定顺序

**Files:**
- Modify: `src/scanner.js`（`inferSource` 全文；`scanSkillsDir` 内一处调用）

- [ ] **Step 1: 写失败测试（双键 + 软链 cache）**

在 `test/scanner.test.js` 的 `describe('inferSource')` 中**先**增加下列用例（实现前运行应失败：期望与当前实现不符）。

**用例 A — 仅 frontmatter 名在 registry 命中（目录名不命中）**

```javascript
it('全局目录：registry 仅能通过 frontmatter.name 命中时返回官方', () => {
  const registry = new Map([['doc-name', { plugin: 'frontend-design', isOfficial: true }]])
  const result = inferSource(
    '/home/user/.claude/skills/folder-name',
    false,
    null,
    registry,
    paths,
    noFs,
    { entryName: 'folder-name', fmName: 'doc-name' }
  )
  expect(result).toBe('官方')
})
```

**用例 B — 全局软链，目标为 cache 下官方 skill 目录**

```javascript
it('全局软链：目标在插件 cache 下且 manifest 为 Anthropic 时返回官方', () => {
  const installBase = '/home/user/.claude/plugins/cache/claude-plugins-official/frontend-design/1.0.0'
  const skillInCache = `${installBase}/skills/autopilot`
  const fs = createFakeFs({
    [`${installBase}/.claude-plugin/plugin.json`]: JSON.stringify({
      name: 'frontend-design',
      author: { name: 'Anthropic' },
    }),
  })
  const result = inferSource(
    '/home/user/.claude/skills/autopilot',
    true,
    skillInCache,
    new Map(),
    paths,
    fs,
    { entryName: 'autopilot', fmName: '' }
  )
  expect(result).toBe('官方')
})
```

**用例 C — 全局软链，目标为 cache 下非官方**

```javascript
it('全局软链：目标在插件 cache 下且非官方时返回社区(插件目录名)', () => {
  const installBase = '/home/user/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0'
  const skillInCache = `${installBase}/skills/brainstorming`
  const fs = createFakeFs({
    [`${installBase}/.claude-plugin/plugin.json`]: JSON.stringify({
      name: 'superpowers',
      author: { name: 'Jesse Vincent' },
    }),
  })
  const result = inferSource(
    '/home/user/.claude/skills/brainstorming',
    true,
    skillInCache,
    new Map(),
    paths,
    fs,
    { entryName: 'brainstorming', fmName: '' }
  )
  expect(result).toBe('社区(superpowers)')
})
```

运行：

```bash
cd /Users/chengkangjian/work/skill-registry && npm test -- test/scanner.test.js
```

**期望：** 新用例失败（`inferSource` 尚未实现双键与软链 cache）。

- [ ] **Step 2: 实现 `inferSource`**

在 `src/scanner.js` 中：

1. 将 `inferSource` 增加第七参数 `lookup = {}`，从中读取 `entryName`（默认 `basename(skillPath)`）与 `fmName`（默认 `''`，并 `.trim()`）。
2. 严格按设计规格 **第 6 节** 顺序实现：
   - 软链 + `symlinkTarget` 含 `.agents/skills` → `社区(agents)`（保持现有行为）。
   - `skillPath.startsWith(paths.projectSkillsDir)` → `自建`。
   - **新增**：若 `isSymlink && symlinkTarget`，则 `const t = classifyCachePath(symlinkTarget, paths, fs)`，若 `t` 非空则返回 `t`。
   - `skillPath` 含 `join('.claude', 'plugins', 'cache')` 时沿用现有 `classifyCachePath(skillPath, ...)`。
   - `skillPath.startsWith(paths.globalSkillsDir)`：`let reg = pluginRegistry.get(entryName)`；若缺失且 `fmName` 非空则 `reg = pluginRegistry.get(fmName)`；若 `reg` 存在则 `classifyByRegEntry(reg)`，否则 `自建`。
3. 其余路径 → `其他`（与当前文件末尾行为一致）。

**不要**在「项目目录」分支之前执行软链 cache 分支（规格：项目路径仍为自建）。

- [ ] **Step 3: 更新 `scanSkillsDir` 中的调用**

在解析完 `frontmatter`、且确认 `stat.isDirectory() || isSymlink` 的分支内，将：

```javascript
const source = inferSource(fullPath, isSymlink, symlinkTarget, pluginRegistry, paths, fs)
```

改为传入 lookup，例如：

```javascript
const source = inferSource(fullPath, isSymlink, symlinkTarget, pluginRegistry, paths, fs, {
  entryName: entry,
  fmName: frontmatter.name || '',
})
```

- [ ] **Step 4: 更新现有 `inferSource` 单元测试的调用方式**

`test/scanner.test.js` 中所有 `inferSource(...)` 若只有 6 个参数，在 Node 中可省略第七参数（默认 `{}`），**行为必须与改前一致**。若某测试依赖「仅 basename」且未传 `fmName`，保持不传即可。

运行：

```bash
npm test
```

**期望：** 全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/scanner.js test/scanner.test.js
git commit -m "fix(scanner): 全局来源双键匹配与软链指向 cache 时的归类"
```

---

### Task 2: `scanSkillsDir` 集成测试（目录名与 name 不一致）

**Files:**
- Modify: `test/scanner.test.js`

- [ ] **Step 1: 写失败测试**

```javascript
it('扫描时：目录名与 frontmatter.name 不一致仍能命中插件注册表来源', () => {
  const registry = new Map([
    ['doc-skill', { marketplace: 'm', plugin: 'my-plugin', version: '1.0.0', isOfficial: false }],
  ])
  const fs = createFakeFs({
    '/home/user/.claude/skills/dir-a': null,
    '/home/user/.claude/skills/dir-a/SKILL.md': '---\nname: doc-skill\ndescription: d\n---',
  })
  const result = scanSkillsDir(paths.globalSkillsDir, '全局级', registry, paths, fs)
  expect(result).toHaveLength(1)
  expect(result[0].name).toBe('doc-skill')
  expect(result[0].source).toBe('社区(my-plugin)')
})
```

运行 `npm test -- test/scanner.test.js`，在 Task 1 完成后应已通过；若 Task 1 漏接 lookup，此处失败。

- [ ] **Step 2: 若已通过则仅 commit（可与 Task 1 合并提交）**

若已在 Task 1 一并添加本用例，可跳过单独 commit。

---

### Task 3: 树形报告展示增强

**Files:**
- Modify: `src/reporter.js`（`generateTreeReport`）
- Modify: `test/reporter.test.js`（断言行内出现 `[全局级]` / `[项目级]` 或你选定的最终短标签）

- [ ] **Step 1: 写失败测试**

在 `test/reporter.test.js` 中，对现有 `generateTreeReport` 测试增加断言，例如期望输出包含灰色维度以外的**可读子串**（避免断言完整 ANSI 序列）：例如 `全局级` 与 `plugin` 名（使用 `makeSkill` 构造带 `plugin: 'p'` 的项）。

示例断言（按你实现的字面量微调）：

```javascript
const tree = generateTreeReport(skills, [], '/home/user', '/home/user/project', { noColor: true })
expect(tree).toContain('全局级')
expect(tree).toContain('my-plugin')
```

运行 `npm test -- test/reporter.test.js`，**期望：** 失败。

- [ ] **Step 2: 实现 `generateTreeReport` 行格式**

在 `src/reporter.js` 每 skill 行上，在 `prefix` 与 `name` 之间或 `name` 与 `desc` 之间插入：

- 灰色短标签表示 `s.scope`（建议字面量 `全局级` / `项目级` 与设计用语一致，或缩写为 `[全局]` / `[项目]`，**测试与实现保持一致即可**）。
- 若 `s.plugin` 为真值，追加灰色分隔符 + `plugin` 字符串；长度超过 14 时截断并加 `…`（与规格「控制行宽」一致）。

保持现有 `name`、`→` 软链标记、`description` 灰字顺序合理即可。

- [ ] **Step 3: 运行全量测试**

```bash
npm test
```

**期望：** 全部通过。

- [ ] **Step 4: Commit**

```bash
git add src/reporter.js test/reporter.test.js
git commit -m "feat(reporter): 树形清单展示作用域与插件提示"
```

---

### Task 4: 文档与导出一致性（可选但推荐）

**Files:**
- Modify: `README.md`（「Classifies」或树形示例附近 1～2 句）

- [ ] **Step 1:** 说明全局目录下通过 **SKILL.md 中 name** 与 **目录名** 联合匹配安装来源，以及 **指向插件 cache 的软链** 会按插件 manifest 分类。

- [ ] **Step 2: Commit**

```bash
git add README.md && git commit -m "docs: 说明全局 skill 来源推断规则"
```

---

## 规格自检（计划 vs spec）

| 规格章节 | 对应任务 |
|----------|----------|
| §6 算法顺序 1～2 | Task 1 保留 agents / 项目 |
| §6 算法顺序 3 软链+cache | Task 1 用例 B/C + 实现 |
| §6 算法顺序 4 skillPath cache | Task 1 保留现有分支 |
| §6 算法顺序 5 全局双键 | Task 1 用例 A + `scanSkillsDir` lookup |
| §6 实现注意 | Task 1 `scanSkillsDir` |
| §8 清单展示 | Task 3 |
| §9 测试表 | Task 1～3 覆盖 |

**占位符扫描：** 本计划不含 TBD/TODO 式步骤。

---

## 执行交接

Plan complete and saved to `docs/superpowers/plans/2026-05-15-skill-registry-source-classification.md`.

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每个 Task 派生子代理，任务间 review，迭代快。  
2. **Inline Execution** — 本会话内按 Task 顺序实现，阶段性核对。

请选择 **1** 或 **2**；若未指定，默认按 **2（本会话内联实现）** 执行直至 `npm test` 全绿。
