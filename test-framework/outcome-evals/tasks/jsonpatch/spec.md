# applyPatch (JSON Patch, RFC 6902)

Create `solution.mjs` exporting `applyPatch(doc, patch)`, which applies a JSON Patch to a JSON value and returns the result.

- `doc` is any JSON value. `patch` is an array of operation objects. Do not modify `doc`: return a new value (structural sharing of untouched parts is fine, but the caller's `doc` must be unchanged afterwards).
- Operations: `add`, `remove`, `replace`, `move`, `copy`, `test`, each with a `path` (and `from` for move/copy, `value` for add/replace/test).
- Paths are JSON Pointers (RFC 6901): `""` is the whole document; otherwise `/`-separated tokens where `~1` means `/` and `~0` means `~` (decode `~1` before `~0`). A pointer that is not empty and does not start with `/` is invalid.
- Arrays: a token must be `0` or a non-negative integer without leading zeros. `add` may use index `length` or `-` to append; other operations need an existing index. `add` inserts (shifts later elements); `replace` overwrites.
- `add` to an object member replaces it if present. `add` with path `""` replaces the whole document. `remove` and `replace` require the target to exist.
- `move` removes from `from` and adds at `path`; moving a location into one of its own children is an error. `copy` adds a deep copy of the value at `from`.
- `test` compares deeply by JSON value (object key order does not matter; `1` and `1.0` are equal; arrays compare in order) and fails if not equal.
- The patch is atomic: if any operation fails, throw an `Error` whose `name` is `"PatchError"`, and `doc` is unchanged.
- An unknown `op`, a missing required member, or an invalid pointer is also a `PatchError`.
