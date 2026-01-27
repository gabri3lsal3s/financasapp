## ⚡ RESUMO EXECUTIVO - Erros ao Criar Categorias de Renda

### O ERRO:
```
Error loading income categories: Object
GET /rest/v1/income_categories → 404 Not Found
GET /rest/v1/incomes → 400 Bad Request
```

### A CAUSA:
A tabela `income_categories` não existe no Supabase.

### A SOLUÇÃO (em 3 passos):

#### 1️⃣ Vá para seu projeto Supabase
- https://supabase.com/dashboard

#### 2️⃣ Clique em "SQL Editor" e crie uma nova query

#### 3️⃣ Cole e execute este código:
```sql
-- Criar tabela de categorias de rendas
CREATE TABLE IF NOT EXISTS income_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- Adicionar coluna em incomes
ALTER TABLE incomes 
ADD COLUMN IF NOT EXISTS income_category_id UUID REFERENCES income_categories(id) ON DELETE CASCADE;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_income_categories_user ON income_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_incomes_category ON incomes(income_category_id);
```

### PRONTO! ✅

Agora:
1. Recarregue a aplicação (Ctrl+R)
2. Vá para "Categorias de Rendas"
3. Crie suas categorias
4. Use-as ao criar rendas

---

## Se tiver erros ao executar:

| Erro | Solução |
|------|---------|
| `table "income_categories" already exists` | Tudo bem! Pule para o próximo comando |
| `column "income_category_id" of relation "incomes" already exists` | Tudo bem! Pule para os índices |
| Outros erros | Copie a mensagem de erro e tente resolver ou peça ajuda |

---

## Dúvida? Veja:
- `MIGRATION_GUIDE.md` - Guia completo
- `MIGRATION_STEPS.md` - Passos individuais
- `MIGRATION.sql` - Script SQL completo
