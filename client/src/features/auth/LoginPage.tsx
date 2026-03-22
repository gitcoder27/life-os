import { type FormEvent, useState } from "react";

import { useLoginMutation } from "../../shared/lib/api";

export function LoginPage() {
  const loginMutation = useLoginMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loginMutation.mutateAsync({ email, password });
  }

  return (
    <div className="auth-layout">
      <div className="auth-layout__panel">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <span
            style={{
              display: "inline-flex",
              width: "2.4rem",
              height: "2.4rem",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--r-sm)",
              background: "linear-gradient(135deg, rgba(217,153,58,0.2), rgba(217,153,58,0.06))",
              border: "1px solid rgba(217,153,58,0.25)",
              color: "var(--accent-bright)",
              fontFamily: "var(--font-display)",
              fontSize: "1.1rem",
              fontWeight: 600,
            }}
          >
            L
          </span>
          <span className="page-eyebrow">Secure account access</span>
        </div>
        <h1 className="auth-layout__title">Sign in to Life OS</h1>
        <p className="auth-layout__copy">
          Sign in with your account email and password to access your own workspace.
        </p>

        <form className="stack-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {loginMutation.error ? (
            <p className="list__subtle" style={{ color: "var(--danger, #e88f8f)" }}>
              {loginMutation.error instanceof Error
                ? loginMutation.error.message
                : "Unable to sign in."}
            </p>
          ) : null}

          <div className="button-row" style={{ marginTop: "0.5rem" }}>
            <button
              className="button button--primary"
              type="submit"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
