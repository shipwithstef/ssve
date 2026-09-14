# Base44 SDK Docs — Type Alias Reference

**Domain:** base44
**Area:** SDK documentation for type aliases (entities, integrations)
**Source:** https://docs.base44.com/developers/references/sdk/docs/type-aliases/entities, integrations
**Last updated:** 2026-05-06

---

## Mechanism

### Entities Type Aliases

Docs document the entity handler type system:
- `EntityHandler<T>` — CRUD methods with typed generics
- `EntityRecord` — combines `EntityTypeRegistry` with server fields (`id`, `created_date`, `updated_date`, `created_by`, `created_by_id`, `is_sample`)
- `EntityTypeRegistry` — empty interface augmented by `types generate`
- `SortField<T>` — `(keyof T & string) | +${keyof T & string} | -${keyof T & string}`
- `EntityFilterQuery<T>` — MongoDB-style operators

Method signatures with generic field selection:
```typescript
list<K extends keyof T>(sort?, limit?, skip?, fields?): Promise<Pick<T, K>[]>
filter<K extends keyof T>(query, sort?, limit?, skip?, fields?): Promise<Pick<T, K>[]>
```

Default sort: `-created_date`. Default limit: 50. Max limit: 5,000.

### Integrations Type Aliases

Two integration packages documented:
1. **Core** — built-in functions: `InvokeLLM`, `GenerateImage`, `UploadFile`, `SendEmail`, `ExtractDataFromUploadedFile`, `UploadPrivateFile`, `CreateFileSignedUrl`
2. **custom** — workspace integrations via `call(slug, operationId, params?)`

`IntegrationPackage` type: `{ [endpointName: string]: IntegrationEndpointFunction }`

---

## Analysis

### No Delta from Source

The type alias docs are pure TypeDoc output. Every signature, parameter, and example matches the source `.types.ts` files exactly. There is no additional semantic content.

### Value Is Discoverability

The docs site provides cross-linked navigation ("See also" sections, sidebar hierarchy) that makes the type system easier to explore than reading raw `.types.ts` files. For agent consumption, the structured property tables are more parseable than inline TSDoc.

---

## L4 Pointers

- `https://docs.base44.com/developers/references/sdk/docs/type-aliases/entities`
- `https://docs.base44.com/developers/references/sdk/docs/type-aliases/integrations`
- `src/modules/entities.types.ts` — source
- `src/modules/integrations.types.ts` — source
