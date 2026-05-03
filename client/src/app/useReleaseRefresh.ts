import { useEffect } from "react";

const RELEASE_MANIFEST_URL = "/release.json";
const RELEASE_CHECK_INTERVAL_MS = 60_000;
const RELEASE_RELOAD_STORAGE_PREFIX = "life-os-release-reload";

const readSessionValue = (key: string) => {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeSessionValue = (key: string, value: string) => {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // A blocked sessionStorage should not prevent a release refresh.
  }
};

const readReleaseId = (metadata: unknown) => {
  if (!metadata || typeof metadata !== "object" || !("id" in metadata)) {
    return null;
  }

  const releaseId = (metadata as { id?: unknown }).id;

  if (typeof releaseId !== "string") {
    return null;
  }

  return releaseId.trim() || null;
};

const fetchLatestReleaseId = async () => {
  const response = await fetch(`${RELEASE_MANIFEST_URL}?t=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    return null;
  }

  return readReleaseId(await response.json());
};

const reloadOnce = (reason: string, releaseId: string) => {
  const storageKey = `${RELEASE_RELOAD_STORAGE_PREFIX}:${reason}`;

  if (readSessionValue(storageKey) === releaseId) {
    return;
  }

  writeSessionValue(storageKey, releaseId);
  window.location.reload();
};

export const useReleaseRefresh = () => {
  useEffect(() => {
    if (!import.meta.env.PROD) {
      return;
    }

    let isStopped = false;
    let isChecking = false;
    const currentReleaseId = __LIFE_OS_RELEASE__;

    const checkForRelease = async () => {
      if (isStopped || isChecking) {
        return;
      }

      isChecking = true;

      try {
        const latestReleaseId = await fetchLatestReleaseId();

        if (!isStopped && latestReleaseId && latestReleaseId !== currentReleaseId) {
          reloadOnce("manifest", latestReleaseId);
        }
      } catch {
        // Keep the app usable if the deploy manifest is temporarily unreachable.
      } finally {
        isChecking = false;
      }
    };

    const handleFocus = () => {
      void checkForRelease();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void checkForRelease();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForRelease();
      }
    };

    const handlePreloadError = (event: Event) => {
      event.preventDefault();
      reloadOnce("preload-error", currentReleaseId);
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("vite:preloadError", handlePreloadError);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void checkForRelease();
    const intervalId = window.setInterval(checkForRelease, RELEASE_CHECK_INTERVAL_MS);

    return () => {
      isStopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("vite:preloadError", handlePreloadError);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
};
