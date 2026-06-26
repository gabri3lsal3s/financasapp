# Minhas Finanças

Aplicação web premium de controle financeiro pessoal, projetada com foco em simplicidade, operação offline-first contínua e consistência estética moderna.

---

## 🚀 O que o app oferece

- **Dashboard Unificado**: Visão instantânea de KPIs de Rendas, Despesas, Investimentos e Saldo Geral.
- **Componentes Padronizados**: Formulários de transações encapsulados em modais reutilizáveis (`ExpenseFormModal`, `IncomeFormModal`, `PortfolioTransactionFormModal`) e exibição unificada via `TransactionCard`.
- **Planejamento de Categorias**: Interface centralizada em `/categories` para planejar metas de limites de despesa e expectativas de renda mensal.
- **Skeleton Loading**: Componentes Skeleton específicos por página (`SkeletonDashboard`, `SkeletonInvestments`, `SkeletonReports`, etc.) para loading states contextuais.
- **Logger Condicional**: Sistema de logging padronizado via `logger.ts` que suprime mensagens de debug em produção.
- **Detalhamento de Cartões e Faturas**: Lógica avançada de competência de faturas de cartão de crédito e suporte a estornos vinculados como renda de forma automatizada.
- **Relatórios Mensais e Anuais**: Gráficos analíticos interativos por categoria, com peso de relevância de lançamentos (`report_weight`).
- **Arquitetura Offline-First**: PWA instalável com sincronização inteligente de ações offline organizadas em fila cronológica.

---

## 🛠️ Stack Tecnológica

- **Core**: React 18 + TypeScript + Vite
- **Estilização**: Tailwind CSS (integrado ao sistema de temas de cores HSL)
- **Backend**: Supabase (Database, Auth)
- **Gráficos**: Recharts
- **Testes**: Vitest
- **Logger**: Logger condicional com supressão em produção (`src/utils/logger.ts`)
- **Skeleton**: Componentes de loading state específicos por página (`src/components/Skeleton.tsx`)

---

## 🔧 Configuração e Setup Rápido

### 1. Instalar as Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente (`.env`)

Crie um arquivo `.env` na raiz com as chaves do seu projeto Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-supabase
```

### 3. Setup do Banco de Dados

Abra o painel do Supabase, acesse o **SQL Editor** e execute:

1. O script de estrutura e tabelas base: [database/database.sql](database/database.sql)
2. (Opcional) A evolução de dados de relatórios: [database/migrations/migration_v3_report_data.sql](database/migrations/migration_v3_report_data.sql)

### 4. Executar em Desenvolvimento

```bash
npm run dev
```

---

## 📖 Guias e Documentação Técnica

- **Guia de Arquitetura e Fluxo de Dados**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (Diagrama Mermaid, ciclo Offline-First e componentes modulares).
- **Manual de Governança Estética (HSL)**: [docs/ui/GOVERNANCA_UI.md](docs/ui/GOVERNANCA_UI.md) (Detalhamento do sistema de cores e regras visuais).
- **Lista de Ocorrências e Guardrails**: [docs/ui/guardrails-baseline.json](docs/ui/guardrails-baseline.json).

---

## 📁 Estrutura do Projeto Organizada

```text
├── database/                   # Modelagem do Banco e Migrations
│   ├── database.sql            # Estrutura base completa (Tabelas, Triggers, RLS)
│   ├── schema.sql              # Apenas o schema DDL limpo
│   ├── migrations/             # Migrations de evolução de banco
│   └── samples/                # Dados e CSVs de amostra para testes
│
├── docs/                       # Guias e Governança Técnica
│   ├── ui/                     # Manual de estilos visuais e Guardrails
│   └── ARCHITECTURE.md         # Documentação completa da arquitetura do app
│
├── src/
│   ├── components/             # Componentes modulares reutilizáveis (Kpis, Card, Modais, Skeleton)
│   ├── constants/              # Constantes globais e chaves de cabeçalho
│   ├── contexts/               # Provedores globais (Tema, Paleta de Cores e Auth)
│   ├── hooks/                  # Chamadas de dados e integração (useExpenses, useIncomes)
│   ├── pages/                  # Telas do app limpas e simplificadas
│   ├── services/               # Regras de negócios (Integração AI, Conciliação)
│   ├── types/                  # Definições de tipagem TypeScript
│   └── utils/                  # Auxiliares de formatação matemática, moeda, datas e logging
```

---

## 🧪 Scripts de Verificação

- `npm run dev`: Ambiente de desenvolvimento local.
- `npm run build`: Valida tipagem do TypeScript e compila o bundle para produção.
- `npm run test:run`: Roda a suíte completa de testes unitários com o Vitest.
- `npm run lint`: Executa simultaneamente a verificação de guardrails visuais de UI e o ESLint.
