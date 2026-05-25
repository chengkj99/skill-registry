#!/usr/bin/env bash
# 本地发布 skill-registry 到 npmjs.org
# 403 时通常是：账号未开 2FA，或 ~/.npmrc 里的 token 未勾选 bypass 2FA

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NPM_BIN="${NPM_BIN:-$(command -v npm)}"
echo "使用 npm: $NPM_BIN ($("$NPM_BIN" -v))"

TFA=$("$NPM_BIN" profile get 2>/dev/null | awk -F': ' '/two-factor auth/{print $2}' || true)
echo "账号 2FA 状态: ${TFA:-未知}"

if [[ "${TFA}" == "disabled" ]]; then
  echo ""
  echo ">>> 你的 npm 账号仍未开启 2FA，这是 403 的主要原因。"
  echo ">>> 任选其一："
  echo "    A) 开启 2FA 后本地发布（推荐）"
  echo "       open 'https://www.npmjs.com/settings/chengkangjian/profile'"
  echo "       开启 Authorization and writes，然后："
  echo "       npm logout && npm login"
  echo "       npm publish --otp=<Authenticator 6 位码>"
  echo ""
  echo "    B) 创建 Granular Token（勾选 Bypass 2FA）"
  echo "       open 'https://www.npmjs.com/settings/chengkangjian/tokens/granular-access-tokens/new'"
  echo "       权限 Read and Write，Packages 选 skill-registry，勾选 Bypass 2FA"
  echo "       然后执行："
  echo "       export NPM_TOKEN='粘贴新 token'"
  echo "       $0"
  echo ""
  echo "    C) 用 GitHub Actions Trusted Publisher（无需本地 token）"
  echo "       在 npm 包设置里绑定本仓库的 publish.yml，再 push tag 或手动跑 workflow"
  echo ""
fi

if [[ "${TFA}" == "disabled" && -z "${NPM_TOKEN:-}" ]]; then
  echo "错误: 2FA 未开启且未设置 NPM_TOKEN（需 Granular Token + Bypass 2FA）"
  exit 1
fi

if [[ -n "${NPM_TOKEN:-}" ]]; then
  export NODE_AUTH_TOKEN="$NPM_TOKEN"
  echo "使用环境变量 NPM_TOKEN 发布"
elif [[ -n "${OTP:-}" ]]; then
  echo "使用 OTP 发布"
else
  echo "提示: 已开 2FA 时可 export OTP=123456 后重试"
fi

"$NPM_BIN" run build

PUBLISH_ARGS=(publish --access public)
if [[ -n "${OTP:-}" ]]; then
  PUBLISH_ARGS+=(--otp="$OTP")
fi

"$NPM_BIN" "${PUBLISH_ARGS[@]}"
