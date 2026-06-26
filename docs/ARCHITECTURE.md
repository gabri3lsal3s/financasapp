# Arquitetura do Sistema - Minhas Finanças

Este documento descreve detalhadamente a estrutura técnica, os padrões de design e o fluxo de dados da aplicação **Minhas Finanças**. Ele serve como guia de onboarding e de governança técnica para garantir a consistência do ecossistema.

---

## 1. Visão Geral da Arquitetura

O **Minhas Finanças** é uma aplicação **PWA (Progressive Web App)** construída com a stack React 18, TypeScript, Vite e Tailwind CSS, integrada ao Supabase como Backend-as-a-Service (BaaS). A aplicação foi projetada sob o paradigma **Offline-First**, permitindo que todas as mutações e visualizações de dados funcionem sem conexão com a internet.

### Mapa de Fluxo e Componentes (Mermaid Diagram)

```mermaid
graph TD
    subgraph Client [Camada do Cliente - Frontend]
        P_Dashboard[Páginas: Dashboard]
        P_Transactions[Páginas: Despesas / Rendas / Investimentos]
        P_Categories[Páginas: Planejamento de Categorias]
        
        subgraph UIComponents [Componentes Padronizados Reutilizáveis]
            C_Card[TransactionCard]
            C_Kpis[DashboardKpis]
            C_ExpModal[ExpenseFormModal]
            C_IncModal[IncomeFormModal]
            C_InvModal[PortfolioTransactionFormModal]
        end
        
        subgraph Hooks [Hooks Customizados & Lógica]
            H_Expenses[useExpenses]
            H_Incomes[useIncomes]
            H_Categories[useCategories]
            H_Queue[useOfflineQueue]
        end
        
        subgraph LocalStorage [Armazenamento Local & Queue]
            L_Cache[(Dados Locais Cacheados)]
            L_Queue[(Fila Offline Mutações)]
        end
    end

    subgraph Service [Serviço & Sincronização]
        S_Sync[Serviço de Sincronização]
        S_SW[Service Worker - PWA]
    end

    subgraph Cloud [Camada de Nuvem - Backend]
        B_Supabase[(Supabase Database)]
    end

    %% Relações do Cliente
    P_Dashboard --> C_Kpis
    P_Dashboard --> C_ExpModal
    P_Dashboard --> C_IncModal
    P_Dashboard --> C_InvModal
    
    P_Transactions --> C_Card
    P_Transactions --> C_ExpModal
    P_Transactions --> C_IncModal
    P_Transactions --> C_InvModal
    
    C_ExpModal --> H_Expenses
    C_IncModal --> H_Incomes
    C_Card --> H_Categories
    
    H_Expenses --> H_Queue
    H_Incomes --> H_Queue
    H_Queue --> L_Queue
    H_Expenses --> L_Cache
    H_Incomes --> L_Cache
    
    L_Queue --> S_Sync
    S_Sync --> B_Supabase
    S_SW --> Client
```

---

## 2. Componentes Padronizados (UI/UX Core)

Para evitar redundância e garantir consistência estética extrema (em conformidade com a governança HSL), a interface de usuário foi modularizada em 5 componentes fundamentais em `src/components/`:

1. **`TransactionCard.tsx`**: Unifica a exibição de despesas e rendas. Controla badges de categoria com cor dinâmica, representação de parcelamento (`1/12`), badges de faturas de cartão de crédito e indicador animado de carregamento para IDs `offline-`.
2. **`DashboardKpis.tsx`**: Renderiza a grade padrão de KPIs do Dashboard (Rendas, Despesas, Investimentos e Saldo), com ícones e formatação monetária segura.
3. **`ExpenseFormModal.tsx`**: Gerencia o ciclo completo (cadastro, edição e deleção) de despesas. Inclui lógica de competência de cartões (automática vs manual) e peso de inclusão em relatórios (`report_weight`).
4. **`IncomeFormModal.tsx`**: Gerencia o ciclo de rendas. Trata de forma especial estornos automáticos de cartões de crédito (bloqueando a edição manual para manter a integridade).
5. **`PortfolioTransactionFormModal.tsx`**: Formulário simplificado de inclusão e edição de aportes em investimentos.

---

## 3. Estratégia Offline-First (Mutações em Fila)

O aplicativo garante operação contínua mesmo em quedas de sinal de rede:

* **Leitura**: Todas as listagens usam cache do `localStorage` atualizado em segundo plano.
* **Escrita (Fila de Mutações)**:
  1. Quando uma mutação (criar/editar/deletar) ocorre sem conexão, o hook `useOfflineQueue` captura a ação.
  2. A mutação recebe um ID provisório (ex: `offline-1716382103`).
  3. A ação é serializada na tabela local de pendências.
  4. Um evento global `local-data-changed` é disparado, forçando a atualização imediata da interface.
  5. Quando o navegador detecta a volta da internet (evento `online`), o serviço sincroniza a fila executando as operações na ordem cronológica exata no Supabase.

---

## 4. Estrutura de Diretórios Organizada

