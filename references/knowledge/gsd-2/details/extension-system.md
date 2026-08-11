# GSD-2 Extension System — Knowledge Extraction

## 1. Mechanism

### 1.1 Extension Discovery (`src/extension-discovery.ts`)

**Entry-point resolution per directory:**
- `resolveExtensionEntries(dir: string): string[]` — resolves entry-point file(s) for a single extension directory.
  1. If `package.json` exists with a `pi` manifest object (`pkg.pi` is an object), the manifest is authoritative:
     - `pi.extensions` array → resolves each entry relative to the directory.
     - `pi: {}` (no extensions) → returns empty (library opt-out, e.g. cmux).
  2. Only when no `pi` manifest exists does it fall back to `index.ts` → `index.js`.

**Directory scanning:**
- `discoverExtensionEntryPaths(extensionsDir: string): string[]` — discovers all extension entry-point paths under an extensions directory.
  - Top-level `.ts`/`.js` files are treated as standalone extension entry points.
  - Subdirectories are resolved via `resolveExtensionEntries()` (package.json → pi.extensions, then index.ts/index.js fallback).

**Bundled vs installed precedence:**
- `mergeExtensionEntryPaths(bundledPaths: string[], installedExtDir: string): string[]` — installed extensions with the same manifest ID as a bundled extension take precedence (D-14). The loader stays dumb — receives a pre-merged path list (D-15).
  - Builds a map `installedById: Map<string, string[]>` from installed subdirectories.
  - Filters bundled paths: skips any whose manifest id is shadowed by installed.
  - Appends all installed entries.

### 1.2 Extension Registry (`src/extension-registry.ts`)

**Manifest schema (`ExtensionManifest`):**
- `id`, `name`, `version`, `description`, `tier` ("core" | "bundled" | "community"), `requires` ({ platform: string }), `provides` ({ tools?, commands?, hooks?, shortcuts? }), `dependencies` ({ extensions?, runtime? }).

**Registry entry schema (`ExtensionRegistryEntry`):**
- `id`, `enabled`, `source` ("bundled" | "user" | "project"), `disabledAt?`, `disabledReason?`, `version?`, `installedFrom?`, `installType?` ("npm" | "git" | "local").

**Registry persistence:**
- `getRegistryPath(): string` → `<appRoot>/extensions/registry.json`.
- `loadRegistry(): ExtensionRegistry` — reads JSON, validates via `isRegistry()`, returns default on failure.
- `saveRegistry(registry): void` — atomic write via `.tmp` + `renameSync`.

**Enable/disable semantics:**
- `isExtensionEnabled(registry, id): boolean` — missing entries default to enabled.
- `enableExtension(registry, id): void` — clears `disabledAt`/`disabledReason`.
- `disableExtension(registry, id, manifest, reason?): string | null` — returns error string if tier is "core" (cannot disable), or null on success.

**Manifest I/O:**
- `readManifest(extensionDir): ExtensionManifest | null` — reads `extension-manifest.json`.
- `readManifestFromEntryPath(entryPath): ExtensionManifest | null` — resolves parent directory then reads manifest.
- `discoverAllManifests(extensionsDir): Map<string, ExtensionManifest>` — scans subdirectories for manifests.
- `ensureRegistryEntries(extensionsDir): void` — auto-populates registry entries for newly discovered extensions (idempotent).

### 1.3 Extension Package Validator (`src/extension-validator.ts`)

**Validation types:**
- `ValidationError`: `code` ("MISSING_GSD_MARKER" | "RESERVED_NAMESPACE" | "WRONG_DEP_FIELD"), `message`, `field?`.
- `ValidationWarning`: `code`, `message`.
- `ValidationResult`: `valid` (derived as `errors.length === 0`), `errors[]`, `warnings[]`.

