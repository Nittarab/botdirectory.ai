/** Worker bindings / secrets for api.botdirectory.ai. */
export interface Env {
  /** Shared write key. Send as `Authorization: Bearer <key>` or `X-Api-Key`. */
  API_WRITE_KEY: string;
  /** GitHub PAT (or GitHub App token) that can open PRs / issues on GITHUB_REPO. */
  GITHUB_TOKEN: string;
  /** owner/name, default elie222/botdirectory.ai */
  GITHUB_REPO?: string;
  /** Origin of the static site feed, default https://botdirectory.ai */
  SITE_ORIGIN?: string;
  /** Optional KV for copy counters. When unset, /api/copies is a harmless stub. */
  COPIES?: KVNamespace;
}
