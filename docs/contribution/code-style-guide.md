# Code Style Guide

This guide defines style and design conventions for the `api` repository.
Use this as the default reference for code review and implementation decisions.

When a rule here conflicts with existing code, prefer this guide for new code and improve old code gradually.

## Design Values

### Correctness

Correctness is the main priority. Readability is part of correctness because readable code is easier to validate, debug, and extend safely.

### Explicitness

Make assumptions explicit in names, types, and control flow. Hidden behavior should be treated as a design smell.

### Equational reasoning

Write code so a reviewer can reason about it step by step, without hidden side effects or surprising mutation.

### Pragmatic consistency

Consistency with the existing repository patterns is better than introducing a new personal style.

## Architecture and Boundaries

### Feature module shape

Each feature under `src/modules/<feature>` should follow:

- `<feature>.module.ts` for dependency wiring.
- `<feature>.controller.ts` for HTTP transport and status/error mapping.
- `<feature>.service.ts` for use-case orchestration and business flow.
- `<feature>.repository.ts` for persistence operations only.
- `dtos/` for request and response DTOs.
- `types/` for shareable contracts in that module.
- `utils/` for small pure helper functions.

If a type or utility is shared by multiple modules, move it to the proper `src/common/<domain>` area (for example: `src/common/api`, `src/common/persistence`, `src/common/data`, `src/common/queue`).

### File ownership and folder discipline

- Put code in the right file and folder for its responsibility (`controller`, `service`, `repository`, `dtos`, `types`, `utils`, `common`).
- Each file should have one clear purpose; do not mix unrelated concerns.
- Do not append unrelated helpers/constants/temporary logic to an existing file just because it is convenient.
- If a new concern appears, create a proper file for it instead of adding extra code to a random file.
- Keep modules tidy: remove dead code and avoid catch-all files.

### Dependency direction

Preferred direction:

- Controller depends on Service.
- Service depends on Repository and infrastructure services.
- Repository depends on Database service.

Do not place business rules in controllers or SQL concerns in services.

### Side effects

Keep impure effects at the boundaries (database, network, filesystem, crypto randomness). Keep pure transformation logic in dedicated functions where possible.

## TypeScript Rules

- Keep compatibility with strict TypeScript settings.
- Prefer explicit return types on public methods (controller/service/repository).
- Keep types close to usage and extract only when reused.
- Use `readonly` where immutability improves clarity.

### Escape hatches

Avoid these by default:

- `any`
- broad `as` assertions
- non-null assertion `!`
- `@ts-ignore`

If one is necessary:

- keep it local,
- document why it is safe,
- add runtime checks at the boundary if needed.

### Exhaustiveness

Use exhaustive handling for discriminated unions. Avoid default branches that hide missed cases.

## Errors, Results, and Assertions

### Expected failures

Expected operational failures must be represented as typed values.

- Use `neverthrow` `Result<T, E>` in services and repositories.
- Use discriminated error unions with stable `type` fields.
- Keep error variants small and domain-specific.

### Exceptions

Use `throw` at transport boundaries (controllers) to map domain errors to HTTP errors (`BadRequestException`, `NotFoundException`, etc.).

Do not use thrown exceptions for normal control flow in services/repositories.

### Assertions

Assertions are for invariants and programmer errors only. Example: row must exist immediately after a successful insert-read flow.

- Keep assertion messages concrete.
- Do not use assertions for user input or expected runtime failures.

## Naming, Comments, and Readability

### Naming

- Use descriptive names that communicate intent.
- Prefer verbs for functions and nouns for values/types.
- Avoid ambiguous abbreviations.
- Avoid boolean blindness in APIs (`doThing(true, false)`); prefer named options or unions.

### Control flow

- Prefer early return to reduce nesting.
- Avoid long `else if` chains when `switch` or decomposition is clearer.
- Keep functions focused on one responsibility.

### Comments

- Prefer self-explanatory code first.
- Add comments only for non-obvious constraints, protocol rules, or intentional trade-offs.
- Keep comments factual and up to date.

### Spacing and structure

- Use whitespace to make structure obvious.
- Group related statements.
- Do not compress code to save lines.

## API, DTO, and Swagger Conventions

### DTOs and casing

- Internal TypeScript names should be `camelCase`.
- Database and public payload fields may use `snake_case`.
- Use response DTOs and `@Expose({ name: 'snake_case' })` when API field names differ.

### Controller contracts

