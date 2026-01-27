# 🔧 CORREÇÃO RÁPIDA - Erro de Categorias de Renda

## O Problema
Quando você tenta criar uma categoria de renda, aparece:
```
Error: Failed to load resource 404
Error loading income categories
```

## Por Quê?
A tabela no banco de dados que armazena categorias de renda não foi criada.

## A Solução (5 minutos)

### 1. Abra o Supabase
- Vá para https://supabase.com
- Entre com sua conta
- Abra seu projeto

### 2. Vá para SQL Editor
- No menu à esquerda, clique em **SQL Editor**
- Clique em **+ New Query**

### 3. Cole Este Código
```sql
CREATE TABLE IF NOT EXISTS income_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

ALTER TABLE incomes 
ADD COLUMN IF NOT EXISTS income_category_id UUID REFERENCES income_categories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_income_categories_user ON income_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_incomes_category ON incomes(income_category_id);
```

### 4. Execute
- Clique no botão **Run** azul
- Ou pressione **Ctrl+Enter**

### 5. Vejo "Successfully"?
- **Sim** → Pronto! ✅
- **Erro "already exists"** → Tudo bem, pode ignorar ✅
- **Outro erro** → Tente de novo ou veja os guias detalhados

### 6. Recarregue a Aplicação
- Volta para a aba do app
- Pressione **Ctrl+Shift+R**
- Pronto! Testa novamente ✓

---

## ✨ Agora Funciona!

1. Vá para **Categorias de Rendas**
2. Clique em **+ Nova**
3. Digite um nome (ex: "Salário")
4. Clique em **Criar**
5. Crie uma renda usando essa categoria
6. Veja os gráficos em **Relatórios**

---

## Ficheiros de Ajuda Criados

Se precisar de mais detalhes:

- **`QUICK_FIX.md`** - Código SQL para copiar/colar
- **`VISUAL_GUIDE.md`** - Guia passo-a-passo com prints
- **`MIGRATION.sql`** - Script completo
- **`MIGRATION_GUIDE.md`** - Documentação completa
- **`CHECKLIST.md`** - Verificação ponto-a-ponto

---

## Pronto! 🎉

Seu sistema agora suporta categorias de renda funcionando perfeitamente.
