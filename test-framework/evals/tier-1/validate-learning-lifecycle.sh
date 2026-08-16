#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/repo/.svc" "$TMP/repo/references" "$TMP/repo/docs/learnings"
git -C "$TMP/repo" init -q; git -C "$TMP/repo" config user.name fixture; git -C "$TMP/repo" config user.email fixture@example.invalid
cat > "$TMP/repo/references/framework-learnings.jsonl" <<'JSONL'
{"id":"legacy-id","insight":"numeric strings normalize","confidence":"8","files":["a.js"]}
{"key":"bad","insight":"bad confidence","confidence":"8x"}
JSONL
printf '' > "$TMP/repo/docs/learnings/learnings.jsonl"
git -C "$TMP/repo" add .; git -C "$TMP/repo" commit -qm init
if node "$ROOT/scripts/learning-lifecycle.mjs" normalize --root "$TMP/repo" > "$TMP/normalized.json"; then echo "expected malformed report status" >&2; exit 1; fi
node -e 'const v=require(process.argv[1]);if(v.learnings[0].key!=="legacy-id"||v.learnings[0].confidence!==8||v.findings.length!==1)process.exit(1)' "$TMP/normalized.json"
if node "$ROOT/scripts/learning-lifecycle.mjs" record --root "$TMP/repo" --key legacy-id --decision used 2> "$TMP/no-outcome.err"; then echo "used without outcome passed" >&2; exit 1; fi
mkdir -p "$TMP/repo/.svc/learning-outcomes" "$TMP/repo/.svc/evaluations"
printf 'product proof\n' > "$TMP/repo/product-proof.txt"
mkdir -p "$TMP/repo/docs/specs/rules-evaluation/learning-fixture" "$TMP/repo/rules"
printf 'fixture rule\n' > "$TMP/repo/rules/learning-fixture.md"
printf 'default\n' > "$TMP/repo/docs/specs/rules-evaluation/learning-fixture/default-transcript.md"
printf 'independent diff\n' > "$TMP/repo/docs/specs/rules-evaluation/learning-fixture/diff-and-verdict.md"
printf '%s\n' '{"rule_path":"rules/learning-fixture.md","rule_type":"correction","scope":"global","stack":"universal","verdict":"adopt-as-is","scores":{"determinism_gain":3,"correctness_delta":2,"friction_cost":0,"convention_conflict":0},"scenarios_evaluated":3,"tier2_ran":true,"tier2_verdict":"confirmed","evidence":{"default_transcript":"docs/specs/rules-evaluation/learning-fixture/default-transcript.md","diff_and_verdict":"docs/specs/rules-evaluation/learning-fixture/diff-and-verdict.md"},"suggested_registry_entry":{"path":"rules/learning-fixture.md","type":"correction","scope":"global","stack":"universal","source":"local","last_evaluated":"2026-08-15","source_sha":null},"evaluated_at":"2026-08-15"}' > "$TMP/repo/docs/specs/rules-evaluation/learning-fixture/verdict.json"
git -C "$TMP/repo" add product-proof.txt rules docs/specs/rules-evaluation; git -C "$TMP/repo" commit -qm 'candidate proof'
PROOF_SHA="$(sha256sum "$TMP/repo/product-proof.txt" | awk '{print $1}')"; CANDIDATE_SHA="$(git -C "$TMP/repo" rev-parse HEAD)"
printf 'untracked proof\n' > "$TMP/repo/untracked-proof.txt"; UNTRACKED_SHA="$(sha256sum "$TMP/repo/untracked-proof.txt" | awk '{print $1}')"
printf '{"schema_version":1,"learning_key":"legacy-id","result":"used","candidate_sha":"%s","evidence":[{"path":"untracked-proof.txt","sha256":"%s"}]}\n' "$CANDIDATE_SHA" "$UNTRACKED_SHA" > "$TMP/repo/.svc/learning-outcomes/untracked.json"
if node "$ROOT/scripts/learning-lifecycle.mjs" record --root "$TMP/repo" --key legacy-id --decision used --outcome "$TMP/repo/.svc/learning-outcomes/untracked.json" >/dev/null 2>&1; then echo "untracked proof received framework credit" >&2; exit 1; fi
printf '{"schema_version":1,"learning_key":"legacy-id","result":"used","candidate_sha":"%s","evidence":[{"path":"product-proof.txt","sha256":"%s"}]}\n' "$CANDIDATE_SHA" "$PROOF_SHA" > "$TMP/repo/.svc/learning-outcomes/legacy-id.json"
node "$ROOT/scripts/learning-lifecycle.mjs" record --root "$TMP/repo" --key legacy-id --decision used --outcome "$TMP/repo/.svc/learning-outcomes/legacy-id.json" >/dev/null
OUTCOME_SHA="$(sha256sum "$TMP/repo/.svc/learning-outcomes/legacy-id.json" | awk '{print $1}')"
node --input-type=module - "$ROOT" "$TMP/repo" "$CANDIDATE_SHA" "$OUTCOME_SHA" <<'NODE_ADAPTER'
import crypto from 'node:crypto';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const [root,repo,candidateSha,outcomeSha]=process.argv.slice(2);const {createExternalReviewFixture}=await import(pathToFileURL(path.join(root,'test-framework/evals/tier-1/fixtures/external-review-fixture.mjs')));const external=createExternalReviewFixture({frameworkRoot:root,repo,reviewKind:'exec',candidateSha});const candidateDigest=external.candidateDigest;const verdictPath='docs/specs/rules-evaluation/learning-fixture/verdict.json';const verdictSha=crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,verdictPath))).digest('hex');
const adapter={schema_version:2,skill:'evaluate-rule',learning_key:'legacy-id',candidate_sha:candidateSha,outcome_sha256:outcomeSha,verdict_path:verdictPath,verdict_sha256:verdictSha,candidate_digest:candidateDigest,self_review:{orchestrator:'codex',findings_count:0,notes:'evaluate-rule self review'},reviewer_evidence:external.reviewerEvidence};fs.writeFileSync(path.join(repo,'.svc/evaluations/legacy-id.json'),JSON.stringify(adapter));
NODE_ADAPTER
node "$ROOT/scripts/learning-lifecycle.mjs" elevate --root "$TMP/repo" --key legacy-id --evaluation "$TMP/repo/.svc/evaluations/legacy-id.json" >/dev/null
node --input-type=module - "$ROOT" "$TMP/repo" <<'NODE'
import {pathToFileURL} from 'node:url'; import path from 'node:path';
const {hasFrameworkLearningCredit}=await import(pathToFileURL(path.join(process.argv[2],'scripts/learning-lifecycle.mjs')));
if(!hasFrameworkLearningCredit(process.argv[3],'legacy-id'))process.exit(1);
NODE
printf '{"schema_version":1,"skill":"evaluate-rule","verdict":"pass","learning_key":"legacy-id","candidate_sha":"%s","outcome_sha256":"deadbeef","evaluator":{"independent":true,"principal":"fixture"},"evidence":[{"path":"product-proof.txt","sha256":"%s"}]}\n' "$CANDIDATE_SHA" "$PROOF_SHA" > "$TMP/repo/.svc/evaluations/forged.json"
if node "$ROOT/scripts/learning-lifecycle.mjs" elevate --root "$TMP/repo" --key legacy-id --evaluation "$TMP/repo/.svc/evaluations/forged.json" >/dev/null 2>&1; then echo "forged outcome link passed" >&2; exit 1; fi
if node "$ROOT/scripts/learning-lifecycle.mjs" federate --root "$TMP/repo" --source-root "$TMP" 2> "$TMP/federate.err"; then echo "unallowed federation passed" >&2; exit 1; fi
ln -s "$TMP/repo" "$TMP/repo-link"
if node "$ROOT/scripts/learning-lifecycle.mjs" normalize --root "$TMP/repo-link" 2> "$TMP/root-symlink.err"; then echo "symlinked lifecycle root passed" >&2; exit 1; fi
grep -q 'insecure federated root' "$TMP/root-symlink.err"
mkdir -p "$TMP/allowed-source/references" "$TMP/allowed-source/docs/learnings"
printf '' > "$TMP/allowed-source/references/framework-learnings.jsonl"
printf '' > "$TMP/allowed-source/docs/learnings/learnings.jsonl"
ln -s "$TMP/allowed-source" "$TMP/allowed-source-link"
if SVC_FEDERATED_PROJECT_ROOTS="$TMP/allowed-source" node "$ROOT/scripts/learning-lifecycle.mjs" federate --root "$TMP/repo" --source-root "$TMP/allowed-source-link" 2> "$TMP/source-symlink.err"; then echo "symlinked federation source passed" >&2; exit 1; fi
grep -q 'insecure federated root' "$TMP/source-symlink.err"
grep -q '"event":"consumption"' "$TMP/repo/.svc/learning-lifecycle.jsonl"
grep -q '"event":"elevated"' "$TMP/repo/.svc/learning-lifecycle.jsonl"
echo "PASS: learning lifecycle normalizes, reports, outcome-links, evaluates, and fences federation including symlink roots"
