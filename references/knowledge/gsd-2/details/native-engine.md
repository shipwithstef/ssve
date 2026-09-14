# GSD-2 Native Rust Engine — Knowledge Extraction

## Mechanism

### Workspace (`native/Cargo.toml`)
- Workspace with members `crates/*`, resolver "2".
- Release profile: `opt-level = 3`, `lto = "fat"`, `codegen-units = 1`, `strip = true`, `panic = "abort"`.
- Dev profile: `codegen-units = 256`, `incremental = true`.

### Engine Crate (`native/crates/engine/src/lib.rs`)
- N-API addon entrypoint. Declares modules:
  - `mod ast;` — linker include for `gsd_ast` N-API registrations
  - `mod clipboard;` — clipboard N-API bindings
  - `mod diff;` — fuzzy match + unified diff
  - `mod fd;` — fuzzy file discovery
  - `mod fs_cache;` — shared filesystem scan cache
  - `mod glob;` — glob matching with ignore semantics
  - `mod glob_util;` — glob compilation helpers
  - `mod grep;` — N-API bindings for `gsd_grep`
  - `mod highlight;` — syntect syntax highlighting
  - `mod html;` — HTML to Markdown
  - `mod ps;` — cross-platform process tree
  - `mod task;` — async task / blocking helper for N-API
  - `mod text;` — ANSI-aware text measurement
  - `mod ttsr;` — Time Traveling Stream Rules regex engine
  - `mod gsd_parser;` — GSD file parsing (frontmatter, roadmap)
  - `mod image;` — image decode/encode/resize
  - `mod truncate;` — line-boundary-aware truncation
  - `mod json_parse;` — JSON parsing utilities
  - `mod stream_process;` — stream chunk processing
  - `mod xxhash;` — xxHash32
  - `mod git;` — libgit2 N-API bindings

### Grep N-API Bindings (`native/crates/engine/src/grep.rs`)
- Wraps `gsd_grep` crate functions for JS consumption.
- **Types:**
  - `NapiContextLine` — `{ line_number: u32, line: String }`
  - `NapiSearchMatch` — `{ line_number, line, context_before, context_after, truncated }`
  - `NapiSearchResult` — `{ matches, match_count, limit_reached }`
  - `NapiSearchOptions` — `{ pattern, ignore_case?, multiline?, max_count?, context_before?, context_after?, max_columns? }`
  - `NapiGrepMatch` — extends search match with `path: String`
  - `NapiGrepResult` — `{ matches, total_matches, files_with_matches, files_searched, limit_reached }`
  - `NapiGrepOptions` — extends search options with `path, glob?, hidden?, gitignore?`
- **Functions:**
  - `search(content: Buffer, options: NapiSearchOptions)` → `NapiSearchResult` — in-memory regex search.
  - `grep(options: NapiGrepOptions)` → `task::Async<NapiGrepResult>` — filesystem regex search via `gsd_grep::search_path()`, wrapped in `task::blocking()`.

### Glob (`native/crates/engine/src/glob.rs`)
- Filesystem discovery with glob patterns, ignore semantics, and shared scan caching.
- **`GlobOptions`** — `{ pattern, path, file_type?, recursive?, hidden?, max_results?, gitignore?, cache?, sort_by_mtime?, include_node_modules?, timeout_ms? }`
- **`GlobResult`** — `{ matches: Vec<GlobMatch>, total_matches: u32 }`
- **`glob(options, on_match?)`** → `task::Async<GlobResult>`:
  - Resolves search root via `fs_cache::resolve_search_path()`.
  - Compiles glob via `glob_util::compile_glob()`.
  - If `cache=true`: uses `fs_cache::get_or_scan()`; on empty stale cache, forces rescan once.
  - If `cache=false`: uses `fs_cache::force_rescan()`.
  - Supports `sort_by_mtime` (collect all, sort descending, truncate).
  - Streams matches via `ThreadsafeFunction` callback if provided.
  - Skips `.git` and `node_modules` unless explicitly included.
  - Resolves symlink target types for file-type filtering.