**Individual check functions:**
- `checkInstallDiscriminator(pkg): ValidationError | null` — per D-03: requires `pkg.gsd.extension === true` with strict equality (not truthiness). Three-layer validation: pkg must be object → `gsd` must be object → `gsd.extension` must be `true`.
- `checkNamespaceReservation(extensionId, opts): ValidationError | null` — per D-04/D-05: blocks `gsd.*` namespace unless `opts.allowGsdNamespace === true`. Per D-06: only checks extension manifest ID, not `pkg.name`.
- `checkDependencyPlacement(pkg): ValidationError[]` — per D-07/D-08/D-09/D-10: scans `dependencies` and `devDependencies` for `@gsd/*` packages. Returns one error per violation naming exact field and package. `peerDependencies` is the correct placement and is NOT flagged.

**Composite validation:**
- `validateExtensionPackage(pkg, opts): ValidationResult` — runs all three checks in order. If `opts.extensionId` is not provided, skips namespace check and adds a `NAMESPACE_CHECK_SKIPPED` warning.

### 1.4 Topological Sort (`src/extension-sort.ts`)

**Algorithm:** Kahn's BFS algorithm on extension dependency graph.

**Steps:**
1. Build ID map from manifests. Extensions without manifests are prepended in input order (`pathsWithoutId`).
2. Build graph: `inDegree` and `dependents` adjacency maps. Self-dependencies are silently ignored.
3. Missing dependencies produce a structured `SortWarning` but do not block loading.
4. Ready queue (inDegree 0) maintained in alphabetical order.
5. Cycle handling: remaining IDs with inDegree > 0 are appended alphabetically with cycle warnings.

**Exported:**
- `sortExtensionPaths(paths: string[]): SortResult` — returns `{ sortedPaths, warnings }`.

### 1.5 Resource Loader (`src/resource-loader.ts`)

