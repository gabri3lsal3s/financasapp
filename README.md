# Minhas Finanças 💰

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-BaaS-3ECF8E)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-425_passing-brightgreen)]()

Aplicação web premium de controle financeiro pessoal com **arquitetura Offline-First**, **motor quantamental de portfólio** e design system glass-based.

---

## ✨ Funcionalidades Principais

- **Dashboard Unificado** — KPIs, gráfico de fluxo diário, insights financeiros e controle de orçamentos
- **Gestão de Despesas e Rendas** — CRUD completo com parcelamento (até 60x), competência de cartão de crédito, estornos automáticos e sincronização offline
- **Motor Quantamental de Portfólio** — Avaliação híbrida (Scuttlebutt qualitativo + fundamentos quantitativos), Tiers de convicção (S/A/B/C), Smart Aporte com roteamento inteligente, conciliação B3 via upload de extrato
- **Cartões de Crédito** — Gestão completa de faturas, conciliação CSV, estornos vinculados, ciclos de fechamento customizáveis
- **Contas a Pagar e Receber** — Dívidas com vínculo a despesas, controle de status
- **Planejamento de Categorias** — Orçamentos com limites mensais, metas de renda com sugestão inteligente baseada em percentual da renda
- **Relatórios Analíticos** — Gráficos interativos (pizza, evolução, fluxo, composição, dia da semana), modo mensal/anual/período customizado, comparação histórica, pesos de relevância
- **PWA Instalável** — Funciona offline, sincronização inteligente em fila cronológica
- **6 Temas + 2 Paletas** — Light/Dark/Midnight × 6 acentos (blue, emerald, violet, amber, rose, teal) × 2 paletas de categoria (vivid/monochrome)

---

## 🛠️ Stack

| Camada | Tecnologias |
|--------|------------|
| **Core** | React 18, TypeScript 5.2, Vite 5 |
| **Estilização** | Tailwind CSS 3, Radix UI (shadcn/ui), Framer Motion |
| **Gráficos** | Recharts 2 |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| **Testes** | Vitest + Testing Library |
| **PWA** | vite-plugin-pwa (Service Worker, cache 75 entradas) |

---

## 📁 Documentação

| Documento | Conteúdo |
|-----------|----------|
| [`docs/REFINEMENT_MASTER_PLAN.md`](docs/REFINEMENT_MASTER_PLAN.md) | **Plano mestre consolidado** — fases concluídas, pendências, roadmap, bugs corrigidos |
| [`docs/COMPLETE_GUIDE.md`](docs/COMPLETE_GUIDE.md) | **Guia completo do sistema** — stack, estrutura, páginas, componentes, hooks, serviços, banco de dados, temas, setup |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitetura detalhada com diagramas Mermaid, hooks customizados, sistema de z-index, offline-first |
| [`docs/REIMPORT_INVESTMENTS.md`](docs/REIMPORT_INVESTMENTS.md) | Guia de reimportação B3 (desdobro, grupamento, transferências) |
| [`docs/ui/GOVERNANCA_UI.md`](docs/ui/GOVERNANCA_UI.md) | Manual de governança estética (HSL, glass system) |

---

## 🚀 Setup Rápido

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais do Supabase

# 3. Setup do banco
# Execute database/database.sql e migrations em supabase/migrations/

# 4. Desenvolvimento
npm run dev

# 5. Build produção
npm run build
```

### Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-supabase
```

---

## 📊 Métricas do Projeto

| Métrica | Valor |
|---------|-------|
| TypeScript errors | **0** |
| Testes passando | **425/425** (35 arquivos) |
| UI Guardrails | **0 violações** |
| Componentes | **130+** |
| Hooks | **40+** |
| Migrations | **43** |
| `as any` em produção | **0** |
| `console.log` residual | **0** (via logger condicional) |

---

## 📋 Scripts Disponíveis

```bash
npm run dev                   # Desenvolvimento local
npm run build                 # Typecheck + build produção
npm run test:run              # Executar testes (Vitest)
npm run guardrails:ui         # Validar consistência visual
npm run lint                  # Guardrails + ESLint
```

---

## 🧪 Cobertura de Testes

**425 testes** em **35 arquivos**, cobrindo:

- Utilitários financeiros (format, creditCard, cashBalance, installment)
- Motor de portfolio (ledger, TWR, cálculos, fluxo mensal)
- Motor quantamental (scuttlebutt, score quantitativo, smart aporte)
- Serviços (priceService, historicalRecalc)
- Hooks (reconciliation, debts)
- Constantes (z-index consistency)
- Snapshots de UI

---

## 📜 Licença

Projeto privado — uso pessoal.

---

> **Documentação completa:** [`docs/COMPLETE_GUIDE.md`](docs/COMPLETE_GUIDE.md)