### AST Linker (`native/crates/engine/src/ast.rs`)
- Only two lines: `use gsd_ast as _;` — forces the linker to include `gsd_ast` N-API registrations so `astGrep` and `astEdit` are available at runtime.

### Git (`native/crates/engine/src/git.rs`)
- Native git operations via `libgit2`, replacing `git` child process spawns.
- **Read functions:**
  - `git_current_branch(repo_path)` → `Option<String>` — HEAD symbolic ref.
  - `git_main_branch(repo_path)` → `String` — resolves via `origin/HEAD`, then `main`, then `master`, then current branch.
  - `git_branch_exists(repo_path, branch)` → `bool`
  - `git_has_merge_conflicts(repo_path)` → `bool` — checks index unmerged entries.
  - `git_working_tree_status(repo_path)` → `String` — porcelain format (`XY path`).
  - `git_has_changes(repo_path)` → `bool` — quick staged/unstaged/untracked check.
  - `git_commit_count_between(repo_path, from_ref, to_ref)` → `u32`
  - `git_is_repo(path)` → `bool`
  - `git_has_staged_changes(repo_path)` → `bool` — diff tree to index.
  - `git_diff_stat(repo_path, from_ref, to_ref)` → `GitDiffStat` — supports `HEAD..WORKDIR` and `HEAD..INDEX` special refs.
  - `git_diff_name_status(repo_path, from_ref, to_ref, pathspec?, use_merge_base?)` → `Vec<GitNameStatus>`
  - `git_diff_numstat(repo_path, from_ref, to_ref)` → `Vec<GitNumstat>`
  - `git_diff_content(repo_path, from_ref, to_ref, pathspec?, exclude?, use_merge_base?)` → `String` — unified patch.
  - `git_log_oneline(repo_path, from_ref, to_ref)` → `Vec<GitLogEntry>`
  - `git_worktree_list(repo_path)` → `Vec<GitWorktreeEntry>`
  - `git_branch_list(repo_path, pattern?)` → `Vec<String>` — supports `prefix/*` and `prefix/*/*` glob patterns.
  - `git_branch_list_merged(repo_path, target, pattern?)` → `Vec<String>`
  - `git_ls_files(repo_path, pathspec)` → `Vec<String>`
  - `git_for_each_ref(repo_path, prefix)` → `Vec<String>`
  - `git_conflict_files(repo_path)` → `Vec<String>` — unmerged index entries.
  - `git_batch_info(repo_path)` → `GitBatchInfo` — branch + has_changes + status string + staged/unstaged counts in one call.
- **Write functions:**
  - `git_init(path, initial_branch?)` → `()`
  - `git_add_all(repo_path)` → `()` — stages all including deletions.
  - `git_add_paths(repo_path, paths)` → `()`
  - `git_reset_paths(repo_path, paths)` → `()` — unstages specific paths.
  - `git_commit(repo_path, message, allow_empty?)` → `String` (SHA) — reads MERGE_MSG/SQUASH_MSG if message empty; cleans up merge state files after commit.
  - `git_checkout_branch(repo_path, branch)` → `()` — safe checkout with `recreate_missing`.
  - `git_checkout_theirs(repo_path, paths)` → `()` — resolves conflicts by accepting stage-3 (theirs), writes blob to working tree, with path-traversal validation.
  - `git_merge_squash(repo_path, branch)` → `GitMergeResult` — performs squash merge, cleans up MERGE_HEAD, returns conflict list.
  - `git_merge_abort(repo_path)` → `()` — hard reset to HEAD + cleanup_state.
  - `git_rebase_abort(repo_path)` → `()` — resets to ORIG_HEAD + removes rebase-merge/rebase-apply dirs.
  - `git_reset_hard(repo_path)` → `()`
  - `git_branch_delete(repo_path, branch, force?)` → `()`
  - `git_branch_force_reset(repo_path, branch, target)` → `()`
  - `git_rm_cached(repo_path, paths, recursive?)` → `Vec<String>` — returns list of removed entries.
  - `git_rm_force(repo_path, paths)` → `()` — removes from index and working tree with path-traversal validation.
  - `git_worktree_add(repo_path, wt_path, branch, create_branch?, start_point?)` → `()`
  - `git_worktree_remove(repo_path, wt_path, force?)` → `()` — validates, prunes, optionally force-removes directory.
  - `git_worktree_prune(repo_path)` → `()` — removes invalid worktree entries.
  - `git_revert_commit(repo_path, sha)` → `()` — no-commit revert.
  - `git_revert_abort(repo_path)` → `()`
  - `git_update_ref(repo_path, refname, target?)` → `()` — create/update or delete ref.
