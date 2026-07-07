"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { withBasePath } from "@/lib/public-path";

const errorMessages: Record<string, string> = {
  feishu_not_configured: "飞书单点登录还没有配置应用参数。",
  feishu_missing_code: "飞书登录回调缺少授权码。",
  feishu_state_invalid: "飞书登录状态校验失败，请重新登录。",
  feishu_token_failed: "飞书授权换取用户信息失败。",
  feishu_email_missing: "飞书账号没有返回邮箱，无法匹配系统用户。",
  feishu_user_not_found: "飞书邮箱未匹配到启用的系统用户。"
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feishuError = searchParams.get("error");
  const visibleError = error ?? (feishuError ? errorMessages[feishuError] ?? "登录失败" : null);
  const canSubmit = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const response = await fetch(withBasePath("/api/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email.trim(),
        password
      })
    });
    const payload = await response.json().catch(() => ({}));

    setSubmitting(false);
    if (!response.ok) {
      setError(payload.error ?? "登录失败");
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="loginShell">
      <section className="loginPanel">
        <div className="loginBrand">
          <div className="brandMark">徽</div>
          <div>
            <h1>华徽智能工作台</h1>
            <p>使用系统邮箱登录，或通过飞书单点登录进入。</p>
          </div>
        </div>

        <form className="loginForm" onSubmit={handleSubmit}>
          <label>
            <span>邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
            />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </label>

          {visibleError ? <p className="loginError">{visibleError}</p> : null}

          <button className="primaryLoginButton" type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "登录中..." : "邮箱登录"}
          </button>
        </form>

        <div className="loginDivider">
          <span>或</span>
        </div>

        <a className="feishuLoginButton" href={withBasePath("/api/auth/feishu/start")}>
          飞书单点登录
        </a>
      </section>
    </main>
  );
}
