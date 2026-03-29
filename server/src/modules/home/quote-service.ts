import { AppError } from "../../lib/errors/app-error.js";
import type { HomeQuote } from "@life-os/contracts";

const ZEN_QUOTES_BATCH_URL = "https://zenquotes.io/api/quotes";
const ZEN_QUOTES_ATTRIBUTION_URL = "https://zenquotes.io";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type FetchLike = typeof fetch;

type ZenQuotePayload = {
  q?: unknown;
  a?: unknown;
};

type QuoteServiceOptions = {
  fetchImpl?: FetchLike;
  now?: () => number;
};

type QuoteCacheState = {
  queue: HomeQuote[];
  fetchedAt: number | null;
  refreshPromise: Promise<void> | null;
};

function shuffleQuotes(quotes: HomeQuote[]) {
  const next = [...quotes];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }

  return next;
}

function normalizeZenQuotesPayload(payload: unknown) {
  if (!Array.isArray(payload)) {
    throw new Error("ZenQuotes returned an unexpected payload.");
  }

  const uniqueQuotes = new Map<string, HomeQuote>();

  for (const item of payload as ZenQuotePayload[]) {
    if (typeof item.q !== "string" || typeof item.a !== "string") {
      continue;
    }

    const text = item.q.trim();
    const author = item.a.trim();

    if (!text || !author) {
      continue;
    }

    uniqueQuotes.set(`${text}::${author}`, {
      text,
      author,
      attributionUrl: ZEN_QUOTES_ATTRIBUTION_URL,
    });
  }

  const quotes = [...uniqueQuotes.values()];

  if (quotes.length === 0) {
    throw new Error("ZenQuotes did not return any usable quotes.");
  }

  return quotes;
}

async function fetchBatchQuotes(fetchImpl: FetchLike) {
  const response = await fetchImpl(ZEN_QUOTES_BATCH_URL, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`ZenQuotes request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  return normalizeZenQuotesPayload(payload);
}

export function createHomeQuoteService(options: QuoteServiceOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const state: QuoteCacheState = {
    queue: [],
    fetchedAt: null,
    refreshPromise: null,
  };

  const isExpired = () =>
    state.fetchedAt === null || now() - state.fetchedAt >= CACHE_MAX_AGE_MS;

  const refreshQueue = async () => {
    if (!state.refreshPromise) {
      state.refreshPromise = (async () => {
        const quotes = await fetchBatchQuotes(fetchImpl);
        state.queue = shuffleQuotes(quotes);
        state.fetchedAt = now();
      })();
    }

    try {
      await state.refreshPromise;
    } finally {
      state.refreshPromise = null;
    }
  };

  const ensureQueue = async () => {
    const hadCachedQuotes = state.queue.length > 0;

    if (!hadCachedQuotes || isExpired()) {
      try {
        await refreshQueue();
      } catch (error) {
        if (!hadCachedQuotes) {
          throw new AppError({
            statusCode: 503,
            code: "INTERNAL_ERROR",
            message: "Motivational quote is unavailable right now.",
          });
        }
      }
    }

    if (state.queue.length === 0) {
      throw new AppError({
        statusCode: 503,
        code: "INTERNAL_ERROR",
        message: "Motivational quote is unavailable right now.",
      });
    }
  };

  return {
    async getQuote() {
      await ensureQueue();

      const nextQuote = state.queue.shift();

      if (!nextQuote) {
        throw new AppError({
          statusCode: 503,
          code: "INTERNAL_ERROR",
          message: "Motivational quote is unavailable right now.",
        });
      }

      return nextQuote;
    },
  };
}
