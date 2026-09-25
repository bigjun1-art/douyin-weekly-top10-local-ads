#!/bin/bash
set -euo pipefail

HOST=""
IDENTITY_KEY=""
IDENTITY_VALUE=""
PATH_CONTAINS=""
CODE=""
ACTIVATE="false"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --host) HOST="${2:-}"; shift 2 ;;
        --identity-key) IDENTITY_KEY="${2:-}"; shift 2 ;;
        --identity-value) IDENTITY_VALUE="${2:-}"; shift 2 ;;
        --path-contains) PATH_CONTAINS="${2:-}"; shift 2 ;;
        --code) CODE="${2:-}"; shift 2 ;;
        --activate) ACTIVATE="true"; shift ;;
        *) echo "ERROR: unknown argument: $1" >&2; exit 2 ;;
    esac
done

case "$HOST" in
    localads.chengzijianzhan.cn)
        [[ "$IDENTITY_KEY" == "advid" && "$IDENTITY_VALUE" =~ ^[0-9]+$ ]] || { echo "ERROR: localads requires numeric advid" >&2; exit 2; }
        ;;
    www.life-data.cn)
        [[ "$IDENTITY_KEY" == "groupid" && "$IDENTITY_VALUE" =~ ^[0-9]+$ ]] || { echo "ERROR: life-data requires numeric groupid" >&2; exit 2; }
        ;;
    *) echo "ERROR: host is not allowed" >&2; exit 2 ;;
esac

[[ "$PATH_CONTAINS" =~ ^/[A-Za-z0-9_./%-]+$ ]] || { echo "ERROR: invalid --path-contains" >&2; exit 2; }
[[ -n "$CODE" ]] || { echo "ERROR: --code is required" >&2; exit 2; }

CODE_B64=$(printf '%s' "$CODE" | base64 | tr -d '\n')
EVAL_CODE="(()=>{try{const r=eval(new TextDecoder().decode(Uint8Array.from(atob('$CODE_B64'),c=>c.charCodeAt(0))));return JSON.stringify({ok:true,result:r===undefined?null:r})}catch(e){return JSON.stringify({ok:false,error:String(e&&e.stack||e)})}})()"

RESULT=$(osascript <<EOF
tell application "Google Chrome"
    set targetCount to 0
    set targetTab to missing value
    set targetWindow to missing value
    set targetTabIndex to 0
    repeat with w from 1 to count of windows
        repeat with t from 1 to count of tabs of window w
            set tabURL to URL of tab t of window w
            if tabURL contains "$HOST$PATH_CONTAINS" and tabURL contains "$IDENTITY_KEY=$IDENTITY_VALUE" then
                set targetCount to targetCount + 1
                set targetTab to tab t of window w
                set targetWindow to window w
                set targetTabIndex to t
            end if
        end repeat
    end repeat
    if targetCount is 0 then return "ERROR: exact target tab not found"
    if targetCount is not 1 then return "ERROR: exact target tab is not unique; count=" & targetCount
    if "$ACTIVATE" is "true" then
        set index of targetWindow to 1
        set active tab index of targetWindow to targetTabIndex
        activate
    end if
    try
        return execute targetTab javascript "$EVAL_CODE"
    on error errMsg
        return "ERROR: evaluation failed - " & errMsg
    end try
end tell
EOF
)

echo "$RESULT"
if [[ "$RESULT" == ERROR:* ]] || [[ "$RESULT" == *'"ok":false'* ]]; then exit 1; fi
