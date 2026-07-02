# 10 — Phase 7: Production Migration (Safe)

## Objective
Enable a **controlled and manual** migration path from `Chekeo Nuevo` (TEST) to `Chekeo` (PROD) without automatic activation, without automatic data migration, and without deleting sheets/data.

## Final scope implemented
- Production readiness validation: `validateProductionReadiness()`.
- Migration preview (read-only): `getProductionMigrationPreview()`.
- Safe sheet preparation: `prepareProductionSheets()`.
- UI in `Ajustes` for readiness, preview and safe preparation.

## Operational mode strategy (no setOperationalMode)
Mode is controlled **manually** by `ScriptProperties`:
- Key: `BOG_ACTIVE_ENV`
- Valid values: `TEST`, `PROD`
- If missing/invalid: fallback to `TEST`

Rules:
1. `TEST` is the secure default.
2. Activating `PROD` requires explicit manual approval from the user.
3. Do not change `BOG_ACTIVE_ENV` before checklist completion.
4. Rollback = set `BOG_ACTIVE_ENV` back to `TEST`.

## Validation contract (final)
`validateProductionReadiness()` returns:

```json
{
  "ready": true,
  "mode": "TEST",
  "activeSheet": "Chekeo Nuevo",
  "checks": [
    {
      "label": "Existe Pedidos Master",
      "ok": true,
      "severity": "info",
      "message": "OK"
    }
  ]
}
```

Notes:
- `ready=false` if at least one `severity="error"` has `ok=false`.
- `warning` does not block `ready` by itself.

## Safe preparation contract
`prepareProductionSheets()` covers:
- `Chekeo`
- `Resumen Pedidos`
- `Historico`

Behavior:
- Creates sheet when missing (safe).
- If empty sheet, writes required headers.
- If sheet already has headers, validates headers.
- Never deletes rows/sheets.
- Never copies orders.
- Never changes environment mode.

## Hard safeguards
- No automatic production activation.
- No automatic migration to `Chekeo`.
- No deletion of `Chekeo Nuevo`, `Chekeo`, `Historico`, `Resumen Pedidos`.
- No changes in `legacy/`.
