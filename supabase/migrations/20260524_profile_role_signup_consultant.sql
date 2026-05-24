-- Usuários que se cadastram sozinhos: role consultant (app pessoal completo).
-- role = client apenas quando definido explicitamente (ex.: cadastro pelo assessor).

ALTER TABLE public.profiles
  ALTER COLUMN role DROP DEFAULT;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT NULL;

-- Corrige cadastros self-service marcados como client sem assessor vinculado
UPDATE public.profiles p
SET role = 'consultant'
WHERE p.role = 'client'
  AND EXISTS (
    SELECT 1 FROM public.portfolios pf
    WHERE pf.client_id = p.id AND pf.consultant_id IS NULL
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    is_approved,
    is_admin,
    is_blocked,
    is_rejected,
    rejection_count,
    role
  )
  VALUES (
    new.id,
    new.email,
    (CASE WHEN new.email = 'gabrielisaacsales@gmail.com' THEN TRUE ELSE FALSE END),
    (CASE WHEN new.email = 'gabrielisaacsales@gmail.com' THEN TRUE ELSE FALSE END),
    FALSE,
    FALSE,
    0,
    'consultant'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
