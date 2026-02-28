# Guia Visual: Setup, PWA e Sincronização Offline

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

## 6) Validar instalação como PWA

1. Rode `npm run build`.
2. Rode `npm run preview`.
3. Abra no navegador suportado (Chrome/Edge).
4. Procure o botão/ação de **Instalar app**.
5. Instale e abra a versão instalada.

Resultado esperado:

- App abre em modo standalone.
- Ícone e nome do app aparecem corretamente.

---

## 7) Validar modo offline e sincronização

1. Com app aberto, desligue internet (modo avião ou devtools offline).
2. Faça operações de inclusão/edição/exclusão em despesas, rendas ou investimentos.
3. Reative a conexão.
4. Aguarde alguns segundos.
5. Atualize a tela ou navegue entre páginas para confirmar persistência no banco.

Resultado esperado:

- Sem erro crítico de cache na API.
- Operações feitas offline sincronizam ao voltar conexão.

---

## 8) Diagnóstico rápido se algo falhar

- Confirme variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Confirme que `dist/sw.js` foi gerado no build.
- Limpe dados do site (Application > Storage) e reinstale a PWA.
- Verifique se a conexão foi realmente restaurada antes da sincronização.
