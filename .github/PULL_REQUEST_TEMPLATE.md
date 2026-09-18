<!--
PR title / PR 标题:
- Use Conventional Commits: `type(scope): summary`
- Allowed types: `feat`, `docs`, `fix`, `style`, `refactor`, `chore`, `ci`
- Include a scope whenever the change has one: `ci(workflows): ...`, `fix(vercel): ...`
- For breaking changes, add `!`: `feat(driver)!: change auth flow`
-->

## Summary / 摘要

<!--
Briefly describe what changed and why.
简要说明改了什么，以及为什么需要改。
-->

<!--
- List user-visible behavior changes.
- List important implementation changes.
- Mention config, storage, API, or compatibility changes if any.

- 列出用户可感知的行为变化。
- 列出重要实现变化。
- 如涉及配置、存储、API 或兼容性变化，请明确说明。
-->

- [ ] This PR has breaking changes.
      / 此 PR 包含破坏性变更。
- [ ] This PR changes public API, config, storage format, or migration behavior.
      / 此 PR 修改了公开 API、配置、存储格式或迁移行为。

## Related Issues / 关联 Issue

<!--
Use `Closes #123`, `Fixes #123`, or `Relates to #123`.
Remove this section if not applicable.
使用 `Closes #123`、`Fixes #123` 或 `Relates to #123`。
不适用时请删除本节。
-->

## Testing / 测试

<!--
Which of these did you actually run? Leaving them unchecked is fine as long as the
summary says which path was not verified.

这几条你实际跑了哪些？没跑也没关系，只要在摘要里说清哪条链路没验过。

CI 会在每个 PR 上自动跑（无需本地准备）：
  - Cloudflare  `wrangler deploy --dry-run`
  - Netlify     `netlify build --offline`
  - EdgeOne     产物是否与源码同步
  - gitleaks    凭据泄露扫描
Vercel 那条要等仓库配好三个 Secret 才会真正执行，未配置时会在摘要里明确写「未启用」。
-->

- [ ] `pnpm run lint`
- [ ] `pnpm run build`
- [ ] Manual test / 手动测试:

## Checklist / 检查清单

- [ ] I have read [CONTRIBUTING](https://github.com/LegspCpd/openlist-next/blob/main/CONTRIBUTING.md).
      / 我已阅读 [CONTRIBUTING](https://github.com/LegspCpd/openlist-next/blob/main/CONTRIBUTING.md)。
- [ ] I confirm this contribution follows the repository license, contribution policy, and code of conduct.
      / 我确认此贡献符合仓库许可证、贡献规范和行为准则。
- [ ] I have formatted the changed code with `pnpm run format` where applicable.
      / 我已按适用情况用 `pnpm run format` 格式化变更代码。
- [ ] If this PR touches `src/**`, `api/**` or the build scripts, `cloud-functions/[[default]].js` is rebuilt and committed in this PR.
      / 如此 PR 改动 `src/**`、`api/**` 或构建脚本，已在本次 PR 内重建并提交 `cloud-functions/[[default]].js`。
- [ ] I have requested review from relevant maintainers or code owners where applicable.
      / 我已在适用情况下请求相关维护者或代码所有者审查。

## AI Disclosure / AI 使用声明

<!--
Please disclose any substantial AI assistance used in this PR.
Minor AI assistance, such as typo fixes, autocomplete, formatting suggestions,
or wording polish, does not need to be disclosed.
Remove this section if not applicable.

请披露此 PR 中使用的重要 AI 辅助内容。
轻微 AI 辅助，例如拼写修正、自动补全、格式建议或文字润色，无需披露。
如不适用，请删除本节。

Deliberate non-disclosure may be treated as a trust and compliance issue.

故意隐瞒 AI 使用情况可能被视为信任与合规问题。
-->

- [ ] This PR includes AI-assisted content.
      / 此 PR 包含 AI 辅助内容。

Tools used / 使用工具:

- [ ] ChatGPT
- [ ] Codex
- [ ] GitHub Copilot
- [ ] Claude
- [ ] Gemini
- [ ] Other (please specify) / 其他（请注明）:

Usage scope / 使用范围:

- [ ] Code generation / 代码生成
- [ ] Refactoring / 重构
- [ ] Documentation / 文档
- [ ] Tests / 测试
- [ ] Translation / 翻译
- [ ] Review assistance / 审查辅助

- [ ] I have reviewed and validated all AI-assisted content included in this PR.
      / 我已审核并验证此 PR 中的所有 AI 辅助内容。
- [ ] I can reproduce all AI-assisted content included in this PR without any AI tools.
      / 我可以在没有任何 AI 工具的情况下重现此 PR 中包含的所有 AI 辅助内容。

<!--
本仓库的提交不加 `Co-Authored-By` 归属行 —— 提交的 author 就是贡献者本人。
This repository does not use `Co-Authored-By` lines; the author of a commit is its contributor.
-->
