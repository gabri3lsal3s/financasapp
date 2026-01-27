# 📸 Guia Visual: Executar Migração no Supabase

## Passo 1: Acessar o Supabase

1. Abra https://supabase.com/dashboard
2. Faça login com suas credenciais
3. Selecione seu projeto

```
Dashboard Supabase
├── Seu Projeto
│   └── [Clique aqui]
```

---

## Passo 2: Encontrar SQL Editor

Na barra lateral esquerda, procure por:

```
Sidebar Left:
├── 📊 Dashboard
├── 🗄️ Explore
├── 📋 SQL Editor  ← CLIQUE AQUI
├── 🔐 Authentication
├── 🛡️ Security Policies
└── ...
```

Clique em **"SQL Editor"**

---

## Passo 3: Criar Nova Query

No SQL Editor, procure pelo botão:

```
┌─────────────────────────────┐
│  + New Query                │  ← Clique aqui
│  Recent Queries             │
│                             │
│  [Editor vazio]             │
└─────────────────────────────┘
```

Clique em **"+ New Query"**

---

## Passo 4: Copiar o SQL

Abra o arquivo `QUICK_FIX.md` e copie este código:

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

---

## Passo 5: Colar no Editor

No SQL Editor, você verá:

```
┌──────────────────────────────────┐
│ SELECT * FROM          [▼ Tables]│
│                                  │
│ [Editor SQL]                     │
│                                  │
│ [Cursor aqui - Ctrl+A e Cole]   │
│                                  │
└──────────────────────────────────┘
```

**Ações:**
1. Clique no editor SQL
2. Pressione `Ctrl+A` (selecionar tudo)
3. Pressione `Ctrl+V` (colar código)

---

## Passo 6: Executar

Procure pelo botão azul:

```
┌──────────────────────────────┐
│ [SQL Code aqui]              │
│                              │
│ ┌────────────────────────┐   │
│ │ [▶ Run] ou [Cmd+Enter] │ ← Clique ou pressione Cmd+Enter
│ └────────────────────────┘   │
└──────────────────────────────┘
```

Clique em **"Run"** (botão azul) ou pressione **Cmd+Enter** (Mac) / **Ctrl+Enter** (Windows)

---

## Passo 7: Ver Resultado

Após clicar "Run", você verá:

### ✅ Sucesso:
```
Query successful! 
Results for CREATE TABLE income_categories:
✓ CREATE TABLE 1

Results for ALTER TABLE incomes:
✓ ALTER TABLE 1

Results for CREATE INDEX idx_income_categories_user:
✓ CREATE INDEX 1

Results for CREATE INDEX idx_incomes_category:
✓ CREATE INDEX 1
```

### ⚠️ Aviso (Tudo bem!):
```
Query executed with warnings:
⚠ Relation "income_categories" already exists, skipping
⚠ Column "income_category_id" already exists, skipping

✓ Criados novos índices
```

### ❌ Erro (Algo Errado):
```
ERROR: [Mensagem de erro específica]
```

Se vir erro que não seja "already exists", copie a mensagem e tente resolver ou peça ajuda.

---

## Passo 8: Confirmar Criação

Opcional - verificar que tudo foi criado:

1. Na barra lateral, clique em **"Explore"** (ou 🗄️)
2. Procure por `income_categories` na lista de tabelas
3. Clique para ver a estrutura

Você deve ver:
```
Tabela: income_categories
├── id (UUID)
├── name (TEXT)
├── color (TEXT)
├── created_at (TIMESTAMP)
└── user_id (UUID)
```

---

## Passo 9: Validar Coluna em Incomes

1. Na seção **"Explore"**, procure por `incomes`
2. Clique para ver as colunas
3. Verifique que existe `income_category_id`

Você deve ver:
```
Tabela: incomes
├── id (UUID)
├── amount (NUMERIC)
├── date (DATE)
├── income_category_id (UUID) ← DEVE ESTAR AQUI
├── description (TEXT)
├── created_at (TIMESTAMP)
└── user_id (UUID)
```

---

## Passo 10: Recarregar Aplicação

1. Volte para sua aplicação (aba do navegador)
2. Pressione **Ctrl+Shift+R** (Windows) ou **Cmd+Shift+R** (Mac)
3. Aguarde o recarregamento

Pronto! A aplicação agora deve funcionar sem erros! ✅

---

## Se Algo der Errado

Reexecute o comando e copie qualquer mensagem de erro para:
1. Tentar resolver sozinho
2. Peça ajuda descrevendo o erro

**Não existe risk neste processo** - se algo der "wrong", você pode sempre tentar de novo ou deletar e recriar.

---

## Próximo Passo

Após a migração funcionar:
1. Navegue para **"Categorias de Rendas"** na aplicação
2. Clique em **"+ Nova"**
3. Crie uma categoria (ex: "Salário", cor: azul)
4. Vá para **"Rendas"** e crie uma renda usando essa categoria
5. Vá para **"Relatórios"** e veja os gráficos de rendas por categoria

🎉 **Parabéns! Sistema funcionando!**
