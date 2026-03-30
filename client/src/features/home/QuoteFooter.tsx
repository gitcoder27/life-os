import { useHomeQuoteQuery } from "../../shared/lib/api";

export function QuoteFooter() {
  const quoteQuery = useHomeQuoteQuery();
  const quote = quoteQuery.data?.quote;

  if (quoteQuery.isError || !quote) return null;

  return (
    <footer className="quote-footer">
      <p className="quote-footer__text">"{quote.text}"</p>
      <span className="quote-footer__author">
        {quote.author}
        {" · "}
        <a
          className="quote-footer__attribution"
          href={quote.attributionUrl}
          rel="noreferrer"
          target="_blank"
        >
          ZenQuotes
        </a>
      </span>
    </footer>
  );
}