- **Security:** `validate_path_within_repo()` canonicalizes paths and rejects repository boundary escape attempts.

### Diff (`native/crates/engine/src/diff.rs`)
- Fuzzy text matching and unified diff generation for the edit tool.
- **`normalize_for_fuzzy_match(text)`** — Strips trailing whitespace, normalizes smart quotes (`'` `"`), dashes (`-`), and special Unicode spaces to ASCII.
- **`fuzzy_find_text(content, old_text)`** → `FuzzyMatchResult`:
  - Tries exact substring match first.
  - Falls back to normalized fuzzy match.
  - Returns UTF-16 code unit offsets (JS `substring()` compatible).
- **`generate_diff(old_content, new_content, context_lines?)`** → `DiffResult`:
  - Uses `similar` crate with Myers algorithm.
  - Output format: `+N line`, `-N line`, ` N line`, ` ... ` for skipped context.
  - Tracks `first_changed_line` for UI scroll positioning.

### Fuzzy Find / FD (`native/crates/engine/src/fd.rs`)
- Fuzzy file path discovery for autocomplete and @-mention resolution.
- **`FuzzyFindOptions`** — `{ query, path, hidden?, gitignore?, max_results? }`
- **`FuzzyFindMatch`** — `{ path, is_directory, score }`
- **`FuzzyFindResult`** — `{ matches, total_matches }`
- **`fuzzy_find(options)`** → `FuzzyFindResult`:
  - Uses `fs_cache::get_or_scan()` for directory entries.
  - Empty-result recheck: rescans if cached scan is stale.
  - Scoring hierarchy: exact filename (120) > starts-with (100) > contains (80) > path contains (60) > filename fuzzy subsequence (50+) > path fuzzy subsequence (30+) > 0.
  - Directory bonus: +10 to any non-zero score.
  - Subsequence gap penalty: -5 per gap.

### Process Tree (`native/crates/engine/src/ps.rs`)
- Cross-platform process tree management without requiring `detached: true`.
- **Platform implementations:**
  - **Linux:** Reads `/proc/{pid}/task/{pid}/children`; uses `libc::kill()`, `libc::getpgid()`, `libc::kill(-pgid, signal)`.
  - **macOS:** Uses `libproc` `proc_listchildpids`; same libc signal APIs.
  - **Windows:** Uses `CreateToolhelp32Snapshot` to build parent-child tree; `OpenProcess` + `TerminateProcess`.
- **Functions:**
  - `kill_tree(pid, signal)` → `u32` — kills descendants first (bottom-up), then root. Returns kill count.
  - `list_descendants(pid)` → `Vec<i32>`
  - `process_group_id(pid)` → `Option<i32>` — `None` on Windows.
  - `kill_process_group(pgid, signal)` → `bool` — `false` on Windows.

### TTSR (`native/crates/engine/src/ttsr.rs`)
- Time Traveling Stream Rules regex engine.
- Pre-compiles all rule condition patterns into a single `regex::RegexSet` for O(1)-style matching.
- Global handle store (`HashMap<u64, CompiledRuleSet>`) with `AtomicU64` handle generation.
- **`ttsr_compile_rules(rules)`** → `f64` handle:
  - Compiles `RegexSet::new(&patterns)`.
  - Maps pattern indices back to rule names.
  - Max 10,000 live handles to prevent unbounded growth.
