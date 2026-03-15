#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  run_frontend_copilot.sh --prompt-file <path> [options]

Options:
  --prompt-file <path>   Markdown or text file containing the Copilot prompt.
  --workdir <path>       Repository root to run Copilot from. Defaults to cwd.
  --model <name>         Copilot model to use. Defaults to gpt-5.3-codex.
  --add-dir <path>       Additional allowed directory. Can be passed multiple times.
  --dry-run              Print the final Copilot command without executing it.
  --help                 Show this help text.
EOF
}

prompt_file=""
workdir="$(pwd)"
model="gpt-5.3-codex"
dry_run="false"
declare -a extra_dirs=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt-file)
      prompt_file="${2:-}"
      shift 2
      ;;
    --workdir)
      workdir="${2:-}"
      shift 2
      ;;
    --model)
      model="${2:-}"
      shift 2
      ;;
    --add-dir)
      extra_dirs+=("${2:-}")
      shift 2
      ;;
    --dry-run)
      dry_run="true"
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$prompt_file" ]]; then
  echo "--prompt-file is required" >&2
  usage >&2
  exit 1
fi

if [[ ! -f "$prompt_file" ]]; then
  echo "Prompt file not found: $prompt_file" >&2
  exit 1
fi

if [[ ! -d "$workdir" ]]; then
  echo "Workdir not found: $workdir" >&2
  exit 1
fi

prompt_contents="$(cat "$prompt_file")"

command=(
  copilot
  --model "$model"
  --prompt "$prompt_contents"
  --allow-all-tools
  --no-ask-user
  --no-custom-instructions
  --silent
  --add-dir "$workdir"
)

for dir in "${extra_dirs[@]}"; do
  command+=(--add-dir "$dir")
done

if [[ "$dry_run" == "true" ]]; then
  printf 'cd %q && ' "$workdir"
  printf '%q ' "${command[@]}"
  printf '\n'
  exit 0
fi

cd "$workdir"
exec "${command[@]}"
