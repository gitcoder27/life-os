import { Link } from "react-router-dom";

import { useHomeQuoteQuery, useSessionQuery } from "../../shared/lib/api";

function initialsFor(name: string | undefined | null): string {
  if (!name) return "L";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "L";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function HomeFooter() {
  const sessionQuery = useSessionQuery();
  const quoteQuery = useHomeQuoteQuery();

  const user = sessionQuery.data?.user ?? null;
  const quote = quoteQuery.data?.quote ?? null;

  return (
    <footer className="home-footer" aria-label="Session footer">
      <Link to="/settings" className="home-footer__identity" aria-label="Open settings">
        <span className="home-footer__avatar" aria-hidden="true">
          {initialsFor(user?.displayName)}
        </span>
        <span className="home-footer__identity-text">
          <span className="home-footer__name">{user?.displayName || "Owner"}</span>
          <span className="home-footer__role">View profile</span>
        </span>
      </Link>

      <p className="home-footer__quote">
        {quote ? (
          <>
            <span className="home-footer__quote-text">&ldquo;{quote.text}&rdquo;</span>
            <span className="home-footer__quote-author"> — {quote.author}</span>
          </>
        ) : (
          <span className="home-footer__quote-text home-footer__quote-text--muted">
            Discipline is choosing between what you want now and what you want most.
          </span>
        )}
      </p>
    </footer>
  );
}