- **`ttsr_check_buffer(handle, buffer)`** → `Vec<String>`:
  - Returns unique matched rule names.
  - Bounds-checks handle against `NEXT_HANDLE` upper bound before map lookup.
- **`ttsr_free_rules(handle)`** — releases memory.
- **`ttsr_clear_all()`** — clears entire store.

### Truncate (`native/crates/engine/src/truncate.rs`)
- Line-boundary-aware output truncation counting by UTF-8 bytes.
- **`truncate_tail(text, max_bytes)`** → `TruncateResult` — keeps first N bytes worth of complete lines.
- **`truncate_head(text, max_bytes)`** → `TruncateResult` — keeps last N bytes worth of complete lines.
- **`truncate_output(text, max_bytes, mode?)`** → `TruncateOutputResult`:
  - `"tail"` (default): keep beginning.
  - `"head"`: keep end.
  - `"both"`: split budget, elide middle with `[N lines elided]` marker.
- Uses `memchr::memchr_iter()` / `memchr::memrchr()` for fast newline scanning.

### AST Crate (`native/crates/ast/src/`)
- **`lib.rs`** — Declares `pub mod ast;`, `pub mod glob_util;`, `pub mod language;`.
- **`ast.rs`** — AST-aware structural search and rewrite powered by `ast-grep`:
  - **`AstFindOptions`** — `{ patterns?, lang?, path?, glob?, selector?, strictness?, limit?, offset?, include_meta?, context? }`
  - **`AstFindResult`** — `{ matches, total_matches, files_with_matches, files_searched, limit_reached, parse_errors? }`
  - **`AstFindMatch`** — `{ path, text, byte_start, byte_end, start_line, start_column, end_line, end_column, meta_variables? }`
  - **`AstReplaceOptions`** — `{ rewrites?, lang?, path?, glob?, selector?, strictness?, dry_run?, max_replacements?, max_files?, fail_on_parse_error? }`
  - **`AstReplaceResult`** — `{ changes, file_changes, total_replacements, files_touched, files_searched, applied, limit_reached, parse_errors? }`
  - **`AstReplaceChange`** — `{ path, before, after, byte_start, byte_end, deleted_length, start_line, start_column, end_line, end_column }`
  - Language aliasing via `phf::phf_map!` supporting 40+ languages (bash, c, cpp, csharp, css, elixir, go, haskell, hcl, html, java, javascript, json, kotlin, lua, markdown, nix, php, python, rust, scala, solidity, swift, toml, tsx, typescript, yaml, zig, etc.).
  - `ast_grep()` and `ast_edit()` N-API functions.

### Grep Crate (`native/crates/grep/src/lib.rs`)
- Ripgrep-backed search library (`grep-*` family of crates).
- **`search_content(content, options)`** → `ContentSearchResult` — in-memory search via `Cursor` over byte slice.
- **`search_path(options)`** → `FileSearchResult` — filesystem search:
  - Single file: opens file, takes first 4 MiB (`MAX_FILE_BYTES`), searches.
  - Directory: uses `ignore::WalkBuilder` with `.gitignore`/hidden/glob support; collects file paths; parallel search via `rayon::prelude::ParallelIterator` (`par_iter()`).
  - Aggregates results, applies global `max_count`, sorts by path.
- **`MatchCollector`** — custom `Sink` implementation:
  - Collects matches with context lines.
  - Truncates lines at `max_columns` with `...` suffix, respecting char boundaries.
  - Tracks `match_count`, `collected_count`, `limit_reached`.
- Uses `grep_regex::RegexMatcherBuilder` and `grep_searcher::SearcherBuilder` with `BinaryDetection::quit(b'\x00')`.

---

## Analysis

1. **The native engine is organized as a workspace with two library crates and one integration crate.** `gsd_grep` and `gsd_ast` are standalone Rust libraries. `gsd_engine` is the N-API integration crate that exposes them (plus its own modules) to Node.js.

