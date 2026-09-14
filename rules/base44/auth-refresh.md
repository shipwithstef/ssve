# Base44 Auth Refresh — Try Programmatic Before Asking User

When a Base44 API call returns `HTTPException: Could not validate credentials` or HTTP 401, do NOT immediately ask the user to re-login. The Base44 CLI auto-refreshes via OAuth and an agent can mimic that flow before falling back to interactive login.

## Recipe

```bash
# 1. Read the cached token
ACCESS_TOKEN=$(jq -r '.accessToken' ~/.base44/auth/auth.json)
REFRESH_TOKEN=$(jq -r '.refreshToken' ~/.base44/auth/auth.json)
EXPIRES_AT=$(jq -r '.expiresAt' ~/.base44/auth/auth.json)

# 2. Check expiry FIRST (cheap)
NOW=$(date +%s%3N)
if [ "$NOW" -lt "$EXPIRES_AT" ]; then
  echo "token still valid"
fi

# 3. Try OAuth refresh against /oauth/token (the actual base44 CLI endpoint)
curl -s -X POST "https://app.base44.com/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "User-Agent: Base44 CLI" \
  --data-urlencode "grant_type=refresh_token" \
  --data-urlencode "refresh_token=$REFRESH_TOKEN" \
  --data-urlencode "client_id=base44_cli"
# Success: 200 with {accessToken, refreshToken, expiresAt, ...}
# Failure: 400 {"error":"invalid_grant","error_description":"Refresh token is invalid or expired"}
```

## When the refresh succeeds — write back to auth.json atomically

```bash
NEW=$(curl -s -X POST "https://app.base44.com/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "User-Agent: Base44 CLI" \
  --data-urlencode "grant_type=refresh_token" \
  --data-urlencode "refresh_token=$REFRESH_TOKEN" \
  --data-urlencode "client_id=base44_cli")

if echo "$NEW" | jq -e .accessToken >/dev/null 2>&1; then
  # Merge: keep email/name, update tokens
  jq --argjson new "$NEW" '. + $new' ~/.base44/auth/auth.json > /tmp/auth.json.new && \
    mv /tmp/auth.json.new ~/.base44/auth/auth.json
fi
```

## When refresh ALSO fails — only THEN ask for re-login

If the refresh returns `invalid_grant` (refresh token expired — typically after ~30 days), the only path is interactive:

> "Base44 access AND refresh tokens are both expired. Run `base44 login` (or `! base44 login` in this session) to re-authenticate. The login is a browser device-code flow; takes ~30 seconds."

## Why this matters

- Access tokens expire often (~1 day per observed `expiresAt` deltas)
- Refresh tokens expire less often (~30 days)
- Asking the user to log in for every access-token expiry burns trust and time
- The CLI's own auth client at `~/.nvm/versions/node/*/lib/node_modules/base44/dist/cli/index.js` does this same dance — `renewAccessToken` function around line 243568

## Origin of this rule

Captured 2026-04-25 during WI-108 autonomous-execution attempt. Token had been expired 2 days; the agent reflexively asked the user to re-login without first attempting the documented refresh flow. Refresh turned out to also be expired in this case (>2 days), but that's not knowable without trying.

## Don't

- Don't pass refresh token via `Cookie:` header — that's not the endpoint contract
- Don't hit `/api/auth/refresh` — wrong path, returns "Missing refresh token" regardless of payload
- Don't write a new entity schema or call `coding/write` while auth is expired — will return cryptic 401, not a useful schema diff