**Resource syncing to `~/.gsd/agent/`:**
- `initResources(agentDir, skillsDir?): void` — syncs bundled resources on every launch.
  - Syncs `extensions/` → `~/.gsd/agent/extensions/`
  - Syncs `agents/` → `~/.gsd/agent/agents/`
  - Syncs `skills/` → `~/.agents/skills/`
  - Syncs `GSD-WORKFLOW.md` → `~/.gsd/agent/GSD-WORKFLOW.md`
  - Skips copy when both version AND content fingerprint match (closes #4787).

**Content fingerprinting:**
- `computeResourceFingerprint(rootDir): string` — walks all files, hashes `${relativePath}:${sha256(contents)}` per file, aggregates into sha256 hex (first 16 chars). Distinguishes same-size edits (#4787).
- `getCurrentResourceFingerprint(): string` — prefers precomputed `.managed-resources-content-hash` file, falls back to `computeResourceFingerprint()`.

**Managed resource manifest:**
- `ManagedResourceManifest`: `gsdVersion`, `syncedAt?`, `contentHash?`, `installedExtensionRootFiles?`, `installedExtensionDirs?`.
- `writeManagedResourceManifest(agentDir): void` — records current bundled root files and subdirectory extension names for future pruning.
- `readManagedResourceVersion(agentDir): string | null`.

**Pruning stale extensions:**
- `pruneRemovedBundledExtensions(manifest, agentDir): void` — two strategies:
  1. Manifest-based: removes previously-installed root files / subdirs no longer in bundle.
  2. Sweep-based: removes any installed extension subdirectory not in current bundle.
  3. Always removes known stale files (e.g. `env-utils.js` → moved to `gsd/` in v2.39.x, #1634).
- `pruneStaleSiblingFiles(srcDir, destDir): void` — removes compiled `.js` siblings when source `.ts` is present (or vice versa) but the bundle no longer provides both.

**Node_modules symlink management:**
- `ensureNodeModulesSymlink(agentDir): void` — creates/updates `~/.gsd/agent/node_modules` → GSD's `node_modules`.
  - Handles source/monorepo, npm/bun global (hoisted), and pnpm global (merged directory with symlinks from both roots, #3529, #3564).
- `reconcileSymlink(link, target): void` — fixes stale/wrong symlinks.
- `reconcileMergedNodeModules(agentNodeModules, hoisted, internal): void` — creates real directory with symlinks from both roots. Uses fingerprint marker `.gsd-merged` for cache invalidation.
- `hasMissingWorkspaceScopes(hoisted, internal): boolean` — checks if any `@gsd*` scopes exist in internal but not hoisted.
- `mergedFingerprint(hoisted, internal): string` — builds cache fingerprint from `packageRoot + sorted entry names of both directories`.

**Legacy skill migration:**
- `migrateSkillsToEcosystemDir(agentDir): void` — one-time migration from `~/.gsd/agent/skills/` → `~/.agents/skills/`.
  - Conservative: copies (not moves), collision-safe (ecosystem wins), writes `.migrated-to-agents` marker.
  - Atomic marker check using `openSync(markerPath, 'wx')` to prevent races.
  - If migrated < candidates, removes marker so retry happens next launch.

**Resource loader construction:**
- `buildResourceLoader(agentDir, options?): Promise<DefaultResourceLoaderType>` — constructs loader combining:
  - `~/.gsd/agent/extensions/` (GSD default)
  - `~/.pi/agent/extensions/` (pi's default, filtered to exclude bundled keys)
  - `options.additionalExtensionPaths`
  - Applies registry filtering (`isExtensionEnabled`) and topological sorting (`sortExtensionPaths`) via `extensionPathsTransform`.

**Bundled extension key caching:**
- `getBundledExtensionKeys(): Set<string>` — cached at module load to avoid re-scanning.

**File-tree writability:**
- `makeTreeWritable(dirPath): void` — recursively adds owner-write (and owner-exec for dirs) without widening group/other. Handles Nix store read-only copies (#1298). Uses `lstatSync` to avoid following symlinks into immutable filesystems.

**Directory sync:**
- `syncResourceDir(srcDir, destDir): void` — makes dest writable, prunes stale subdirs, copies source recursively (with `copyDirRecursive` fallback for Windows non-ASCII paths, #1178), makes result writable.

### 1.6 Tool Bootstrap (`src/tool-bootstrap.ts`)

**Managed tools:** `fd` and `rg`.

**Tool specs (`TOOL_SPECS`):**
- `fd`: targetName `fd.exe` (win32) or `fd`; candidates `["fd", "fdfind"]` (with `.exe` variants on win32).
- `rg`: targetName `rg.exe` (win32) or `rg`; candidates `["rg"]` (with `.exe` on win32).

**Resolution:**
- `resolveToolFromPath(tool, pathValue?): string | null` — scans PATH segments for candidate names. Uses `getCandidateNames()` for Windows executable extensions.

**Provisioning:**
- `provisionTool(targetDir, tool, sourcePath): string` — symlinks (non-Windows) or copies (Windows, fallback) the tool into `targetDir`.
- `ensureManagedTools(targetDir, pathValue?): string[]` — provisions all managed tools. On Windows, skips provisioning entirely because `resolveToolFromPath` already proved the tool is on PATH and child processes will find it via system PATH.

**Platform handling:**
- `isRegularFile(path): boolean` — `lstatSync`, returns true for files or symlinks.
- `pathExistsIncludingBrokenSymlink(path): boolean` — checks existence via `lstatSync`.
- `isBrokenSymlink(path): boolean` — `lstatSync` says symlink but `statSync` throws.
- `removeTargetPath(path): void` — removes symlinks via `unlinkSync`, other files via `rmSync`.

### 1.7 Bundled Extension Paths (`src/bundled-extension-paths.ts`)

- `serializeBundledExtensionPaths(paths, pathDelimiter?): string` — joins paths with platform delimiter.
- `parseBundledExtensionPaths(value, pathDelimiter?): string[]` — splits by delimiter, trims, filters empty.

### 1.8 CLI Policy (`src/cli-policy.ts`)

- `shouldBypassManagedResourceMismatchGate(firstMessage): boolean` — returns `true` only when `firstMessage === 'update'`.
  - The `update` subcommand MUST bypass the managed-resource-mismatch gate so users can recover by upgrading the binary when the synced manifest claims a newer gsd version.

---

## 2. Analysis

### 2.1 Extension Precedence Model
The system uses a three-tier precedence: **core** (undisableable) → **bundled** (shipped with gsd) → **installed** (user-installed, shadows bundled by manifest ID). This is enforced at discovery time via `mergeExtensionEntryPaths()`, not at load time — the loader receives a pre-merged, pre-sorted flat list.

### 2.2 Registry as Opt-Out Mechanism
The registry defaults to "all extensions enabled." The only way an extension stops loading is an explicit `gsd extensions disable <id>`. This is backwards-compatible: extensions without manifests always load, and fresh installs have an empty registry.

### 2.3 Content Fingerprinting vs Version-Only Sync
`initResources` skips the full copy when both `gsdVersion` AND `contentHash` match. This catches:
- Same-version upgrades (npm link dev workflow, hotfixes)
- Content changes that do not bump version
The cost is ~1-2ms for a typical tree (~100 small files).

### 2.4 pnpm Global Install Complexity
`ensureNodeModulesSymlink` handles three install layouts:
1. Source/monorepo: simple symlink to packageRoot/node_modules
2. npm/bun global (hoisted): symlink to parent node_modules
3. pnpm global (non-hoisted workspace packages): creates a **real merged directory** with symlinks from both hoisted and internal roots, fingerprinted via `.gsd-merged` marker.

### 2.5 Validation as Install-Time Gate
`extension-validator.ts` is called by the install command (Phase 8) before writing files. It is NOT called on bundled extensions — they are discovered at load time, not installed. The three-check sequence (discriminator → namespace → dependency placement) is designed to catch packaging errors early.

### 2.6 Topological Sort Resilience
`sortExtensionPaths` uses Kahn's algorithm with graceful degradation:
- Missing dependencies: warn and skip edge (extension loads anyway)
- Cycles: warn and append alphabetically (no hard failure)
- Self-dependencies: silently ignored
This prioritizes "load what you can" over strict correctness.

### 2.7 Worktree DB Path Resolution
`resolveProjectRootDbPath` in `dynamic-tools.ts` (called by resource loader) handles five path layouts:
1. `.gsd/worktrees/<MID>/...` → resolve to project root `.gsd/gsd.db`
2. `~/.gsd/projects/<hash>/worktrees/<MID>/...` → resolve to `~/.gsd/projects/<hash>/gsd.db` (#2952)
3. Symlink-resolved `/.gsd/projects/<hash>/worktrees/...` → resolve to project root `.gsd/gsd.db` (#2517)
4. Forward-slash variants for cross-platform handling
5. Default: `<basePath>/.gsd/gsd.db`

---

## 3. L4 Pointers

- Extension discovery entry point: `src/extension-discovery.ts` — `discoverExtensionEntryPaths()`, `resolveExtensionEntries()`, `mergeExtensionEntryPaths()`
- Registry persistence: `src/extension-registry.ts` — `loadRegistry()`, `saveRegistry()`, `disableExtension()`, `enableExtension()`, `readManifest()`, `ensureRegistryEntries()`
- Install-time validation: `src/extension-validator.ts` — `validateExtensionPackage()`, `checkInstallDiscriminator()`, `checkNamespaceReservation()`, `checkDependencyPlacement()`
- Topological sorting: `src/extension-sort.ts` — `sortExtensionPaths()` (Kahn's algorithm)
- Resource sync & fingerprinting: `src/resource-loader.ts` — `initResources()`, `computeResourceFingerprint()`, `syncResourceDir()`, `ensureNodeModulesSymlink()`, `buildResourceLoader()`, `migrateSkillsToEcosystemDir()`, `pruneRemovedBundledExtensions()`
- Tool bootstrap: `src/tool-bootstrap.ts` — `ensureManagedTools()`, `resolveToolFromPath()`, `provisionTool()`
- Bundled path serialization: `src/bundled-extension-paths.ts` — `serializeBundledExtensionPaths()`, `parseBundledExtensionPaths()`
- CLI policy bypass: `src/cli-policy.ts` — `shouldBypassManagedResourceMismatchGate()`
