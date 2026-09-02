#!/usr/bin/env bash
# ============================================================
# Veroeffentlicht prototype/ als GitHub-Pages-Seite.
#
# Der Inhalt von prototype/ wird zur Wurzel des Branches
# gh-pages — deshalb funktionieren die relativen Pfade des
# Prototyps unter der Unterverzeichnis-URL unveraendert.
#
# Bewusst KEIN GitHub-Actions-Deploy: dafuer braeuchte das
# Token den workflow-Scope, den dieses Konto nicht hat. Sobald
# er da ist (gh auth refresh -s workflow), kann das hier durch
# einen Workflow ersetzt werden.
#
# --force ist noetig und unbedenklich: der Branch ist ein reines
# Veroeffentlichungsziel, seine Historie ist wegwerfbar.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH="${1:-main}"
echo "Veroeffentliche prototype/ aus '$BRANCH' nach gh-pages …"
SPLIT=$(git subtree split --prefix=prototype "$BRANCH")
git push origin "$SPLIT:refs/heads/gh-pages" --force
echo
echo "Fertig. In ein bis zwei Minuten hier abrufbar:"
echo "  https://hey1marvin.github.io/takeoff-website/"
