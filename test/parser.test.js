import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from '../src/parser.js'

describe('parseFrontmatter', () => {
  it('解析标准 frontmatter', () => {
    const content = `---
name: my-skill
description: A test skill
version: 1.0.0
---

Body content here`
    const result = parseFrontmatter(content)
    expect(result).toEqual({
      name: 'my-skill',
      description: 'A test skill',
      version: '1.0.0',
    })
  })

  it('解析双引号包裹的值', () => {
    const content = `---
name: "my-skill"
description: "A test skill with : colon"
---`
    const result = parseFrontmatter(content)
    expect(result.name).toBe('my-skill')
    expect(result.description).toBe('A test skill with : colon')
  })

  it('解析单引号包裹的值', () => {
    const content = `---
name: 'my-skill'
---`
    const result = parseFrontmatter(content)
    expect(result.name).toBe('my-skill')
  })

  it('无 frontmatter 返回空对象', () => {
    const content = 'Just regular content without frontmatter'
    expect(parseFrontmatter(content)).toEqual({})
  })

  it('值中包含冒号时正确解析', () => {
    const content = `---
description: This is a path: /some/path
---`
    const result = parseFrontmatter(content)
    expect(result.description).toBe('This is a path: /some/path')
  })

  it('空 frontmatter 返回空对象', () => {
    const content = `---
---`
    expect(parseFrontmatter(content)).toEqual({})
  })

  it('忽略无冒号的行', () => {
    const content = `---
name: test
just a line without colon
---`
    const result = parseFrontmatter(content)
    expect(result).toEqual({ name: 'test' })
  })

  it('处理 allowed-tools 字段', () => {
    const content = `---
name: codebase-audit
description: Audit tool
allowed-tools: Read Grep Glob Bash(rg *)
---`
    const result = parseFrontmatter(content)
    expect(result['allowed-tools']).toBe('Read Grep Glob Bash(rg *)')
  })
})
