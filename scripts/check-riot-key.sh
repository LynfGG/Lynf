#!/usr/bin/env sh
# Refuses any change that adds a Riot API key.
#
#   sh scripts/check-riot-key.sh                    the staged changes (pre-commit hook)
#   sh scripts/check-riot-key.sh origin/develop..HEAD  every commit in a range (CI)
#
# The range form catches what a local hook never sees: a commit made with --no-verify,
# one made on GitHub, or a key added in one commit and removed in the next — merges keep
# every commit, so that key would still land in the history.
#
# GitHub's secret scanning does not know the Riot key format, so nothing upstream
# catches this mistake. A key that reaches a commit is compromised even if the
# commit is removed afterwards: revoke it and generate a new one.

PATTERN='RGAPI-[0-9a-fA-F]\{8\}-[0-9a-fA-F]\{4\}-[0-9a-fA-F]\{4\}-[0-9a-fA-F]\{4\}-[0-9a-fA-F]\{12\}'
RANGE="$1"

# Every change except deletions. Renamed and copied files must be read too: a key
# added while moving a file would otherwise go unnoticed. Merge commits are read against
# their first parent: a key typed while resolving a conflict exists in no other commit.
changes() {
    if [ -z "$RANGE" ]; then
        git diff --cached -U0 --diff-filter=d "$@"
    else
        git log -p -U0 --format= --diff-merges=first-parent --diff-filter=d "$RANGE" "$@"
    fi
}

changed_files() {
    if [ -z "$RANGE" ]; then
        git diff --cached --name-only --diff-filter=d
    else
        git log --format= --name-only --diff-merges=first-parent --diff-filter=d "$RANGE" |
            sort -u
    fi
}

if changes | grep -q "^+.*$PATTERN"; then
    echo ''
    echo "  A Riot API key was found in ${RANGE:-the staged changes}."
    echo ''
    echo '  The key belongs in .env, which is ignored by git — never in a commit.'
    echo '  If this key has already been pushed anywhere, revoke it and generate a new one.'
    echo ''
    changed_files | while read -r file; do
        if changes -- "$file" | grep -q "^+.*$PATTERN"; then
            echo "    $file"
        fi
    done
    echo ''
    exit 1
fi

exit 0
