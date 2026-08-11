# Base44 SDK — Type System

**Domain:** base44
**Area:** TypeScript types, registries, filter queries, and generated-type integration
**Source:** https://github.com/base44/javascript-sdk (v0.8.27)
**Last updated:** 2026-05-06

---

## Mechanism

### Type Registry Pattern

The SDK uses empty interfaces as extension points for generated types:

```typescript
// entities.types.ts
export interface EntityTypeRegistry {}

export type EntityRecord = {
  [K in keyof EntityTypeRegistry]: EntityTypeRegistry[K] & ServerEntityFields;
};
```

The `base44 types generate` CLI command populates these registries by emitting a `.types/types.d.ts` file that declares module augmentation:

```typescript
declare module "@base44/sdk" {
  interface EntityTypeRegistry {
    Task: { title: string; status: string; dueDate: string };
    User: { email: string; name: string };
  }
}
```

Once augmented, `EntityRecord['Task']` gives the full record type including server fields (`id`, `created_date`, `updated_date`, `created_by`, `created_by_id`, `is_sample`).

Four registries exist:
1. `EntityTypeRegistry` → `EntityRecord`
2. `FunctionNameRegistry` → `FunctionName` (union of function names)
3. `AgentNameRegistry` → `AgentName` (union of agent names)
4. `ConnectorIntegrationTypeRegistry` → `ConnectorIntegrationType` (union of connector types)

### Entity Filter Type System

The filter query is typed to match the entity schema while supporting MongoDB-style operators:

```typescript
type EntityFilterValue<T> =
  | EntityFilterComparable<T>
  | EntityFilterComparable<T>[]
  | EntityFilterOperators<T>;

type EntityFilterOperators<T> = EntityFilterCommonOperators<T> & {
  $not?: EntityFilterCommonOperators<T>;
};

type EntityFilterCommonOperators<T> = {
  $eq?: T; $ne?: T; $gt?: T; $gte?: T; $lt?: T; $lte?: T;
  $in?: T[]; $nin?: T[]; $exists?: boolean;
} & EntityFilterStringOperators<T> & EntityFilterArrayOperators<T>;
```

String-specific: `$regex` only appears when `T extends string`.
Array-specific: `$all`, `$size` only appear when `T extends readonly any[]`.

Root-level logical operators: `$and`, `$or`, `$nor` accept arrays of `EntityFilterQuery<T>`.

### Sort Field Type

```typescript
type SortField<T> =
  | (keyof T & string)
  | `+${keyof T & string}`
  | `-${keyof T & string}`;
```

Prefix `+` or no prefix = ascending. Prefix `-` = descending.

### Field Selection

`list()` and `filter()` accept a `fields` array parameter. The return type is `Pick<T, K>[]` where `K` is inferred from the array:

```typescript
const titles = await base44.entities.Task.list('-created_date', 10, 0, ['title']);
// titles: Pick<TaskRecord, 'title'>[]
```

### ModelFilterParams

Used for agent conversation listing and other model queries:

```typescript
interface ModelFilterParams {
  q?: Record<string, any>;
  sort?: string | null;
  sort_by?: string | null;
  limit?: number | null;
  skip?: number | null;
  fields?: string[] | null;
}
```

---

## Analysis

### Why Module Augmentation?

Module augmentation (declare module) is the cleanest way to make generated types available without modifying the installed SDK package. The user's project generates a `.d.ts` file, and TypeScript merges it with the SDK's declarations. This avoids:
- Publishing type packages to npm
- Codegen that modifies `node_modules`
- Manual type imports for every entity

### Filter Type Safety Trade-off

The filter type system is sophisticated but has limits:
- `$regex` is typed as `string`, not `RegExp`
- `$gt`/`$lt` comparisons don't enforce numeric types at compile time
- `$and`/`$or` arrays are `EntityFilterQuery<T>[]` which allows mixed field types across clauses

These are pragmatic choices — full compile-time validation of MongoDB queries would require a much more complex type system.

### Default-to-string Fallback

When no types are generated, registries default to `string`:

```typescript
export type FunctionName = keyof FunctionNameRegistry extends never
  ? string
  : keyof FunctionNameRegistry;
```

This means the SDK is usable in plain JavaScript or before type generation, but loses autocomplete.

---

## L4 Pointers

- `src/modules/entities.types.ts` — `EntityFilterQuery`, `SortField`, `EntityTypeRegistry`
- `src/modules/functions.types.ts` — `FunctionNameRegistry`, `FunctionName`
- `src/modules/agents.types.ts` — `AgentNameRegistry`, `AgentName`
- `src/modules/connectors.types.ts` — `ConnectorIntegrationTypeRegistry`
- `src/types.ts` — `ModelFilterParams`
- `README.md` — Dynamic Types guide reference
