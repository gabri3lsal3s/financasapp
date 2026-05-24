-- Carteira pessoal automática para consultores (self-service), além de clientes.

CREATE OR REPLACE FUNCTION public.handle_new_portfolio_for_client()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.portfolios WHERE client_id = NEW.id) THEN
    IF NEW.role IN ('client', 'consultant') THEN
      INSERT INTO public.portfolios (client_id, cash_balance)
      VALUES (NEW.id, 0.00);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garante carteira para consultores já cadastrados sem portfolio
INSERT INTO public.portfolios (client_id, cash_balance)
SELECT p.id, 0.00
FROM public.profiles p
WHERE p.role = 'consultant'
  AND NOT EXISTS (
    SELECT 1 FROM public.portfolios pf WHERE pf.client_id = p.id
  );
