# Painel Completo (Grid): Dashboard de Acompanhamento

## Objetivo
Transformar o modo "Painel Completo (Grid)" em um dashboard exclusivo de **monitoramento visual** — sem nenhuma funcionalidade de relatório, notas, ledger ou faturamento. Adicionar 6 novos blocos analíticos com gráficos ricos.

---

## O que sai do Grid
- `AdvisorNotes` (notas privadas)
- `BillingReportCard` (simulação de fee)
- `LedgerBook` (livro-razão de transações)
- `QualitativeAnalysis` (teses e PDF)

Esses componentes continuam disponíveis **apenas nas abas**.

---

## Novos Blocos Analíticos no Grid

### 1. `SectorExposureChart` [NOVO]
- Gráfico **Donut** da exposição atual por setor econômico
- Usa `calculateConsolidatedBySector()` do `investmentEngine`
- Palette de cores automática por setor
- Tooltip com valor R$ e % atual

### 2. `ClassExposureChart` [NOVO — melhoria do existente]
- Gráfico **Donut** da exposição por classe de ativo (similar ao existente, mas mais rico)
- Adiciona legenda lateral com `valor R$`, `%atual` vs `%meta`
- Indicador de desvio colorido (+/- em relação à meta)

### 3. `ExposureVsLimitsChart` [NOVO]
- Gráfico de **barras horizontais agrupadas** (Recharts `BarChart`)
- Para cada ativo: barra azul = exposição atual (%), barra verde = meta (%)
- Linha de referência visual para o limite
- Ordenado por maior desvio absoluto
- Destaca em vermelho ativos com desvio > 5%

### 4. `WeeklyVariationChart` [NOVO]
- Gráfico de **linha** (LineChart) da evolução da cota da carteira
- Usa `shareHistory` já calculado
- Mostra os últimos N pontos do histórico
- Tooltip com data e valor da cota
- Gradiente fill abaixo da linha

### 5. `PerformanceMetricsCard` [NOVO]
- Card visual com os indicadores calculados por `calculatePerformanceMetrics()`:
  - **Índice Sharpe** com gauge visual (arco colorido)
  - Volatilidade mensal
  - Retorno médio mensal
  - Beta vs IBOV / S&P 500
- Interpretação textual automática (ex: "Sharpe > 1 = Boa relação risco/retorno")

### 6. `BenchmarkComparisonTable` [NOVO]
- **Tabela comparativa** de rentabilidade por classe de ativo vs benchmark de referência
- Benchmarks por classe (estáticos, atualizados com valores fixos de referência):
  | Classe | Benchmark | Fonte |
  |---|---|---|
  | Ações Nacionais | IBOVESPA | Retorno fixo mensal/anual |
  | Ações Internacionais | S&P 500 | Retorno fixo |
  | FIIs | IFIX | Retorno fixo |
  | Renda Fixa | CDI | 10.75% a.a. |
  | Cripto | BTC | Retorno fixo |
- Colunas: Classe · Valor · % carteira · Rentabilidade · Benchmark · Diferença (alpha)
- Células coloridas: verde = supera benchmark, vermelho = abaixo

---

## Layout do Grid Reformulado

```
┌─────────────────────────────────┐
│ KPI Cards (largura total)        │
├──────────────┬──────────────────┤
│ ClassExposure│ SectorExposure   │
├──────────────┴──────────────────┤
│ ExposureVsLimitsChart (full)     │
├──────────────┬──────────────────┤
│ WeeklyChart  │ PerformanceCard  │
├──────────────┴──────────────────┤
│ BenchmarkComparisonTable (full)  │
├──────────────────────────────────┤
│ PositionsTable (full)            │
└──────────────────────────────────┘
```

---

## Arquivos

### [NEW] `src/components/consulting/SectorExposureChart.tsx`
### [NEW] `src/components/consulting/ExposureVsLimitsChart.tsx`
### [NEW] `src/components/consulting/WeeklyVariationChart.tsx`
### [NEW] `src/components/consulting/PerformanceMetricsCard.tsx`
### [NEW] `src/components/consulting/BenchmarkComparisonTable.tsx`
### [MODIFY] `src/components/consulting/ClientAllocationCharts.tsx` — enriquecer com legenda lateral e desvios
### [MODIFY] `src/pages/ConsultantDashboard.tsx` — reformular grid mode, passar novos dados (shareHistory, metrics, consolidatedClass, consolidatedSector)

---

## Dados já disponíveis no Dashboard
- `positions`, `portfolioValue`, `groupTargets` ✓
- `calculateShareHistory()` → `shareHistory` — calcular no useMemo ✓
- `calculatePerformanceMetrics()` → `metrics` — calcular no useMemo ✓
- `calculateConsolidatedByClass()` → `consolidatedClass` — calcular no useMemo ✓
- `calculateConsolidatedBySector()` → `consolidatedSector` — calcular no useMemo ✓

---

## Verification Plan
- `npm run build` zero erros TypeScript
- Verificar visualmente: grid sem ledger/notas/PDF, com todos os gráficos renderizando
