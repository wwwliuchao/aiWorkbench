"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
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

function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      className={className}
      src={withBasePath("/assets/huahui-brand/huahui-logo.png")}
      alt="华徽集团 HUAHUI"
      width={2048}
      height={835}
      priority
    />
  );
}

function AppGridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

function WorkflowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="2.5" width="6" height="5" rx="1.5" />
      <rect x="2" y="16.5" width="5" height="5" rx="1.5" />
      <rect x="9.5" y="16.5" width="5" height="5" rx="1.5" />
      <rect x="17" y="16.5" width="5" height="5" rx="1.5" />
      <path d="M12 7.5v4.2M4.5 16.5v-4.8h15v4.8M12 11.7v4.8" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20V4M4 20h17" />
      <rect x="7" y="13" width="3" height="5" rx="1" />
      <rect x="12" y="10" width="3" height="8" rx="1" />
      <rect x="17" y="6" width="3" height="12" rx="1" />
      <path d="m7.5 9 4-3 3 1.5L19 3" />
    </svg>
  );
}

function RobotIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 20h14M8 20v-3h8v3M9 17l2-5 4 1 2-5" />
      <circle cx="11" cy="11.8" r="2" />
      <circle cx="17.5" cy="6.5" r="2" />
      <path d="m19 8 2 2-2 2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.8 20 6v5.4c0 4.8-3.2 8.3-8 10.2-4.8-1.9-8-5.4-8-10.2V6l8-3.2Z" />
      <path d="m8.4 12.2 2.2 2.2 5-5" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      <section className="loginShowcase" aria-label="华徽智能工作台介绍">
        <BrandLogo className="loginShowcaseLogo" />

        <div className="loginShowcaseBody">
          <div className="loginHeroCopy">
            <h1>
              一个入口，<br />
              <span className="loginHeadlineLine"><em>连接</em>每一项工作。</span>
            </h1>
            <p>统一访问应用、流程、数据与自动化，<br />让协作更清晰、更高效。</p>

            <div className="loginCapabilityList" aria-label="工作台能力">
              <div className="loginCapability loginCapabilityBlue">
                <span><AppGridIcon /></span>
                <strong>应用入口</strong>
              </div>
              <div className="loginCapability loginCapabilityPurple">
                <span><WorkflowIcon /></span>
                <strong>智能工作流</strong>
              </div>
              <div className="loginCapability loginCapabilityTeal">
                <span><ChartIcon /></span>
                <strong>数据看板</strong>
              </div>
              <div className="loginCapability loginCapabilityAmber">
                <span><RobotIcon /></span>
                <strong>RPA 自动化</strong>
              </div>
            </div>
          </div>

          <div className="loginHeroVisual" aria-hidden="true">
            <Image
              src={withBasePath("/assets/huahui-brand/login-workspace-hero.png")}
              alt=""
              width={1254}
              height={1254}
              sizes="(min-width: 1400px) 760px, (min-width: 900px) 58vw, 1px"
              style={{ height: "auto" }}
              priority
            />
          </div>
        </div>

        <div className="loginTrustLine">
          <span><ShieldIcon /></span>
          <strong>统一・安全・高效</strong>
        </div>
      </section>

      <section className="loginAccessArea" aria-label="登录区域">
        <div className="loginSecurityBadge">
          <ShieldIcon />
          <span>企业级安全访问</span>
        </div>

        <div className="loginPanel">
          <BrandLogo className="loginPanelLogo" />

          <header className="loginPanelHeader">
            <h2>欢迎回来</h2>
            <p>使用企业邮箱登录，或通过飞书单点登录</p>
          </header>

          <form className="loginForm" onSubmit={handleSubmit}>
            <label htmlFor="login-email">邮箱</label>
            <div className="loginInputShell">
              <span className="loginInputIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
                </svg>
              </span>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@huahui.com"
                autoComplete="email"
              />
            </div>

            <label htmlFor="login-password">密码</label>
            <div className="loginInputShell">
              <span className="loginInputIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="5" y="10" width="14" height="11" rx="3" />
                  <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v3" />
                </svg>
              </span>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
              <button
                className="loginPasswordToggle"
                type="button"
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                  <circle cx="12" cy="12" r="2.5" />
                  {showPassword ? null : <path d="m4 4 16 16" />}
                </svg>
              </button>
            </div>

            {visibleError ? (
              <p className="loginError" role="alert" aria-live="polite">
                {visibleError}
              </p>
            ) : null}

            <button className="primaryLoginButton" type="submit" disabled={!canSubmit || submitting}>
              <span>{submitting ? "登录中..." : "邮箱登录"}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M14 7l5 5-5 5" />
              </svg>
            </button>
          </form>

          <div className="loginDivider">
            <span>或</span>
          </div>

          <a className="feishuLoginButton" href={withBasePath("/api/auth/feishu/start")}>
            <span className="feishuButtonMark" aria-hidden="true">
              <i />
              <b />
            </span>
            飞书单点登录
          </a>
        </div>
      </section>
    </main>
  );
}
