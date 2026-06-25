# Plano de Refatoração — Modal de Conciliação B3

## 📋 Status Atual

### ✅ Concluído

#### Fase 1.1: Hook `useReconciliationState` extraído
- **Arquivo:** `src/hooks/useReconciliationState.ts` (1333 linhas)
- Contém toda a lógica de estado e negócio do modal de conciliação
- Exporta tipos: `ReconciliationStep`, `CorrectionsTab`, `MissingDraft`, `ConflictDraft`
- Retorna ~60 valores (estado, refs, setters, handlers)

#### Fase 1.2–1.7: Componentes de Step criados (10 arquivos)
Todos em `src/components/investments/reconciliation/`:

| Arquivo | Propósito |
|---------|-----------|
| `StepUpload.tsx` | Upload duplo (movimentação + posição) com drag & drop |
| `StepSummary.tsx` | Diagnóstico com anel de progresso SVG, KPI grid, preview de posição |
| `StepCorrections.tsx` | Abas de navegação entre conflicts/missing/suspicious |
| `CorrectionsConflictsTab.tsx` | Lista de conflitos com seleção e aplicação em lote |
| `CorrectionsMissingTab.tsx` | Lista de itens faltantes com edição inline |
| `CorrectionsSuspiciousTab.tsx` | Itens exclusivos do livro-razão com deleção |
| `StepYieldConfig.tsx` | Configuração de indexador/vencimento para RF/Tesouro |
| `StepPosition.tsx` | Validação de posição B3 com painel e ajustes |
| `StepReview.tsx` | Tela de conclusão com resumo da auditoria |
| `ReconciliationFooter.tsx` | Footer dinâmico com navegação entre steps |

#### Fase 1.8: Modal `InvestmentReconciliationModal.tsx` refatorado ✅
- **Arquivo:** `src/components/investments/InvestmentReconciliationModal.tsx` (~270 linhas)
- **Antes:** ~2356 linhas monolíticas (~100k chars)
- **Depois:** ~270 linhas, usando `useReconciliationState` + 6 step components + `ReconciliationFooter`
- **Resultado:** Redução de ~89% no tamanho do componente
- **Validação:** `tsc --noEmit` zero erros, `vitest run` 187/187 testes passando

#### Correções de TypeScript (10 erros) ✅
| # | Arquivo | Correção |
|---|---------|----------|
| 1 | `CorrectionsMissingTab.tsx` | Adicionado `as PortfolioPricingMode` no onChange + import do tipo |
| 2 | `ReconciliationFooter.tsx` | Removido `MissingDraft` do import |
| 3 | `StepCorrections.tsx` | Removido `PortfolioTransaction` do import |
| 4 | `StepPosition.tsx` | Removida prop `onSetPositionDragActive` não usada |
| 5 | `StepSummary.tsx` | Removido `useMemo` do import |
| 6–9 | `StepUpload.tsx` | Removidas 4 props não usadas (`onFileUpload`, `onPositionFileChange`, `onSetDragActive`, `onSetPositionDragActive`) |
| 10 | `useReconciliationState.ts` | Removido `isPortfolioIncomeType` do import |

#### Fase 2: Separação do `investmentExcelReconciliation.ts` em módulos coesos ✅

**Problema original:** `investmentExcelReconciliation.ts` (~770 linhas) continha parser B3, engine de matching e validação de posição no mesmo arquivo — alta coesão artificial, risco de regressão cruzada.

**Solução:** Dividido em 3 módulos independentes, com barrel re-export para compatibilidade total:

| Módulo | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| **Parser B3** | `src/utils/b3ExcelParser.ts` (~460 linhas) | `parseB3Excel`, `parseB3PositionExcel`, `classifyB3Item`, `classifyB3Movement`, `parseB3Product`, `mapB3OperationType`, `deduplicateB3Items`, `isB3PositionWorkbook` + tipos associados |
| **Matching** | `src/utils/investmentReconciliation.ts` (~200 linhas) | `scoreInvestmentMatch`, `reconcileInvestmentTransactions`, interfaces de conflito/resultado |
| **Posição** | `src/utils/positionValidation.ts` (~260 linhas) | `buildPositionValidation`, `suggestPositionAdjustments`, `computePositionsFromB3Items`, tipos de validação |
| **Barrel** | `src/utils/investmentExcelReconciliation.ts` (~30 linhas) | Re-export de todas as exportações dos 3 módulos — **nenhum import existente precisa ser alterado** |

**Validação:**
- ✅ `tsc --noEmit` — zero erros
- ✅ 187/187 testes passando (incluindo 34 testes do próprio módulo de reconciliação)
- ✅ Revisão de código — sem dependências circulares, sem duplicação

### ✅ Concluído

#### Fase 3: Hook `useReconciliationState.ts` dividido em 4 arquivos ✅

**Problema original:** `useReconciliationState.ts` (~1330 linhas) continha parsing, drafts, operações de DB e navegação tudo junto — alta complexidade, difícil de testar e manter.

**Solução:** Dividido em 3 hooks especializados + 1 composer:

