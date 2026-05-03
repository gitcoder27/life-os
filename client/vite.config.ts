import { execFileSync } from "node:child_process";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

type ReleaseMetadata = {
  id: string;
  commit: string;
  builtAt: string;
};

const readGitCommit = () => {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
};

const createReleaseMetadata = (releaseIdOverride?: string): ReleaseMetadata => {
  const commit = readGitCommit();
  const builtAt = new Date().toISOString();
  const explicitReleaseId = releaseIdOverride?.trim();

  return {
    id: explicitReleaseId || `${commit}-${builtAt}`,
    commit,
    builtAt,
  };
};

const releaseManifestPlugin = (metadata: ReleaseMetadata): Plugin => ({
  name: "life-os-release-manifest",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "release.json",
      source: `${JSON.stringify(metadata, null, 2)}\n`,
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const releaseMetadata = createReleaseMetadata(env.VITE_RELEASE_ID);

  return {
    plugins: [react(), releaseManifestPlugin(releaseMetadata)],
    define: {
      __LIFE_OS_RELEASE__: JSON.stringify(releaseMetadata.id),
    },
    server: {
      port: Number(env.VITE_PORT || 5174),
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3004",
          changeOrigin: true,
        },
      },
    },
  };
});
