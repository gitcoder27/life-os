#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOC_ROOT="/var/www/personal.daycommand.online"
SERVICE_NAME="life-os.service"
HEALTH_URL="http://127.0.0.1:3104/healthz"
PRISMA_SCHEMA_PATH="server/prisma/schema.prisma"
SERVER_ENV_FILE="server/.env.production"
NGINX_SITE_NAME="personal.daycommand.online"
NGINX_CONFIG_SOURCE="deploy/nginx/${NGINX_SITE_NAME}.conf"
NGINX_CONFIG_TARGET="/etc/nginx/sites-available/${NGINX_SITE_NAME}"
NGINX_CONFIG_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE_NAME}"
service_stopped=0

cd "$REPO_ROOT"

log() {
  printf '[deploy] %s\n' "$1"
}

fail() {
  printf '[deploy] %s\n' "$1" >&2
  exit 1
}

restore_service_on_error() {
  local exit_code=$?

  if [[ $exit_code -ne 0 && $service_stopped -eq 1 ]]; then
    printf '[deploy] Deploy failed after stopping the API service. Attempting to start it again.\n' >&2
    sudo systemctl start "$SERVICE_NAME" || true
  fi

  exit "$exit_code"
}

wait_for_health() {
  local attempts=30
  local delay_seconds=1

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl -fsS "$HEALTH_URL" >/dev/null; then
      return 0
    fi

    sleep "$delay_seconds"
  done

  fail "API health check did not succeed within ${attempts} seconds."
}

require_file() {
  local path="$1"

  if [[ ! -f "$path" ]]; then
    fail "Missing required file: $path"
  fi
}

restore_lockfile_if_only_local_change() {
  local tracked_changes
  local non_lock_changes
  local untracked_changes

  tracked_changes="$(git diff --name-only HEAD --)"
  untracked_changes="$(git ls-files --others --exclude-standard)"

  if [[ -z "$tracked_changes" || -n "$untracked_changes" ]]; then
    return
  fi

  non_lock_changes="$(printf '%s\n' "$tracked_changes" | grep -vx "package-lock.json" || true)"

  if [[ -n "$non_lock_changes" ]]; then
    return
  fi

  log "Restoring local package-lock.json drift before deploy"
  git restore --source=HEAD --staged --worktree package-lock.json
}

read_env_value() {
  local path="$1"
  local key="$2"

  awk -F= -v target="$key" '$1 == target { sub(/^[^=]*=/, "", $0); print $0; exit }' "$path"
}

require_clean_git_state() {
  if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
    fail "Working tree is not clean. Commit, stash, or remove local changes before running deploy:prod."
  fi
}

pull_latest_code() {
  local before_commit
  local after_commit

  before_commit="$(git rev-parse HEAD)"

  log "Pulling latest code"
  git pull --ff-only

  after_commit="$(git rev-parse HEAD)"

  if [[ "${LIFE_OS_DEPLOY_REEXECUTED:-0}" != "1" && "$before_commit" != "$after_commit" ]]; then
    log "Restarting deploy script after pulling updated code"
    export LIFE_OS_DEPLOY_REEXECUTED=1
    exec "$BASH" "$0"
  fi
}

refresh_nginx_config() {
  local backup_path=""
  local had_existing_config=0

  if [[ -f "$NGINX_CONFIG_TARGET" ]]; then
    backup_path="$(mktemp)"
    had_existing_config=1
    sudo cp "$NGINX_CONFIG_TARGET" "$backup_path"
  fi

  sudo install -m 644 "$NGINX_CONFIG_SOURCE" "$NGINX_CONFIG_TARGET"
  sudo ln -sfn "$NGINX_CONFIG_TARGET" "$NGINX_CONFIG_ENABLED"

  if sudo nginx -t && sudo systemctl reload nginx; then
    if [[ -n "$backup_path" ]]; then
      sudo rm -f "$backup_path"
    fi

    return
  fi

  if [[ $had_existing_config -eq 1 ]]; then
    sudo cp "$backup_path" "$NGINX_CONFIG_TARGET"
    sudo nginx -t >/dev/null 2>&1 || true
  else
    sudo rm -f "$NGINX_CONFIG_TARGET" "$NGINX_CONFIG_ENABLED"
  fi

  if [[ -n "$backup_path" ]]; then
    sudo rm -f "$backup_path"
  fi

  fail "Nginx config validation failed; restored previous config."
}

require_file "server/.env.production"
require_file "client/.env.production"
restore_lockfile_if_only_local_change
require_clean_git_state

trap restore_service_on_error EXIT

pull_latest_code
require_file "$NGINX_CONFIG_SOURCE"

server_csrf_cookie="$(read_env_value "server/.env.production" "CSRF_COOKIE_NAME")"
client_csrf_cookie="$(read_env_value "client/.env.production" "VITE_CSRF_COOKIE_NAME")"

if [[ -z "$server_csrf_cookie" || -z "$client_csrf_cookie" ]]; then
  fail "Missing CSRF cookie configuration in server/.env.production or client/.env.production."
fi

if [[ "$server_csrf_cookie" != "$client_csrf_cookie" ]]; then
  fail "CSRF cookie mismatch: server=${server_csrf_cookie} client=${client_csrf_cookie}"
fi

log "Installing dependencies"
npm ci

log "Building contracts, server, and client"
npm run build

log "Stopping API service"
sudo systemctl stop "$SERVICE_NAME"
service_stopped=1

log "Applying production database migrations"
set -a
source "$SERVER_ENV_FILE"
set +a
npx prisma migrate deploy --schema "$PRISMA_SCHEMA_PATH"

log "Publishing frontend bundle to nginx doc root"
sudo rsync -a --delete client/dist/ "$DOC_ROOT/"

log "Refreshing nginx static cache policy"
refresh_nginx_config

log "Starting API service"
sudo systemctl start "$SERVICE_NAME"
service_stopped=0

log "Checking API health"
wait_for_health

log "Checking service status"
systemctl is-active "$SERVICE_NAME" >/dev/null

current_commit="$(git rev-parse --short HEAD)"
log "Deploy complete at commit $current_commit"