| Módulo | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| **Files** | `src/hooks/useReconciliationFiles.ts` (~220 linhas) | Upload, parse de arquivos, drag & drop, posições derivadas, validação de posição |
| **Drafts** | `src/hooks/useReconciliationDrafts.ts` (~120 linhas) | Missing/conflict/imported drafts, edição inline, derived `manualYieldRequiredAssets` |
| **Actions** | `src/hooks/useReconciliationActions.ts` (~480 linhas) | Operações de DB: apply conflicts, import missing, save yield, position adjustments, delete |
| **Composer** | `src/hooks/useReconciliationState.ts` (~200 linhas) | Orquestra os 3 hooks + navegação (wizard steps, stepper) + efeitos (auto-scroll, auto-tab) |

**Bugs corrigidos durante a refatoração:**
- `goToNextStepAfter` ausente das deps de `handleApplySelectedConflicts` — stale closure na navegação
- `selectedAdjustmentTickers` → `selectedAdjTickers` — dep array referenciava variável inexistente
- Dead code removido: handlers de drag/file duplicados no sub-hook Files
- Imports não usados removidos (`isB3TickerPattern`, `PortfolioOperationType`, `hasYieldAssets`)

**Validação:**
- ✅ `tsc --noEmit` — zero erros
- ✅ 187/187 testes passando
- ✅ Sem dependências circulares entre os 4 hooks
- ✅ Todos os tipos (`MissingDraft`, `ConflictDraft`, `ReconciliationStep`, `CorrectionsTab`) re-exportados

### 🔴 Próximas Fases (Priorizadas)

Nenhuma fase pendente. As 7 fases do plano original foram concluídas.

| Fase | Descrição | Status |
|------|-----------|--------|
| **Fase 4** | Testes unitários para hooks de reconciliação (51 testes) | ✅ |
| **Fase 5** | Extração de lógica compartilhada de cash offset | ✅ |
| **Fase 6** | Feedback de erro no parser B3 (mensagens em português) | ✅ |
| **Fase 7** | Refinamento UI/UX da conciliação (Input, Select, tema) | ✅ |

---

## 📐 Arquitetura Atual (Implementada)

```
InvestmentReconciliationModal (~270 linhas)
  ├── useReconciliationState (composer ~200 linhas)
  │   ├── useReconciliationFiles.ts   — parse, upload, drag, posições
  │   ├── useReconciliationDrafts.ts  — drafts, edição inline
  │   └── useReconciliationActions.ts — DB operations
  ├── StepUpload
  ├── StepSummary
  ├── StepCorrections
  │   ├── CorrectionsConflictsTab
  │   ├── CorrectionsMissingTab
  │   └── CorrectionsSuspiciousTab
  ├── StepYieldConfig
  ├── StepPosition
  ├── StepReview
  └── ReconciliationFooter

Utils (módulos independentes):
  ├── b3ExcelParser.ts              — parseB3Excel, parseB3PositionExcel, classify*, normalize*
  ├── investmentReconciliation.ts   — scoreInvestmentMatch, reconcileInvestmentTransactions
  ├── positionValidation.ts         — buildPositionValidation, suggestPositionAdjustments
  └── investmentExcelReconciliation.ts  — barrel re-export (compatibilidade)
```

### Separação de Responsabilidades
- **Composer:** Orquestração dos 3 sub-hooks + navegação + efeitos
- **Sub-hooks:** Responsabilidade única (files, drafts, actions)
- **Step Components:** Renderização pura, recebem props + callbacks
- **Modal:** Passa props do hook para os steps, gerencia footer/stepper
- **Utils Módulos:** Lógica de negócio pura, testável isoladamente, sem dependência de React/Supabase

### Benefícios Alcançados
1. ~2356 → ~270 linhas no modal principal (redução de ~89%)
2. Lógica de negócio testável isoladamente (hooks + utils)
3. Componentes de UI reutilizáveis e testáveis
4. `investmentExcelReconciliation.ts` reduzido de ~770 → ~30 linhas (barrel)
5. `useReconciliationState.ts` reduzido de ~1330 → ~200 linhas (composer), com 3 sub-hooks especializados
6. Cada arquivo com responsabilidade única
7. 3 bugs corrigidos durante a refatoração (stale closures, dep array errado, dead code)
8. Sem dependências circulares entre módulos
9. `tsc --noEmit` com zero erros
10. 187/187 testes passando

---

## ⚠️ Observações

- Os componentes legados `B3ReconciliationGuidance`, `B3ReconciliationKpiGrid`, `B3PositionValidationPanel`, `InvestmentConflictCard`, `AssetYieldConfigCard`, `SuspiciousInvestmentCard`, e `B3ReconciliationStepper` continuam sendo usados pelos novos componentes.
- O estado é resetado automaticamente ao reabrir o modal via `resetAllState()` chamado no `useEffect` de `isOpen`.
- O modal refatorado inclui `handleGoBack()` com navegação correta entre todos os steps.
- A refatoração em módulos preservou 100% das exportações originais — nenhum arquivo consumidor precisou ser modificado.