```text
├── database/                   # Scripts de Banco de Dados
│   ├── database.sql            # Estrutura base completa (Tabelas, Triggers, RLS)
│   ├── schema.sql              # Apenas o schema DDL limpo
│   ├── migrations/             # Migrations de evolução de banco
│   │   └── migration_v3_report_data.sql
│   └── samples/                # Arquivos CSV ou dados de amostra para testes
│       └── Fatura2026-03-15.csv
│
├── docs/                       # Documentações do Projeto
│   ├── ui/                     # Governança visual de Guardrails
│   │   ├── GOVERNANCA_UI.md    # Manual de sobrevivência estética (HSL)
│   │   └── guardrails-baseline.json
│   └── ARCHITECTURE.md         # Este documento
│
├── src/
│   ├── components/             # Componentes de UI Modulares (TransactionCard, Modais, etc.)
│   ├── constants/              # Constantes globais (PAGE_HEADERS, cores)
│   ├── contexts/               # Provedores de Tema, Paleta de Cores e Autenticação
│   ├── hooks/                  # Integração com Banco (useExpenses, useIncomes, useCategories)
│   ├── pages/                  # Páginas principais limpas e roteadas
│   ├── services/               # Regras de negócios específicas (AI, conciliação)
│   ├── types/                  # Contratos TypeScript de domínio
│   └── utils/                  # Helpers e utilitários matemáticos/datas
```

---

## 5. Governança de Layout & HSL

O sistema de cores do aplicativo é totalmente configurado via variáveis HSL em `src/index.css` e integrado ao `tailwind.config.js`. Para manter a harmonia visual:
* Evite cores sólidas como `bg-red-500` ou `bg-blue-600`.
* Sempre use as classes temáticas: `text-primary`, `bg-secondary`, `border-primary`, `bg-tertiary` ou classes semânticas `text-expense`, `text-income`.
* A conformidade de estilos é verificada a cada commit pelo validador de guardrails (`npm run guardrails:ui`).

---

## 6. Motor de rentabilidade (carteira / consultoria)

O fechamento patrimonial e a cota líquida são calculados em TypeScript puro, testável sem browser, com persistência opcional no Supabase.

### Contrato estável (`runDailyClose`)

Entrada (`DailyCloseInput`): `portfolioId`, `transactions`, `definitions`, `targets`, `prices`, `cashBalance`, `indexRatesByIndexer`, `asOfDate?`.

Saída (`DailyCloseResult`): `grossPl`, `netPl`, `shareValue`, `totalShares`, `lotCount`.

Orquestração em `src/services/returns/closePipeline.ts` (cálculo) e `src/services/returns/portfolioCloseService.ts` (persistência + snapshot mensal).

### Módulos de valoração

| Módulo | Arquivo | Regra |
|--------|---------|--------|
| Mercado (RV) | `priceService.ts` | Yahoo + guard de spike 50% → Last Known Value |
| RF / Tesouro na curva | `fixedIncomeValuation.ts` | Pré: 252 DU; IPCA+: fator VNA; lotes FIFO |
| IR por lote | `taxProvision.ts` | Tabela regressiva / 15% mercado |
| TWR mensal | `periodReturns.ts` | `Rm = cota_fech / cota_abertura - 1` |

### Tabelas (migration `20260602140000_portfolio_returns_engine.sql`)

- `portfolio_share_daily` — histórico de cota
- `portfolio_period_snapshots` — fechamentos mensais/anuais
- `asset_price_daily`, `vna_daily` — séries de mercado e VNA

### Disparo no SPA

- Botão **Atualizar fechamento** em `Investments.tsx` → `usePortfolioClose().runClose`
- Futuro backend próprio deve importar as mesmas funções (`computeDailyClose` / `runDailyClose`) sem alterar contratos.

---

## 7. Skeleton Loading States

O componente `Skeleton.tsx` (`src/components/Skeleton.tsx`) fornece placeholders estruturais para loading states em todas as páginas do app:

### Variantes disponíveis

| Variante | Uso | Descrição |
|----------|-----|-----------|
| `SkeletonDashboard` | Dashboard | 4 KPIs + gráfico de fluxo + limites + insights |
| `SkeletonInvestments` | Investimentos | 4 KPIs + tabs + saldo + chart evolução + 3 pizza charts |
| `SkeletonCategories` | Categorias | 4 KPIs + 6 category cards com status |
| `SkeletonTransactionList` | Despesas/Rendas | 3 linhas com ícone, título e valor |
| `SkeletonContas` | Contas | 4 KPIs + tabs + accordion cards + pendências |
| `SkeletonReports` | Relatórios | tabs período + 4 KPIs + 2 charts + composição + insights |
| `SkeletonCategoryGrid` | Categ. Despesa/Renda | 4 cards em grid com ícone e nome |

### Primitivos base

- `SkeletonText` — linha de texto placeholder
- `SkeletonCard` — card placeholder com N linhas
- `SkeletonKpi` — KPI individual neutro (sem borda colorida)
- `SkeletonKpiGrid` — grid de 4 KPIs para painéis
- `SkeletonAccordionCard` — card expansível para listas

Todos os skeletons usam classes `border-glass` e `bg-glass/10` para um visual neutro e padronizado.

---

## 8. Logger Condicional

O `src/utils/logger.ts` padroniza o logging do app:

| Método | Nível | Comportamento em produção |
|--------|-------|--------------------------|
| `logger.debug()` | DEBUG | Suprimido |
| `logger.info()` | INFO | Suprimido |
| `logger.warn()` | WARN | Exibido |
| `logger.error()` | ERROR | Exibido |

Controlado via `VITE_LOG_LEVEL` (default: `'warn'` em produção).

**89 chamadas `console.*`** foram substituídas pelo logger em **32+ arquivos**.

---
