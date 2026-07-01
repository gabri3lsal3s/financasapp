# Plano de Implementação: Busca Global por Dados Financeiros

> **Data:** Julho de 2026
> **Propósito:** Substituir a busca atual (apenas navegação entre páginas) por uma busca completa que pesquisa descrições, categorias, valores e datas de todas as entidades financeiras do sistema.
> **Baseado em:** Análise dos tipos de dados, hooks existentes e arquitetura atual do TopBar.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Estado Atual](#2-estado-atual)
3. [Escopo da Busca](#3-escopo-da-busca)
4. [Arquitetura Proposta](#4-arquitetura-proposta)
5. [Plano de Implementação por Fases](#5-plano-de-implementação-por-fases)
6. [Componentes de UI](#6-componentes-de-ui)
7. [Integração com o Roteamento](#7-integração-com-o-roteamento)
8. [Considerações de Performance](#8-considerações-de-performance)
9. [Métricas de Sucesso](#9-métricas-de-sucesso)
10. [Glossário de Dados](#10-glossário-de-dados)

---

## 1. Visão Geral

A busca atual do TopBar apenas filtra uma lista estática de páginas (`NAV_PAGES`). O objetivo é transformá-la em uma **busca global** que pesquisa em tempo real todas as entidades financeiras do usuário:

- **Despesas** — descrição, categoria, valor, data, método de pagamento
- **Rendas** — descrição, categoria, valor, data, tipo
- **Investimentos** — ticker, tipo de operação, quantidade, valor, data
- **Dívidas/Contas** — nome, descrição, valor, data de vencimento, status
- **Cartões de Crédito** — nome, bandeira

Cada resultado deve:
1. Exibir informações relevantes (descrição, valor formatado, data, categoria/badge)
2. Permitir navegação para a página de origem da entidade
3. Ter ícone e cor apropriados para o tipo de entidade

---

## 2. Estado Atual

### 2.1 Funcionamento Atual

```typescript
const NAV_PAGES = [
  { path: '/', label: 'Início', icon: Home },
  { path: '/expenses', label: 'Despesas', icon: TrendingDown },
  // ... 5 páginas estáticas
]

const filteredPages = useMemo(() => {
  if (!searchQuery.trim()) return []
  const q = searchQuery.toLowerCase()
  return NAV_PAGES.filter((p) => p.label.toLowerCase().includes(q))
}, [searchQuery])
```

**Limitações:**
- ❌ Não pesquisa em dados reais do usuário
- ❌ Resultado é apenas navegação de página
- ❌ Sem pré-visualização de valores, datas ou categorias
- ❌ Sem seccionamento por tipo de entidade
- ❌ Sem highlight do termo pesquisado

### 2.2 Arquivo Afetado

- `src/components/TopBar.tsx` — componente principal (~150 linhas)
- `src/index.css` — estilos do TopBar (a busca usa classes `topbar-search-bar`)

### 2.3 Hooks e Dados Disponíveis

| Hook | Fonte | Dados | Tamanho Típico |
|------|-------|-------|-----------------|
| `useExpenses()` | Supabase (cached) | `Expense[]` com `Category` | 10-200/mês |
| `useIncomes()` | Supabase (cached) | `Income[]` com `IncomeCategory` | 2-50/mês |
| `useDebts()` | Supabase (cached) | `Debt[]` com `Expense` | 5-50 |
| `useCreditCards()` | Supabase (cached) | `CreditCard[]` | 1-5 |
| `useCategories()` | Supabase (cached) | `Category[]` | 5-30 |
| `useIncomeCategories()` | Supabase (cached) | `IncomeCategory[]` | 2-15 |
| Portfolio transactions | Serviço próprio | `PortfolioTransaction[]` | 5-500 |

---

## 3. Escopo da Busca

### 3.1 Entidades Pesquisáveis

| Entidade | Campos Pesquisáveis | Prioridade | Ícone |
|----------|---------------------|------------|-------|
| **Despesas** | `description`, `category.name`, `amount` (textual), `date`, `payment_method` | 🔴 Alta | `TrendingDown` |
| **Rendas** | `description`, `income_category.name`, `amount` (textual), `date`, `type` | 🔴 Alta | `TrendingUp` |
| **Dívidas/Contas** | `name`, `description`, `amount` (textual), `due_date`, `type`, `status` | 🔴 Alta | `Receipt` |
| **Investimentos** | `ticker`, `operation_type`, `description`, `date` | 🟡 Média | `PiggyBank` |
| **Cartões** | `name`, `brand` | 🟢 Baixa | `CreditCard` |
| **Categorias** | `name` | 🟢 Baixa | `Tags` |

### 3.2 Critérios de Pesquisa

Para cada query do usuário, a busca deve:
1. **Correspondência exata** — termos que aparecem em descrições ou nomes
2. **Correspondência parcial** — prefixos e substring (ex: "merc" encontra "Supermercado")
3. **Correspondência numérica** — valores aproximados (ex: "150" encontra despesas de R$ 150,00)
4. **Correspondência de data** — meses formatados (ex: "janeiro" ou "2026-01")
5. **Correspondência por tipo** — palavras-chave como "despesa", "renda", "investimento", "cartão", "conta", "dívida"

### 3.3 Seções de Resultados

Os resultados devem ser agrupados por tipo de entidade:

```
🔍 "mercado"
  ── Despesas (3) ──
    • R$ 89,90 | Supermercado | 15/01/2026
    • R$ 234,50 | Supermercado | 22/01/2026
    • R$ 45,00 | Supermercado | 28/01/2026
  ── Categorias (1) ──
    • Supermercado (categoria de despesa)
```

Se apenas 1-2 entidades forem encontradas em uma categoria, pode-se omitir o cabeçalho de seção e usar um badge de tipo ao lado de cada resultado.

---

## 4. Arquitetura Proposta

### 4.1 Novos Arquivos

| Arquivo | Função | Linhas Estimadas |
|---------|--------|-------------------|
| `src/utils/searchEngine.ts` | Motor de busca puro (sem dependências React) — filtra, pontua e agrupa resultados | ~150 |
| `src/components/TopBarSearchResults.tsx` | Componente de dropdown de resultados (extraído do TopBar) | ~200 |

### 4.2 Arquivos Modificados

| Arquivo | Mudança | Linhas Alteradas |
|---------|---------|------------------|
| `src/components/TopBar.tsx` | Substituir busca estática por hook de dados + motor de busca | ~100 |
| `src/index.css` | Adicionar estilos para resultados da busca (opcional, pode ser só Tailwind) | ~20 |

### 4.3 Motor de Busca (searchEngine.ts)

```typescript
interface SearchResult {
  id: string
  type: 'expense' | 'income' | 'debt' | 'investment' | 'credit_card' | 'category' | 'page'
  title: string
  subtitle: string
  value?: number
  date?: string
  icon: React.ComponentType<{ size?: number }>
  iconColor: string
  badge?: { text: string; color: string }
  path: string          // URL de navegação do resultado
  score: number         // Pontuação de relevância (para ordenação)
  highlights?: {        // Posições para highlight no texto
    field: 'title' | 'subtitle'
    start: number
    end: number
  }[]
}

function searchAll(query: string, data: SearchableData): SearchResult[]
```

### 4.4 Pontuação de Relevância

| Critério | Pontos | Exemplo |
|----------|--------|---------|
| Match exato no título | 100 | "mercado" em "Supermercado" |
| Match parcial no título | 60 | "merc" em "Supermercado" |
| Match na descrição | 40 | "comprei" em descrição |
| Match no valor | 30 | "150" em "R$ 150,00" |
| Match na categoria | 50 | "transporte" na categoria |
| Match no nome da entidade | 70 | "despesa" filtra tipo despesa |
| Entidade mais recente | +10 | Últimos 7 dias |

### 4.5 Data Flow

```
TopBar.tsx
  ├── useState: searchQuery, isSearchFocused
  ├── useMemo: searchResults ← searchEngine(searchQuery, data)
  │     └── data: {
  │           expenses: useExpenses(currentMonth),
  │           incomes: useIncomes(currentMonth),
  │           debts: useDebts(),
  │           creditCards: useCreditCards(),
  │           categories: useCategories(),
  │           portfolioTransactions: portfolioTransactions
  │         }
  └── render: input + dropdown de resultados
        └── TopBarSearchResults.tsx (componente extraído)
```

### 4.6 Questão Crítica: Onde Buscar os Dados?

**Problema:** O `TopBar` está fora do contexto de dados do Dashboard. As páginas que usam `useExpenses`, `useIncomes` etc. são carregadas apenas quando navegamos para elas. O `TopBar` é global, renderizado no `Layout.tsx`.

**Solução 1 (Recomendada):** Criar um hook `useSearchData` que carrega dados agregados para busca:

```typescript
// src/hooks/useSearchData.ts
function useSearchData() {
  const currentMonth = getCurrentMonthString()
  const prevMonth = addMonths(currentMonth, -1)
  
  // Carrega apenas os dados necessários para busca (últimos 3 meses)
  const { expenses } = useExpenses(currentMonth)
  const { expenses: prevExpenses } = useExpenses(prevMonth)
  const { incomes } = useIncomes(currentMonth)
  const { incomes: prevIncomes } = useIncomes(prevMonth)
  const { debts } = useDebts()
  const { creditCards } = useCreditCards()
  const { categories } = useCategories()
  
  // Transações de portfólio — carregar via serviço
  const [portfolioTransactions, setPortfolioTransactions] = useState<PortfolioTransaction[]>([])
  useEffect(() => { loadPortfolioTransactions() }, [])
  
  // Consolidar tudo em um único objeto memoizado
  const searchableData = useMemo(() => ({
    expenses: [...expenses, ...prevExpenses],
    incomes: [...incomes, ...prevIncomes],
    debts,
    creditCards,
    categories,
    portfolioTransactions,
  }), [expenses, prevExpenses, incomes, prevIncomes, debts, creditCards, categories, portfolioTransactions])
  
  return searchableData
}
```

**Vantagens:**
- Dados já estão disponíveis (hooks existentes)
- Cache do Supabase/locais já funciona
- Sem chamadas extras ao servidor

**Desvantagens:**
- Dispara carregamento de dados de múltiplas entidades mesmo que o usuário nunca abra a busca
- Pode aumentar o tempo de carregamento inicial do Layout

**Solução Alternativa (Busca sob demanda):** Carregar dados apenas quando o usuário começa a digitar:

```typescript
// Dentro do TopBar
useEffect(() => {
  if (searchQuery.length < 2) return
  
  const timer = setTimeout(() => {
    // Carregar dados de busca conforme necessário
  }, 200)
  
  return () => clearTimeout(timer)
}, [searchQuery])
```

**Recomendação:** Usar Solução 1 (dados pré-carregados) porque:
- O Layout já carrega dados em segundo plano via `useBackgroundCache`
- O impacto de carregar listas frescas de 2 meses de dados é mínimo (já estão em cache)
- A busca será instantânea (sem delay de rede ao digitar)

---

## 5. Plano de Implementação por Fases

### Fase 1: Motor de Busca (searchEngine.ts) ⏱ ~1h

**Objetivo:** Criar a função pura `searchAll()` que recebe query + dados e retorna resultados pontuados.

**Arquivo:** `src/utils/searchEngine.ts`

**Passos:**

1. Definir tipos `SearchResult`, `SearchableData`, `SearchGroup`
2. Implementar função `searchExpenses(query, expenses)`:
   - Filtrar por `description` (case-insensitive)
   - Filtrar por `category.name` (case-insensitive)
   - Filtrar por `amount` como texto (ex: "150" → R$ 150,00)
   - Filtrar por mês/ano na data
   - Retornar array de `SearchResult` com score
3. Implementar função `searchIncomes(query, incomes)` (similar)
4. Implementar função `searchDebts(query, debts)`
5. Implementar função `searchCreditCards(query, cards)`
6. Implementar função `searchCategories(query, categories)`
7. Implementar função `searchInvestments(query, transactions)`
8. Implementar `searchAll(query, data)` que combina todos os resultados, ordena por score e limita a ~10 itens no total

**Testes:** Criar `src/utils/searchEngine.test.ts` com dados mockados para cada tipo de busca.

### Fase 2: Hook useSearchData ⏱ ~1h

**Objetivo:** Hook que consolida todos os dados pesquisáveis em um único objeto.

**Arquivo:** `src/hooks/useSearchData.ts`

**Passos:**

1. Importar hooks: `useExpenses`, `useIncomes`, `useDebts`, `useCreditCards`, `useCategories`
2. Carregar dados do mês atual e anterior (2 meses de dados para busca)
3. Carregar transações de portfólio (via `fetchAllPortfolioTransactions`)
4. Consolidar em `searchableData` memoizado
5. Exportar `useSearchData` hook

### Fase 3: Componente TopBarSearchResults ⏱ ~1.5h

**Objetivo:** Componente de dropdown de resultados, extraído do TopBar para manter o código organizado.

**Arquivo:** `src/components/TopBarSearchResults.tsx`

**Passos:**

1. Criar componente que recebe `results: SearchResult[]` + `onSelect: (result) => void` + `query: string`
2. Renderizar resultados agrupados por tipo (Despesas, Rendas, etc.)
3. Cada resultado mostra:
   - Ícone com cor do tipo
   - Título com highlight do termo buscado
   - Subtítulo (categoria + data)
   - Valor formatado à direita
   - Badge de seção (ex: "Despesa", "Renda")
4. Resultado vazio: mensagem "Nenhum resultado encontrado"
5. Animações de entrada (framer-motion) herdadas do dropdown atual

### Fase 4: Integração no TopBar ⏱ ~1h

**Objetivo:** Substituir a busca atual de páginas pela nova busca global.

**Arquivo:** `src/components/TopBar.tsx`

**Passos:**

1. Importar `useSearchData` e `searchAll` do motor de busca
2. Substituir `NAV_PAGES` por busca global:
   ```typescript
   const searchableData = useSearchData()
   const searchResults = useMemo(() => {
     if (!searchQuery.trim() || searchQuery.length < 2) return []
     return searchAll(searchQuery, searchableData).slice(0, 12)
   }, [searchQuery, searchableData])
   ```
3. Manter suporte a busca de páginas como fallback (se searchResults vazio, mostrar NAV_PAGES)
4. Implementar `handleSelect(result)` que navega para `result.path`
5. Substituir `<AnimatePresence>` para renderizar `<TopBarSearchResults>` em vez de `filteredPages`

### Fase 5: Navegação Contextual ⏱ ~1h

**Objetivo:** Garantir que cada resultado navegue para o local correto.

| Tipo | Path | Parâmetros |
|------|------|------------|
| `expense` | `/expenses` | Foco no ID (via search params) |
| `income` | `/incomes` | Foco no ID |
| `debt` | `/contas` | Foco no ID |
| `credit_card` | `/contas` | Abrir aba do cartão |
| `category` | `/categories` | Scroll para categoria |
| `investment` | `/investments` | Foco no ticker |

Implementar suporte a `searchParams` nas páginas alvo para destacar o item selecionado via busca:

```typescript
// Ao selecionar:
navigate(`${result.path}?highlight=${result.id}`)

// Na página de destino (ex: Expenses.tsx):
const [searchParams] = useSearchParams()
const highlightId = searchParams.get('highlight')
// Scrollar/ destacar o item com highlightId
```

### Fase 6: Estilização e Refinamento ⏱ ~1h

**Objetivo:** Polir o visual dos resultados, animações, estados.

**Passos:**

1. Adicionar classes de highlight no termo buscado (`<mark>` ou span com `bg-primary/20`)
2. Adicionar animação de entrada para cada grupo de resultados
3. Adicionar suporte a teclado (setas ↑↓ para navegar, Enter para selecionar)
4. Adicionar loading state enquanto dados carregam
5. Adicionar debounce de 150ms na digitação para evitar re-renders desnecessários

---

## 6. Componentes de UI

### 6.1 Estrutura do Resultado

```tsx
<div className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-secondary/10 transition-colors">
  {/* Ícone do tipo com cor */}
  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
       style={{ backgroundColor: `${iconColor}15`, color: iconColor }}>
    <Icon size={15} />
  </div>
  
  {/* Informações principais */}
  <div className="flex-1 min-w-0">
    <p className="text-xs font-semibold text-primary truncate">
      <HighlightText text={result.title} query={query} />
    </p>
    <p className="text-[10px] text-secondary truncate">
      {result.subtitle}
    </p>
  </div>
  
  {/* Valor e badge */}
  <div className="text-right shrink-0">
    {result.value !== undefined && (
      <p className="text-xs font-bold font-mono text-primary">
        {formatCurrency(result.value)}
      </p>
    )}
    {result.date && (
      <p className="text-[9px] text-secondary">{formatDate(result.date)}</p>
    )}
  </div>
  
  {/* Badge de tipo (opcional, mostrado quando sem header de seção) */}
  {result.badge && (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
          style={{ backgroundColor: `${result.badge.color}15`, color: result.badge.color }}>
      {result.badge.text}
    </span>
  )}
</div>
```

### 6.2 Mapa de Cores por Tipo

| Tipo | Cor do Ícone | Fundo do Ícone |
|------|-------------|----------------|
| Despesa | `var(--color-expense)` | `var(--color-expense) / 10` |
| Renda | `var(--color-income)` | `var(--color-income) / 10` |
| Dívida/Conta | `var(--color-warning)` | `var(--color-warning) / 10` |
| Investimento | `var(--color-balance)` | `var(--color-balance) / 10` |
| Cartão | `var(--color-primary)` | `var(--color-primary) / 10` |
| Categoria | `var(--color-text-secondary)` | `var(--color-text-secondary) / 10` |
| Página | `var(--color-text-secondary)` | `var(--color-text-secondary) / 10` |

---

## 7. Integração com o Roteamento

### 7.1 URLs de Destino

| Tipo | Rota | Lógica de Foco |
|------|------|----------------|
| `expense` | `/expenses` | Adicionar `?highlight={id}` ao path. Expenses.tsx lê o param e faz scroll via `useEffect` + `document.getElementById`. |
| `income` | `/incomes` | Mesmo mecanismo. |
| `debt` | `/contas` | Navegar para aba "Dívidas" e destacar. |
| `investment` | `/investments` | Navegar com ticker como search param. |
| `page` | Rota direta | Navegação padrão (já implementada). |

### 7.2 Implementação do Highlight

Em cada página alvo, adicionar:

```typescript
// Dentro do componente de página
const [searchParams] = useSearchParams()
const highlightId = searchParams.get('highlight')

useEffect(() => {
  if (highlightId) {
    const el = document.getElementById(`item-${highlightId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-primary', 'rounded-lg')
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 3000)
    }
  }
}, [highlightId])
```

---

## 8. Considerações de Performance

### 8.1 Debounce na Digitação

```typescript
const [debouncedQuery, setDebouncedQuery] = useState('')

useEffect(() => {
  const timer = setTimeout(() => setDebouncedQuery(searchQuery), 150)
  return () => clearTimeout(timer)
}, [searchQuery])
```

### 8.2 Limite de Resultados

- Máximo de **12 resultados** no total
- Máximo de **5 resultados por seção** (para evitar dominância de uma entidade)

### 8.3 Memoização

- `searchResults` memoizado com `useMemo` (dependências: `debouncedQuery`, `searchableData`)
- `searchableData` memoizado com `useMemo` (dependências: cada array de dados)

### 8.4 Lazy Loading de Dados

- `useSearchData` só carrega dados quando `isSearchFocused` ou `searchQuery.length >= 2`
- Evita carregar dados desnecessários quando a busca não está ativa

---

## 9. Métricas de Sucesso

| Métrica | Estado Atual | Meta |
|---------|-------------|------|
| Resultados por busca | 0 (só páginas) | ≥ 5 resultados reais |
| Tipos de entidade pesquisáveis | 0 | 6 (despesa, renda, dívida, investimento, cartão, categoria) |
| Tempo de resposta | Instantâneo (só filtro local) | < 50ms (filtro local em arrays de até 500 itens) |
| Highlight do termo | ❌ | ✅ Termo destacado nos resultados |
| Navegação contextual | ❌ | ✅ Cada resultado leva ao local correto |
| Suporte a teclado | ❌ | ✅ Seta ↑↓ + Enter |
| Seccionamento | Sem seções | ✅ Agrupado por tipo de entidade |
| Testes do motor de busca | 0 | ≥ 10 testes |

---

## 10. Glossário de Dados

### 10.1 Expense

```typescript
interface Expense {
  id: string
  amount: number          // R$ 150,00
  description?: string    // "Compras no supermercado"
  date: string            // "2026-01-15"
  category?: Category     // { id, name: "Supermercado", color }
  payment_method?: string // "credit_card" | "cash" | "pix" | ...
}
```

**Exibição:** `R$ 150,00 | Supermercado | 15/01/2026`

### 10.2 Income

```typescript
interface Income {
  id: string
  amount: number
  description?: string
  date: string
  income_category?: IncomeCategory
  type: string  // "cash" | "pix" | ...
}
```

**Exibição:** `R$ 5.000,00 | Salário | 05/01/2026`

### 10.3 Debt

```typescript
interface Debt {
  id: string
  name: string           // "Aluguel"
  description?: string
  amount: number
  due_date: string
  type: 'payable' | 'receivable'
  status: 'pending' | 'paid'
}
```

**Exibição:** `R$ 1.200,00 | Aluguel (pendente) | 10/01/2026`

### 10.4 PortfolioTransaction

```typescript
interface PortfolioTransaction {
  id: string
  ticker: string          // "PETR4"
  operation_type: string  // "buy" | "sell" | "dividend"
  quantity: number
  price: number
  date: string
}
```

**Exibição:** `PETR4 | Compra 100 ações | R$ 2.500,00 | 15/01/2026`

### 10.5 CreditCard

```typescript
interface CreditCard {
  id: string
  name: string         // "Nubank"
  brand?: string       // "Mastercard"
}
```

**Exibição:** `Nubank (Mastercard)`

### 10.6 Category

```typescript
interface Category {
  id: string
  name: string         // "Supermercado"
  color: string        // Código de cor
}
```

**Exibição:** `Supermercado (categoria de despesa)`

---

## 📊 Resumo do Esforço

| Fase | Nome | Arquivos | Esforço | Dependências |
|------|------|----------|---------|--------------|
| 1 | 🔧 Motor de Busca | `searchEngine.ts` + test | ~1h | Nenhuma |
| 2 | 🔧 Hook de Dados | `useSearchData.ts` | ~1h | Fase 1 |
| 3 | 🎨 Componente de Resultados | `TopBarSearchResults.tsx` | ~1.5h | Fase 1 |
| 4 | 🔗 Integração no TopBar | `TopBar.tsx` | ~1h | Fases 2+3 |
| 5 | 🧭 Navegação Contextual | Páginas alvo | ~1h | Fase 4 |
| 6 | 🎨 Refinamento Visual | `TopBar.tsx`, CSS | ~1h | Fase 4 |

**Esforço total estimado:** ~6.5h distribuídas em 6 fases.

---

## Pré-commit Checklist

Antes de cada merge:

- [ ] `npx tsc --noEmit` → 0 erros
- [ ] `npx vitest run src/utils/searchEngine.test.ts` → todos verdes
- [ ] `npm run build` → Build OK
- [ ] Testar busca para cada tipo de entidade no browser
- [ ] Verificar que a navegação para cada tipo de resultado funciona
- [ ] Verificar que highlight do termo está visível
- [ ] Sem `console.log` residual

---

> **Documentos relacionados:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) — [`COMPLETE_GUIDE.md`](./COMPLETE_GUIDE.md) — [`REFINEMENT_PLAN.md`](./REFINEMENT_PLAN.md)
