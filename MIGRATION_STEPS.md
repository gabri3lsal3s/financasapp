# 📋 Passos Individuais de Migração

Se preferir executar os comandos um por um (recomendado para segurança):

## Passo 1: Criar tabela de categorias de rendas
```sql
CREATE TABLE IF NOT EXISTS income_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);
```

**Resultado esperado**: "CREATE TABLE 1"

---

## Passo 2: Adicionar coluna income_category_id em incomes
```sql
ALTER TABLE incomes 
ADD COLUMN IF NOT EXISTS income_category_id UUID REFERENCES income_categories(id) ON DELETE CASCADE;
```

**Resultado esperado**: "ALTER TABLE 1"

---

## Passo 3: Criar índices (1/2)
```sql
CREATE INDEX IF NOT EXISTS idx_income_categories_user ON income_categories(user_id);
```

**Resultado esperado**: "CREATE INDEX 1"

---

## Passo 4: Criar índices (2/2)
```sql
CREATE INDEX IF NOT EXISTS idx_incomes_category ON incomes(income_category_id);
```

**Resultado esperado**: "CREATE INDEX 1"

---

## Passo 5: Remover colunas antigas de expenses (OPCIONAL)

Se desejar limpar as colunas antigas que não são mais usadas:

```sql
ALTER TABLE expenses DROP COLUMN IF EXISTS is_recurring;
```

```sql
ALTER TABLE expenses DROP COLUMN IF EXISTS is_fixed;
```

```sql
ALTER TABLE expenses DROP COLUMN IF EXISTS installments;
```

```sql
ALTER TABLE expenses DROP COLUMN IF EXISTS current_installment;
```

**Nota**: Estes comandos não prejudicam a aplicação se não forem executados, são apenas limpeza.

---

## Passo 6: Remover coluna type de incomes (OPCIONAL)

Se desejar limpar a coluna antiga `type`:

```sql
ALTER TABLE incomes DROP COLUMN IF EXISTS type;
```

**Nota**: A aplicação não usa mais esta coluna, mas dados históricos ainda estarão lá. Só remova se tiver certeza.

---

## Verificação Final

Para verificar se tudo foi criado corretamente:

### Verificar tabela income_categories
```sql
SELECT * FROM income_categories LIMIT 5;
```

Deverá retornar 0 linhas (tabela criada, mas vazia).

### Verificar coluna em incomes
```sql
SELECT column_name FROM information_schema.columns WHERE table_name='incomes' AND column_name='income_category_id';
```

Deverá retornar uma linha com "income_category_id".

---

## Próximos Passos

Após completar a migração:
1. Recarregue a aplicação
2. Navegue até "Categorias de Rendas"
3. Crie suas categorias
4. Crie rendas usando as categorias
5. Veja os gráficos em "Relatórios"
