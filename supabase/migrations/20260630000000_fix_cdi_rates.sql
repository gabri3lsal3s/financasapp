-- Migration: Corrigir taxas diárias do CDI que foram salvas incorretamente divididas pela taxa anualizada de 252 dias úteis
-- Data: 2026-06-30
-- Descrição: Reverte a fórmula de downscaling incorreta (annualPercentToDailyDecimal) e atualiza para a taxa diária correta.

UPDATE public.index_rates
SET daily_rate = ((1 + daily_rate)^252 - 1)
WHERE indexer = 'cdi' AND daily_rate < 0.00005;
