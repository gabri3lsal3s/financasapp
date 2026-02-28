# Guia Visual: Setup e Migração no Supabase

Este guia rápido cobre os dois cenários atuais do projeto:

- Base nova: usar [database.sql](database.sql)
- Base existente (antiga): usar [MIGRATION.sql](MIGRATION.sql)

---

## 1) Abrir o SQL Editor

1. Acesse https://supabase.com/dashboard
2. Entre no seu projeto
3. No menu lateral, clique em **SQL Editor**
4. Clique em **+ New Query**

---

## 2) Escolher o script correto

### Cenário A: instalação do zero

- Copie o conteúdo de [database.sql](database.sql)
- Cole no editor e execute com **Run**

### Cenário B: atualização de base existente

- Copie o conteúdo de [MIGRATION.sql](MIGRATION.sql)
- Cole no editor e execute com **Run**

---

## 3) Resultado esperado

### Sucesso

- Mensagens de `CREATE TABLE`, `ALTER TABLE` e `CREATE INDEX`
- Tabelas presentes: `categories`, `income_categories`, `expenses`, `incomes`, `investments`

### Avisos aceitáveis

- `already exists`
- `IF NOT EXISTS` ignorando criação duplicada

### Erro real

- Qualquer erro diferente dos avisos acima deve ser revisado (permissão, sintaxe, referência de tabela/coluna)

---

## 4) Checklist de validação

No painel **Table Editor / Explore**, confirme:

- `incomes` possui `income_category_id`
- `expenses` não depende das colunas legadas de parcelamento
- índices principais foram criados

Depois rode localmente:

```bash
npm install
npm run dev
```

---

## 5) Validação funcional na aplicação

1. Crie categorias de despesa e renda.
2. Registre uma despesa, uma renda e um investimento.
3. Verifique:
   - Home: indicadores e inclusão rápida
   - Relatórios: visão ano/mês e gráficos
   - Modais: abertura/fechamento corretos (`Esc`, clique no fundo e botão fechar)

Se tudo acima funcionar, o ambiente está pronto.

---

## 6) Validar PWA e modo offline

### Instalação da PWA

1. Abra o app em um navegador compatível (Chrome/Edge).
2. Procure opção **Instalar aplicativo** na barra de endereço/menu.
3. Instale e abra o app como aplicativo standalone.

### Atualização de versão

1. Publique uma nova versão.
2. Abra o app já instalado.
3. Verifique o prompt **Nova versão disponível**.
4. Clique em **Atualizar** para aplicar imediatamente.

### Teste offline com sincronização

1. Abra o app e depois desligue a internet (ou use modo offline no DevTools).
2. Crie/edite/exclua uma despesa, renda ou investimento.
3. Confirme que a alteração aparece localmente.
4. Ligue a internet novamente.
5. Aguarde sincronização automática.
6. Recarregue e valide os dados persistidos no Supabase.

### Resultado esperado

- Interface continua utilizável sem conexão.
- Alterações offline não são perdidas.
- Ao reconectar, pendências são enviadas ao banco sem intervenção manual.
