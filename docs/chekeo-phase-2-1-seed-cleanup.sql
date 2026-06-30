-- Fase 2.1 QA seed cleanup for PREVIEW D1 only.
-- Batch: QA-UIUX-PHASE2-1
--
-- Intended command:
--   npx wrangler d1 execute burgers-exe-menu-v2-preview --remote --file=docs/chekeo-phase-2-1-seed-cleanup.sql
--
-- Safety guard:
--   This script only targets orders_v2 rows with source = 'public-v2-preview'
--   and an explicit QA-UIUX-PHASE2-1 marker in idempotency_key, customer_name, or notes.
--   Do not run it against burgers-exe-menu-live.

BEGIN TRANSACTION;

SELECT
  id,
  folio,
  status,
  payment_status,
  payment_method,
  order_mode,
  source,
  customer_name,
  created_at
FROM orders_v2
WHERE source = 'public-v2-preview'
  AND (
    idempotency_key LIKE 'QA-UIUX-PHASE2-1-%'
    OR customer_name LIKE '%QA-UIUX-PHASE2-1%'
    OR notes LIKE '%QA-UIUX-PHASE2-1%'
  )
ORDER BY created_at DESC;

DELETE FROM order_events_v2
WHERE order_id IN (
  SELECT id
  FROM orders_v2
  WHERE source = 'public-v2-preview'
    AND (
      idempotency_key LIKE 'QA-UIUX-PHASE2-1-%'
      OR customer_name LIKE '%QA-UIUX-PHASE2-1%'
      OR notes LIKE '%QA-UIUX-PHASE2-1%'
    )
);

DELETE FROM order_items_v2
WHERE order_id IN (
  SELECT id
  FROM orders_v2
  WHERE source = 'public-v2-preview'
    AND (
      idempotency_key LIKE 'QA-UIUX-PHASE2-1-%'
      OR customer_name LIKE '%QA-UIUX-PHASE2-1%'
      OR notes LIKE '%QA-UIUX-PHASE2-1%'
    )
);

DELETE FROM orders_v2
WHERE source = 'public-v2-preview'
  AND (
    idempotency_key LIKE 'QA-UIUX-PHASE2-1-%'
    OR customer_name LIKE '%QA-UIUX-PHASE2-1%'
    OR notes LIKE '%QA-UIUX-PHASE2-1%'
  );

COMMIT;
