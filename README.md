# Burgers.exe

Burgers.exe V2 is the official project and production architecture for this repo.

## Official V2 architecture

- Official public app: `apps/public-order-v2`
- Official internal app: `apps/internal-chekeo-v2`
- Public production URL: <https://burgers-exe.pages.dev>
- Internal production URL: <https://chekeo2-0.pages.dev>
- Source of truth for catalog, orders, operations, close, and V2 raffle reporting: Cloudflare D1
- Source of truth for catalog and promo assets: Cloudflare R2
- Internal authentication model: `BOG_INTERNAL_PIN` plus HttpOnly session cookie

## Working docs

- Living repo memory: `docs/codex-memory/`
- Migration tracker: `docs/codex-memory/10-migration-tracker.md`
- Skills and tools guide: `docs/codex-memory/11-skills-and-tools.md`
- Clean architecture migration spec: `docs/refactor-v2-clean-architecture.md`
- Environment matrix: `docs/environments.md`
- Current Cloudflare architecture notes: `docs/burgers-v2-architecture.md`
- Current Cloudflare data notes: `docs/burgers-v2-cloudflare-data.md`

## Official app surfaces

### Public Order V2

- Path: `apps/public-order-v2`
- Production: <https://burgers-exe.pages.dev>
- Build command: `npm run build:public`
- Output directory: `dist/public-order-v2`
- Runtime expectation: public ordering only, no internal PIN

### Internal Chekeo V2

- Path: `apps/internal-chekeo-v2`
- Production: <https://chekeo2-0.pages.dev>
- Build command: `npm run build:internal`
- Output directory: `dist/internal-chekeo-v2`
- Runtime expectation: internal operations only, PIN-only access with HttpOnly session

## Environment policy

- Production and preview must never share writes.
- Preview may be feature-equivalent to production, but it must use separate D1 and R2 resources.
- Local work must never write to production by accident.
- Any environment that points to production data must be treated as a manual-risk flow and documented before use.

## Legacy / historical context

The previous Google Sheets and Apps Script based architecture is deprecated.
It is kept only for history, rollback, or reference in `legacy/`.
The official current architecture uses Cloudflare D1 and R2.

## Repo rules

- `AGENTS.md` is the hard rule set.
- Codex should read `docs/codex-memory/00-indice.md` before real changes.
- Every migration PR must update the migration tracker before closing.
- Do not treat legacy Google Sheets or Apps Script flows as official runtime surfaces.
