# Chekeo visual foundation PR1

## Scope

PR1 tightens only the shared visual foundation for the internal Chekeo shell:

- Chekeo visual tokens and dark surface baseline.
- More compact operator shell and status strip.
- Base success, warning, error, info, and loading message styles.
- Stronger visible focus states.
- 44px minimum touch targets for controls and filters.
- Reduced-motion guardrails.
- Responsive validation at 320, 390, 768, and 1280px.

## Open Design MCP

Open Design MCP no respondió en la auditoría; se continuó con evidencia de código y screenshots locales.

Observed state:

- `Open Design.exe` processes were running with `daemon-cli.mjs mcp`.
- `http://127.0.0.1:7456` refused the connection.
- Codex MCP calls returned: `cannot reach the Open Design daemon at http://127.0.0.1:7456. Is it running? Start it with pnpm tools-dev.`
- `%USERPROFILE%\.codex\config.toml` contains `[mcp_servers.open-design]`.
- Configured `command`, daemon `args`, and `OD_DATA_DIR` paths exist.
- `OD_SIDECAR_IPC_PATH` did not exist at verification time.

## QA Evidence

Local screenshots:

- Before: `codex-tools/screenshots/chekeo-audit/`
- After: `codex-tools/screenshots/chekeo-pr1-after/`

Automated browser checks:

- `npm run typecheck`
- `npm run build:internal`
- Playwright screenshots and DOM checks with mocked Chekeo data.
- Viewports: 320, 390, 768, 1280.
- Screens covered: Home at all viewports; Pedidos, Cocina, Pagos, Admin hub at 390 and 1280.
- Result: no console errors, no document horizontal overflow, visible keyboard focus, reduced motion active, and zero touch target violations.

## Not Touched

- Payment logic.
- Ticket or WhatsApp copy/behavior.
- Sorteos redesign.
- Resumen K behavior.
- Corte behavior.
- Data contracts or backend endpoints.
- New dependencies.
