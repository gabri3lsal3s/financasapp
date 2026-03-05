-- =====================================================
-- MIGRATION_CREDIT_CARD_BILL_COMPETENCE_BACKFILL.sql
-- Backfill de bill_competence em despesas de cartão já existentes
-- Regra:
--   - usa closing_day do ajuste mensal da competência da compra (se existir)
--   - senão usa closing_day padrão do cartão
--   - compra no dia do fechamento entra na próxima fatura
-- =====================================================

WITH expense_base AS (
  SELECT
    e.id,
    e.date,
    e.credit_card_id,
    TO_CHAR(e.date, 'YYYY-MM') AS purchase_competence,
    EXTRACT(DAY FROM e.date)::int AS purchase_day,
    COALESCE(m.closing_day, c.closing_day) AS effective_closing_day
  FROM public.expenses e
  INNER JOIN public.credit_cards c
    ON c.id = e.credit_card_id
  LEFT JOIN public.credit_card_monthly_cycles m
    ON m.credit_card_id = e.credit_card_id
   AND m.competence = TO_CHAR(e.date, 'YYYY-MM')
  WHERE
    e.credit_card_id IS NOT NULL
    AND e.payment_method = 'credit_card'
    AND (
      e.bill_competence IS NULL
      OR e.bill_competence !~ '^\d{4}-\d{2}$'
    )
),
computed AS (
  SELECT
    id,
    TO_CHAR(
      CASE
        WHEN purchase_day >= effective_closing_day
          THEN (DATE_TRUNC('month', date)::date + INTERVAL '1 month')::date
        ELSE DATE_TRUNC('month', date)::date
      END,
      'YYYY-MM'
    ) AS calculated_bill_competence
  FROM expense_base
)
UPDATE public.expenses e
SET bill_competence = c.calculated_bill_competence
FROM computed c
WHERE e.id = c.id;

-- Índice útil caso ainda não exista no ambiente alvo
CREATE INDEX IF NOT EXISTS idx_expenses_card_bill_competence
  ON public.expenses(credit_card_id, bill_competence);
