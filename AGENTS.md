# Payload Project Notes

This repository relies on the globally installed `payload` Codex skill for general Payload CMS knowledge and patterns.

Keep this file focused on repo-specific rules and operating constraints.

## Scope

- Use the global `payload` skill for framework-level guidance, examples, and reference material.
- Use this `AGENTS.md` for local conventions, validation steps, and repo-specific cautions.

## Stack

- Payload CMS `3.79.0`
- Next.js `15.4.11`
- React `19.2.1`
- MongoDB adapter via `@payloadcms/db-mongodb`
- TypeScript-first codebase

## Required Validation

- After schema changes, run `npm run generate:types`.
- After creating or modifying admin components, run `npm run generate:importmap`.
- After code changes, validate TypeScript with `pnpm exec tsc --noEmit`.

## Security-Critical Rules

- When passing `user` to the Payload Local API, always set `overrideAccess: false`.
- In hooks, always pass `req` into nested Payload operations so the transaction context is preserved.
- When a hook writes back into the same collection or related collections, guard against loops with a `context` flag.
- When changing collection or global access controls, verify that the referenced roles actually exist in the `users` model and the auth flow.

## Project Structure

```text
src/
├── app/
│   ├── (frontend)/
│   └── (payload)/
├── collections/
├── globals/
├── components/
├── hooks/
├── access/
└── payload.config.ts
```

## Useful Scripts

- `npm run dev`
- `npm run build`
- `npm run generate:types`
- `npm run generate:importmap`
- `pnpm exec tsc --noEmit`
- `npm run test:int`
- `npm run test:e2e`

## Local Reference Files

For deeper repo-local context, consult the files in `.cursor/rules/`:

- `payload-overview.md`
- `collections.md`
- `fields.md`
- `field-type-guards.md`
- `access-control.md`
- `access-control-advanced.md`
- `hooks.md`
- `queries.md`
- `endpoints.md`
- `adapters.md`
- `plugin-development.md`
- `components.md`
- `security-critical.mdc`

## Intent

- Prefer keeping shared Payload knowledge in the global skill, not duplicated here.
- Add to this file only when a rule is specific to this repository or to the team's workflow.
