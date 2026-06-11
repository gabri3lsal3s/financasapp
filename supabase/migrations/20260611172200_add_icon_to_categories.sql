-- Adiciona a coluna opcional 'icon' para customização de ícones de categoria
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE income_categories ADD COLUMN IF NOT EXISTS icon TEXT;
