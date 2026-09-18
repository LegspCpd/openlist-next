# Copilot 代码审查指引

本仓库启用了 GitHub Copilot 的 PR 审查。请在审查时额外关注以下安全点，作为 CI 里
gitleaks 扫描的人工补充：

- **硬编码凭据**：任何写死在源码里的密钥、token、密码都不要放过，包括但不限于
  API Key、AI / 大模型密钥（OpenAI `sk-`、Anthropic `sk-ant-`、DeepSeek、OpenRouter
  `sk-or-v1-`、Groq `gsk_`、Mistral `mistral.`、Cohere `lk_` 等 `sk-` 系列）、云厂商
  密钥（AWS `AKIA`、腾讯云 `AKID`、Google `AIza`）、GitHub / GitLab / Slack /
  Telegram / Stripe / npm / Cloudflare 等 token。
- **配置里的真实值**：`.env.example` / `.dev.vars.example` 只放占位（目前只有
  `JWT_SECRET` / `ADMIN_PASS` 两个空值）。如果发现被填进了真实密钥，请指出并建议改用
  环境变量注入，不要合并。
- **泄露后的处理**：发现疑似真凭据时，在评论里点明「命中了哪类密钥、出现在哪个文件哪一行」，
  但**不要原文复述密钥值本身**。

正式的凭据扫描由 CI 里的 gitleaks 负责（配置见仓库根 `.gitleaks.toml`，规则前缀 `olv-`）；
本文件只是让 Copilot 在人工审查时多一道眼睛，二者互补。

> 可选：仓库 Settings → Code security 里开启 **Secret scanning**（含 push protection）
> 与 **Copilot code review**，可在合并前从平台侧再拦一道。这两项需要在 GitHub 网页端开启，
> 本文件无法替你打开。
