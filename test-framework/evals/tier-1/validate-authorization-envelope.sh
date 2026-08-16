#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/repo/.svc"
printf '%s\n' '{"ts":"2026-08-15T00:00:00Z","authorization_envelope":{"rules":[{"id":"staging-smoke","action":"deploy","environment":"staging","purpose":"verify-WI-541","decision":"allow"}]}}' > "$TMP/repo/.svc/session-contract.jsonl"
node --input-type=module - "$ROOT" "$TMP/repo" <<'NODE'
import assert from "node:assert/strict"; import path from "node:path"; import { pathToFileURL } from "node:url"; import { performance } from "node:perf_hooks";
const {evaluateAuthorization,authorizeObservedAction,classifyOutwardAction}=await import(pathToFileURL(path.join(process.argv[2],"scripts/svc-authorized-action.mjs")));
const contract={authorization_envelope:{rules:[{id:"x",action:"deploy",environment:"staging",purpose:"verify",decision:"allow"}]}};
assert.equal(evaluateAuthorization({},{}).decision,"legacy-allow"); assert.equal(evaluateAuthorization(contract,{action:"deploy",environment:"staging",purpose:"verify"}).allow,true); assert.equal(evaluateAuthorization(contract,{action:"deploy",environment:"prod",purpose:"verify"}).allow,false);
assert.equal(evaluateAuthorization({authorization_envelope:"legacy prose"},{}).decision,"legacy-allow");
for(const malformed of [{authorization_envelope:{}},{authorization_envelope:{rules:{}}},{authorization_envelope:{rules:[{action:"deploy"}]}},{authorization_envelope:{rules:[{action:"deploy",environment:"prod",purpose:"x",decision:"allow"},{action:"deploy",environment:"prod",purpose:"x",decision:"deny"}]}}]) assert.equal(evaluateAuthorization(malformed,{}).decision,"deny");
assert.equal(classifyOutwardAction("git push origin main").kind,"git-push");
assert.equal(classifyOutwardAction("env MODE=x git push origin main").kind,"git-push");
assert.equal(classifyOutwardAction("git -C . push origin main").kind,"git-push");
assert.equal(classifyOutwardAction("command curl --json='{\"x\":1}' https://example.invalid").kind,"http-mutation");
assert.equal(classifyOutwardAction("printf ready | env MODE=x git push origin main").kind,"git-push");
assert.equal(classifyOutwardAction("sudo sh -c 'git push origin main'").kind,"git-push");
assert.equal(classifyOutwardAction("sudo -u fixture git push origin main").kind,"git-push");
assert.equal(classifyOutwardAction("curl --json={} https://example.invalid").kind,"http-mutation");
for(const [command,kind] of [
  ["git push origin feature-{a,b}","git-push"],
  ["gh pr create --title={x,y}","github-mutation"],
  ["npm publish --tag={next,latest}","package-publish"],
  ["vercel deploy --meta={x,y}","provider-deploy"],
  ["docker push registry.invalid/x:{a,b}","image-push"],
  ["scp file user@host:/tmp/{a,b}","remote-copy"],
]) assert.equal(classifyOutwardAction(command)?.kind,kind,command);
for(const command of ["curl -d x=1 https://example.invalid","curl -d'{\\\"x\\\":1}' https://example.invalid","curl -d@payload.json https://example.invalid","curl -F'file=@photo.png' https://example.invalid","curl -Tarchive.tgz https://example.invalid","curl --upload-file archive.tgz https://example.invalid","curl --json '{\\\"x\\\":1}' https://example.invalid","curl -XPOST https://example.invalid","curl --request=DELETE https://example.invalid"]) assert.equal(classifyOutwardAction(command).kind,"http-mutation",command);
assert.equal(classifyOutwardAction("curl https://example.invalid/status"),null); assert.equal(classifyOutwardAction("git status"),null);
const root=process.argv[3];
assert.equal(authorizeObservedAction({root,command:"git push origin main",annotation:{action:"deploy",environment:"staging",purpose:"verify-WI-541"}}).allow,false,"a deploy tuple must not authorize git push");
assert.equal(authorizeObservedAction({root,command:"vercel deploy",annotation:{action:"deploy",environment:"staging",purpose:"verify-WI-541"}}).allow,true);
const samples=[];for(let i=0;i<100;i++){const s=performance.now();evaluateAuthorization(contract,{action:"deploy",environment:"staging",purpose:"verify"});samples.push(performance.now()-s);}samples.sort((a,b)=>a-b);assert.ok(samples[94]<5,`p95 ${samples[94]}ms`);
NODE
printf '0\n' > "$TMP/counter"
printf '%s\n' 'const fs=require("fs"),p=process.argv[2];fs.writeFileSync(p,String(Number(fs.readFileSync(p,"utf8"))+1))' > "$TMP/increment.cjs"
if node "$ROOT/scripts/svc-authorized-action.mjs" exec --root "$TMP/repo" --action deploy --environment prod --purpose verify-WI-541 -- node "$TMP/increment.cjs" "$TMP/counter"; then echo "outside envelope executed" >&2; exit 1; fi
test "$(cat "$TMP/counter")" = 0
node "$ROOT/scripts/svc-authorized-action.mjs" exec --root "$TMP/repo" --action deploy --environment staging --purpose verify-WI-541 -- node "$TMP/increment.cjs" "$TMP/counter"
test "$(cat "$TMP/counter")" = 1
node "$ROOT/scripts/svc-authorized-action.mjs" record-stop --root "$TMP/repo" >/dev/null
grep -q 'stop-authorization-summary' "$TMP/repo/.svc/authorization-events.jsonl"
jq -e '.hooks.Stop[] | select(.id == "svc-auto-capture-learnings")' "$ROOT/hooks/hooks.json" >/dev/null
grep -q 'recordStopAuthorizationSummary' "$ROOT/hooks/svc-auto-capture-learnings.mjs"
printf '%s\n' '{malformed' >> "$TMP/repo/.svc/session-contract.jsonl"
if node "$ROOT/scripts/svc-authorized-action.mjs" check --root "$TMP/repo" --action deploy --environment staging --purpose verify-WI-541; then echo "malformed final contract row allowed" >&2; exit 1; fi
sed -i '$d' "$TMP/repo/.svc/session-contract.jsonl"
SVC_AUTO_LEARN_DISABLE=1 SVC_AUTO_LEARN_ROOT="$TMP/repo" node "$ROOT/hooks/svc-auto-capture-learnings.mjs" --trigger stop </dev/null
test "$(grep -c 'stop-authorization-summary' "$TMP/repo/.svc/authorization-events.jsonl")" -ge 2

# The actual Codex dispatcher must resolve the operation worktree first and
# deny an unannotated outward command before binding/lease evaluation.
mkdir -p "$TMP/session/.svc" "$TMP/operation/.svc"
git -C "$TMP/session" init -q; git -C "$TMP/operation" init -q
printf '%s\n' '{"ts":"2026-08-15T00:00:00Z"}' > "$TMP/session/.svc/session-contract.jsonl"
cp "$TMP/repo/.svc/session-contract.jsonl" "$TMP/operation/.svc/session-contract.jsonl"
PAYLOAD=$(printf '{"session_id":"session-auth-fixture","cwd":"%s","tool_name":"Bash","tool_input":{"command":"git push origin main","workdir":"%s"}}' "$TMP/session" "$TMP/operation")
DECISION=$(printf '%s' "$PAYLOAD" | node "$ROOT/hooks/codex/svc-codex-pretool-dispatcher.mjs")
printf '%s' "$DECISION" | grep -q 'requires svc_authorization'
echo "PASS: explicit authorization denies before launch, exact tuples execute, absent envelopes preserve behavior, and Stop records waste"