- Keep `@nestjs/swagger` decorators aligned with runtime behavior.
- Use shared API tags from `src/common/api/swagger/api-tag.enum.ts`.
- Use shared API error helpers from `src/common/api/errors/api-error-response.util.ts`.

### Pagination

Use the standard response shape:

- `items`
- `page_info`

### Swagger source of truth

- API contract discussion and approval happen in issue comments.
- `docs/api/swagger.yaml` is generated from decorators and must stay in sync.
- Do not manually edit generated output as the contract-definition step.

## Persistence and SQL

- Repositories own SQL; services orchestrate.
- Use `DatabaseService` and `sql-template-tag`.
- Never build SQL using string concatenation.
- Always apply tenant isolation in tenant-scoped data queries.
- Map MySQL errors to typed domain errors (for example, duplicate key collisions).
- Use deterministic ordering for pagination (`created_at DESC, id DESC` pattern).

### Database type source of truth

- Keep database row/projection contracts in `src/modules/database/database.d.ts`.
- Repositories should use these shared row/projection types in `query<T>` / `queryOne<T>`.
- Do not duplicate row type declarations (`*Row`) inside repositories when they already exist in `database.d.ts`.
- In `database.d.ts`, keep names concise and domain-oriented (for example, `UserRow`, `RoomRow`) instead of redundant prefixes.

## Migrations

- Add migrations in `db/migrations` with timestamp-prefixed names.
- Prefer explicit constraints and indexes.
- Keep names descriptive and use `snake_case`.
- Provide clear `migrate:up` and `migrate:down` definitions.

## Shared Types and Utilities

- Keep module-local contracts in module `types/`.
- Keep reusable pure helpers in module `utils/`.
- Promote to `src/common/*` only when shared across modules.
- Organize `src/common` by domain (for example: `api`, `persistence`, `data`, `queue`) instead of by artifact kind.
- Avoid “misc” files that mix unrelated helpers.

### Type placement rules

- In non-`types` files, local `type` declarations should stay internal to that file.
- If a type is exposed by public method signatures (controller/service/repository), move it to a proper `types/` file or to `database.d.ts` for DB row/projection contracts.
- Avoid alias-only type files that just re-export/rename another type; import the source type directly.

### Utility extraction balance

- Extract helpers when they improve reuse or reduce meaningful duplication.
- Do not extract one-off service flow/orchestration code into utils only for indirection.
- Keep service-specific lifecycle/stateful logic (queue/event init, waiting, orchestration flow) in the service unless clearly shared.

### Composable transformation style

- Prefer value-level pure transforms first, then compose them into object/record transforms.
- When multiple fields require transformation, use one composed multi-field mapper instead of many one-off wrappers.
- Avoid introducing boilerplate layers that do not reduce complexity.

## Testing Standards

- Place e2e specs in `test/specs/*.e2e-spec.ts`.
- Keep tests deterministic with fixtures and explicit setup.
- Cover success path, validation failures, auth failures, and tenant isolation.
- For persistence-sensitive flows, include realistic integration behavior (for example, MinIO for R2-compatible storage in e2e).

### Assertions in tests

- Prefer object-level Jest matchers (`toEqual`, `objectContaining`, `toHaveProperty`, `stringMatching`).
- Avoid brittle per-field manual type-guard blocks unless truly necessary.
- Avoid hacks for JSON shape checks; keep expectations direct and readable.

## Performance Guidance

- Do not optimize prematurely.
- Measure before optimizing.
- Prefer algorithm/data-structure improvements over micro-optimizations.
- Keep clarity first, then optimize hot paths with data.

## Dependency Usage

- Prefer Node/platform APIs for trivial needs.
- Add third-party libraries only when they provide clear value.
- Evaluate maintenance, API quality, type quality, and security posture before adoption.

## Tooling and Commands

- Linting and formatting are mandatory.
- Use repository scripts rather than ad-hoc command variants.

Recommended checks before opening a PR:

- `pnpm run lint`
- `pnpm run test`
- `pnpm run test:e2e` when API/persistence behavior changes
- `pnpm run swagger:check` when API contract changes

## Review Checklist

Before requesting review, verify:

- Layering is respected (controller/service/repository/module).
- Expected failures use typed `Result` errors.
- Invariants are asserted only where appropriate.
- Types/helpers were placed in correct module `types/` and `utils/` folders or in the appropriate `src/common/<domain>` area.
- Swagger decorators and DTOs match runtime behavior.
- SQL is tenant-safe and parameterized.
- Tests cover happy path and relevant failure modes.
- CI checks are green.