2. **Git operations are fully native via libgit2.** The `git.rs` module replaces nearly every `execFileSync("git", ...)` call in the JS codebase with a typed, validated, path-safe N-API function. It handles reads (diff, log, status, branch listing), writes (commit, merge, checkout, add, rm, worktree), and conflict resolution (checkout-theirs, merge-abort, rebase-abort).

3. **Filesystem discovery shares a scan cache.** Both `glob.rs` and `fd.rs` use `fs_cache` for directory enumeration. The cache supports stale detection and forced rescan on empty-result recheck, reducing redundant directory walks.

4. **Grep uses the same internals as ripgrep.** `gsd_grep` is built on `grep_regex`, `grep_searcher`, and `ignore` — the exact crates that power ripgrep. Directory searches use `rayon` for parallel file scanning. The 4 MiB file size limit prevents memory issues with large binaries.

5. **AST search supports 40+ languages via ast-grep.** Language resolution uses a `phf` static map with aliases (e.g., `js`, `jsx`, `mjs` → JavaScript). The engine supports structural find, replace, dry-run, meta-variable extraction, and parse-error reporting.

6. **TTSR replaces O(rules × conditions) JS iteration with a single RegexSet DFA pass.** This is a significant optimization for stream processing where many rules must be checked against growing buffers. The handle-based memory management with an upper bound prevents leaks.

7. **Process tree management is truly cross-platform.** Linux uses `/proc/{pid}/children`; macOS uses `libproc`; Windows uses Toolhelp32 snapshots. The API surface is unified: `kill_tree`, `list_descendants`, `process_group_id`, `kill_process_group`.

8. **Truncation is line-boundary-safe and UTF-8-safe.** It splits only on `\n` (single byte, always valid UTF-8 boundary), uses `memchr` for fast scanning, and supports head/tail/both modes with human-readable messages.

9. **Diff generation uses the `similar` crate (Myers algorithm).** It matches the JS `diff` npm package output format with `+N`/`-N`/` N` line prefixes and `...` ellipsis for skipped context. It also reports `first_changed_line` for UI positioning.

10. **The addon loader has a three-tier resolution with graceful degradation.** Production installs use platform-specific npm optional dependencies; local builds use release or debug `.node` files; unsupported platforms get a throwing Proxy rather than a startup crash.

---

## L4 pointers

