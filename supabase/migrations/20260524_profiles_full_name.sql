-- Nome completo do cliente/consultor para exibição na consultoria e admin.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT;

UPDATE public.profiles
SET full_name = 'Gabriel Sales'
WHERE email = 'gabrielisaacsales@gmail.com';
