import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

type FeedbackTone = "success" | "error";

type FeedbackItem = {
  id: number;
  message: string;
  tone: FeedbackTone;
};

type MutationFeedbackMeta = {
  successMessage?: string;
  errorMessage?: string;
};

type AppFeedbackContextValue = {
  pushFeedback: (message: string, tone: FeedbackTone) => void;
};

const AppFeedbackContext = createContext<AppFeedbackContextValue | null>(null);

function FeedbackViewport({
  items,
  onDismiss,
}: {
  items: FeedbackItem[];
  onDismiss: (id: number) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="feedback-stack" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          className={`feedback-toast feedback-toast--${item.tone}`}
          role="status"
        >
          <span>{item.message}</span>
          <button
            aria-label="Dismiss message"
            className="feedback-toast__dismiss"
            onClick={() => onDismiss(item.id)}
            type="button"
          >
            Close
          </button>
        </div>
      ))}
    </div>
  );
}

function readMutationMeta(meta: unknown): MutationFeedbackMeta {
  if (!meta || typeof meta !== "object") {
    return {};
  }

  return meta as MutationFeedbackMeta;
}

function readErrorMessage(error: unknown, fallback = "Action failed. Try again.") {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function useAppFeedback() {
  const context = useContext(AppFeedbackContext);

  if (!context) {
    throw new Error("useAppFeedback must be used within AppProviders");
  }

  return context;
}

export function AppProviders({ children }: PropsWithChildren) {
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const pushFeedback = useMemo(
    () => (message: string, tone: FeedbackTone) => {
      const id = Date.now() + Math.floor(Math.random() * 10_000);

      setFeedbackItems((current) => [...current, { id, message, tone }].slice(-4));
      window.setTimeout(() => {
        setFeedbackItems((current) => current.filter((item) => item.id !== id));
      }, 4500);
    },
    [],
  );
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            const meta = readMutationMeta(mutation.meta);
            pushFeedback(meta.errorMessage ?? readErrorMessage(error), "error");
          },
          onSuccess: (_data, _variables, _context, mutation) => {
            const meta = readMutationMeta(mutation.meta);

            if (meta.successMessage) {
              pushFeedback(meta.successMessage, "success");
            }
          },
        }),
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <AppFeedbackContext.Provider value={{ pushFeedback }}>
      <QueryClientProvider client={queryClient}>
        {children}
        <FeedbackViewport
          items={feedbackItems}
          onDismiss={(id) =>
            setFeedbackItems((current) => current.filter((item) => item.id !== id))
          }
        />
      </QueryClientProvider>
    </AppFeedbackContext.Provider>
  );
}
