import { useHomeQuoteQuery } from "../../shared/lib/api";

export function MotivationalQuoteCard() {
  const quoteQuery = useHomeQuoteQuery();
  const quote = quoteQuery.data?.quote;

  if (quoteQuery.isError) {
    return null;
  }

  return (
    <section className="dash-card quote-card" aria-live="polite">
      <h3 className="dash-card__title">Momentum</h3>

      {quote ? (
        <>
          <p className="quote-card__text">"{quote.text}"</p>
          <p className="quote-card__author">- {quote.author}</p>
          <a
            className="quote-card__attribution"
            href={quote.attributionUrl}
            rel="noreferrer"
            target="_blank"
          >
            Quotes by ZenQuotes
          </a>
        </>
      ) : (
        <div className="quote-card__loading" role="status" aria-label="Loading quote">
          <span className="quote-card__loading-line quote-card__loading-line--long" />
          <span className="quote-card__loading-line quote-card__loading-line--short" />
          <span className="quote-card__loading-line quote-card__loading-line--author" />
        </div>
      )}
    </section>
  );
}