| Capability | File | Function / Type |
|-----------|------|-----------------|
| Workspace manifest | `native/Cargo.toml` | `[workspace] members = ["crates/*"]` |
| Engine module declarations | `native/crates/engine/src/lib.rs` | `mod ast; mod git; mod grep; mod glob; mod diff; mod fd; mod ps; mod ttsr; mod truncate;` |
| In-memory search | `native/crates/engine/src/grep.rs` | `search()` |
| Filesystem grep | `native/crates/engine/src/grep.rs` | `grep()` |
| Glob search | `native/crates/engine/src/glob.rs` | `glob()` |
| Glob options | `native/crates/engine/src/glob.rs` | `GlobOptions`, `GlobResult` |
| AST linker | `native/crates/engine/src/ast.rs` | `use gsd_ast as _;` |
| Current branch | `native/crates/engine/src/git.rs` | `git_current_branch()` |
| Main branch detection | `native/crates/engine/src/git.rs` | `git_main_branch()` |
| Working tree status | `native/crates/engine/src/git.rs` | `git_working_tree_status()` |
| Has changes | `native/crates/engine/src/git.rs` | `git_has_changes()` |
| Diff stats | `native/crates/engine/src/git.rs` | `git_diff_stat()` |
| Diff name-status | `native/crates/engine/src/git.rs` | `git_diff_name_status()` |
| Diff content | `native/crates/engine/src/git.rs` | `git_diff_content()` |
| Commit log | `native/crates/engine/src/git.rs` | `git_log_oneline()` |
| Worktree list | `native/crates/engine/src/git.rs` | `git_worktree_list()` |
| Branch list | `native/crates/engine/src/git.rs` | `git_branch_list()` |
| Conflict files | `native/crates/engine/src/git.rs` | `git_conflict_files()` |
| Batch info | `native/crates/engine/src/git.rs` | `git_batch_info()` |
| Git init | `native/crates/engine/src/git.rs` | `git_init()` |
| Stage all | `native/crates/engine/src/git.rs` | `git_add_all()` |
| Commit | `native/crates/engine/src/git.rs` | `git_commit()` |
| Checkout branch | `native/crates/engine/src/git.rs` | `git_checkout_branch()` |
| Checkout theirs | `native/crates/engine/src/git.rs` | `git_checkout_theirs()` |
| Squash merge | `native/crates/engine/src/git.rs` | `git_merge_squash()` |
| Merge abort | `native/crates/engine/src/git.rs` | `git_merge_abort()` |
| Rebase abort | `native/crates/engine/src/git.rs` | `git_rebase_abort()` |
| Hard reset | `native/crates/engine/src/git.rs` | `git_reset_hard()` |
| Worktree add | `native/crates/engine/src/git.rs` | `git_worktree_add()` |
| Worktree remove | `native/crates/engine/src/git.rs` | `git_worktree_remove()` |
| Path validation | `native/crates/engine/src/git.rs` | `validate_path_within_repo()` |
| Fuzzy match normalize | `native/crates/engine/src/diff.rs` | `normalize_for_fuzzy_match()` |
| Fuzzy find text | `native/crates/engine/src/diff.rs` | `fuzzy_find_text()` |
| Unified diff | `native/crates/engine/src/diff.rs` | `generate_diff()` |
| Fuzzy file find | `native/crates/engine/src/fd.rs` | `fuzzy_find()` |
| Fuzzy scoring | `native/crates/engine/src/fd.rs` | `score_fuzzy_path()` |
| Kill process tree | `native/crates/engine/src/ps.rs` | `kill_tree()` |
| List descendants | `native/crates/engine/src/ps.rs` | `list_descendants()` |
| Process group ID | `native/crates/engine/src/ps.rs` | `process_group_id()` |
| Kill process group | `native/crates/engine/src/ps.rs` | `kill_process_group()` |
| TTSR compile | `native/crates/engine/src/ttsr.rs` | `ttsr_compile_rules()` |
| TTSR check | `native/crates/engine/src/ttsr.rs` | `ttsr_check_buffer()` |
| TTSR free | `native/crates/engine/src/ttsr.rs` | `ttsr_free_rules()` |
| Truncate tail | `native/crates/engine/src/truncate.rs` | `truncate_tail()` |
| Truncate head | `native/crates/engine/src/truncate.rs` | `truncate_head()` |
| Truncate output | `native/crates/engine/src/truncate.rs` | `truncate_output()` |
| AST crate entry | `native/crates/ast/src/lib.rs` | `pub mod ast; pub mod glob_util; pub mod language;` |
| AST grep | `native/crates/ast/src/ast.rs` | `ast_grep()` |
| AST edit | `native/crates/ast/src/ast.rs` | `ast_edit()` |
| AST find options | `native/crates/ast/src/ast.rs` | `AstFindOptions`, `AstFindResult`, `AstFindMatch` |
| AST replace options | `native/crates/ast/src/ast.rs` | `AstReplaceOptions`, `AstReplaceResult`, `AstReplaceChange` |
| Language aliases | `native/crates/ast/src/ast.rs` | `LANG_ALIASES` (phf map) |
| Grep crate content search | `native/crates/grep/src/lib.rs` | `search_content()` |
| Grep crate path search | `native/crates/grep/src/lib.rs` | `search_path()` |
| Match collector | `native/crates/grep/src/lib.rs` | `MatchCollector` (impl `Sink`) |
| Regex matcher builder | `native/crates/grep/src/lib.rs` | `build_matcher()` |
