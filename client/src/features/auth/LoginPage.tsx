import { Link } from "react-router-dom";

export function LoginPage() {
  return (
    <div className="auth-layout">
      <div className="auth-layout__panel">
        <span className="page-eyebrow">Self-hosted owner access</span>
        <h1 className="auth-layout__title">Sign in to Life OS</h1>
        <p className="auth-layout__copy">
          This bootstrap keeps authentication intentionally simple. The backend
          remains the source of truth for sessions and account state.
        </p>

        <form className="stack-form">
          <label className="field">
            <span>Email</span>
            <input
              placeholder="owner@example.com"
              type="email"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              placeholder="••••••••"
              type="password"
            />
          </label>

          <div className="button-row">
            <button
              className="button button--primary"
              type="submit"
            >
              Sign in
            </button>
            <Link
              className="button button--ghost"
              to="/onboarding"
            >
              Review onboarding
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
