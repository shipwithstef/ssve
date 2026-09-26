#!/usr/bin/env node
import { resolveHookMode, hookPolicyWarning } from "../hooks/lib/hook-policy.mjs";

const result = resolveHookMode();
hookPolicyWarning(result);
process.stdout.write(result.mode + "\n");
