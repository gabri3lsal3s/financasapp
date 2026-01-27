# 🔧 Migração de Banco de Dados - Novembro 2026

## Problema
Após as alterações recentes no código (remoção de despesas fixas com parcelas e adição de categorias de rendas), o banco de dados precisa ser atualizado para refletir a nova estrutura.

## O que mudar

### ✅ Nova tabela: `income_categories`
A aplicação agora suporta categorias de rendas, similar às categorias de despesas.

### ✅ Tabela `incomes` atualizada
- **Adicionada**: coluna `income_category_id` (FK para income_categories)
- **Removida**: coluna `type` (pode ser removida após migração, se desejar)

### ✅ Tabela `expenses` simplificada
- **Removidas**: colunas `is_fixed`, `installments`, `current_installment`, `is_recurring`
- A aplicação não suporta mais despesas parceladas

## Como Executar a Migração

### Passo 1: Acessar o Supabase
1. Vá para [https://supabase.com](https://supabase.com)
2. Faça login no seu projeto
3. Clique em "SQL Editor" no menu lateral esquerdo

### Passo 2: Copiar o Script de Migração
1. Abra o arquivo `MIGRATION.sql` neste diretório
2. Copie TODO o conteúdo do arquivo

### Passo 3: Executar no Supabase
1. No Supabase SQL Editor, clique em "New Query"
2. Cole o conteúdo do arquivo `MIGRATION.sql`
3. Clique em "Run" (botão azul)

### Passo 4: Verificar Resultados
Após executar, você deverá ver mensagens de sucesso como:
- `CREATE TABLE` (se for nova tabela)
- `ALTER TABLE` (se for alteração)
- `CREATE INDEX` (para os índices)

## ⚠️ Backup Recomendado
Antes de executar a migração em produção:
1. Faça um backup do seu banco de dados Supabase
2. Teste a migração em um ambiente de teste (se disponível)
3. Só então execute em produção

## Após a Migração

A aplicação agora:
- ✅ Suporta categorias customizadas para rendas
- ✅ Permite criar/editar/deletar categorias de rendas
- ✅ Mostra gráficos de rendas por categoria
- ✅ Não suporta mais despesas fixas com parcelas
- ✅ Suporta apenas 2 temas (mono-light e mono-dark)
- ✅ Suporta apenas 3 paletas de cores (vivid, pastel, ocean)

## Problemas?

Se encontrar erros durante a migração:

1. **Erro 400 ao carregar rendas**: Verifique se a coluna `income_category_id` foi criada corretamente
2. **Erro 404 ao carregar categorias de rendas**: Verifique se a tabela `income_categories` foi criada
3. **Erro ao deletar colunas**: Talvez as colunas já não existam (não é um problema)

Você pode verificar a estrutura da tabela indo para:
- Supabase → SQL Editor → "CREATE TABLE incomes" para ver a estrutura atual

## Próximos Passos

Após a migração:
1. Recarregue a aplicação no navegador
2. Vá para a página de Categorias de Rendas
3. Crie suas categorias de renda
4. Adicione rendas e veja os gráficos aparecerem em Relatórios
