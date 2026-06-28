# Blueprint do Sistema Quantamental: Gestão Indicativa de Portfólio

> **Última atualização:** Junho de 2026 — Sistema Quantamental implementado e funcional.

---

## 1. Módulo de Configuração Global (User Preferences & Constraints)

A funcionalidade apresenta informações de forma criativa e interativa, evitando telas únicas de configurações. O sistema trabalha de forma automática no que pode ser definido por ele próprio (dados de APIs financeiras, classificação de ativos, cálculos quantitativos) e guia o usuário de forma fluída nas decisões que dependem exclusivamente dele (avaliação qualitativa, metas de alocação). A experiência é educativa, explicando os fundamentos através de "pílulas de informação" sutis e integradas à interface.

### A. Alocação Macro (Asset Allocation)

O usuário define o percentual ideal de patrimônio que deseja ter em cada classe de ativo. A soma deve ser **estritamente igual a 100%**.

**Implementação atual:** Componente `ExposureLimitsEditor.tsx` com validação em tempo real da soma dos percentuais e auto-save quando a soma atinge 100%. Metas persistidas na tabela `portfolio_group_targets`.

* Classes de ativos suportadas: `Ações Nacionais`, `Ações Internacionais`, `Fundos Imobiliários`, `ETFs`, `Renda Fixa`, `Criptoativos`, `Saldo em Caixa`.
* Validação: a soma total dos percentuais é exibida em tempo real. Acima de 100% o editor exibe alerta visual e bloqueia o save.
* A classe **Caixa** atua como classe de segurança e destino de aportes quando não há ativos enquadrados para receber capital.

### B. Limites Relativos de Convicção (Tiers)

O usuário estipula o peso máximo que um ativo pode ocupar **dentro de sua respectiva classe**, baseado na nota final (Score de Qualidade Híbrido).

**Implementação atual:** Componente `QuantPreferencesEditor.tsx` com sliders e inputs numéricos. Preferências persistidas em `portfolio_quant_preferences`.

| Tier | Faixa de Score | Default | Comportamento |
|------|---------------|---------|---------------|
| **S** | 85–100 | 20% | Convicção máxima. Recebe aportes prioritários. |
| **A** | 70–84 | 10% | Convicção alta. Recebe aportes secundários. |
| **B** | 50–69 | 5% | Convicção moderada. Aportes reduzidos. |
| **C** | < 50 | 0% | Sem convicção. **Congelamento de aportes** — o ativo não recebe novos aportes mas também não é sugerida venda. |

### C. Travas Setoriais (Concentration Limits)

O usuário define o máximo que um único setor pode representar dentro de uma classe.

**Implementação atual:** Campos em `QuantPreferencesEditor.tsx`, validados pelo simulador Smart Aporte em `quantamentalEngine.ts`.

* `max_sector_acoes`: Default 30% — evita concentração excessiva em setores como Bancos ou Elétricas.
* `max_sector_fiis`: Default 45% — permite maior margem para FIIs de Papel/CRIs, comuns no Brasil.

### D. Limiares Fundamentalistas (Thresholds)

O usuário parametriza os gatilhos que o algoritmo usará para avaliar os indicadores quantitativos dos ativos.

**Implementação atual:** Campos em `QuantPreferencesEditor.tsx`, utilizados pelo motor em `quantamentalEngine.ts`.

* `min_roic_excelente`: Default 15% — ROIC acima deste valor ganha pontuação máxima (30 pts para Ações).
* `max_divida_ebitda`: Default 2.5x — Dívida Líq./EBITDA abaixo deste valor ganha pontuação máxima (30 pts para Ações).
* `scuttlebutt_decay_days`: Opções de 90, 180 ou 365 dias — período após o qual a avaliação qualitativa expira.

---

## 2. Camada Micro: Avaliação Híbrida e Factual (Bottom-Up)

A avaliação de cada ativo gera uma nota de 0 a 100 (**Score de Qualidade Híbrido**). A regra de pesos varia por classe:

* **Ações e FIIs:** `50% Scuttlebutt (Qualitativo) + 50% Fundamentos (Quantitativo)`.
  * Se a avaliação qualitativa estiver **zerada ou ausente**, o score qualitativo é **0**, resultando em um máximo de **50%** mesmo que o quantitativo seja 100%.
* **ETFs Passivos (ex: VOO, IVVB11):** `100% Fundamentos (Custos e Eficiência do Índice)`.
* **Renda Fixa e Caixa:** Não são avaliados pelo motor quantamental; possuem score de qualidade fixo de 100.

### A. Módulo Qualitativo (Scuttlebutt Parametrizado)

Substitui *sliders* de achismo por um **checklist de fatos verificáveis**. As respostas são `Sim / Não / Não se aplica`, com pontuação ponderada por pilar.

**Implementação atual:** Modal `ScuttlebuttEvaluationModal.tsx` com pilares dinâmicos, perguntas editáveis e cálculo em `calculateScuttlebuttScore()` no `quantamentalEngine.ts`.

#### Pilares Padrão (Template Global)

| Pilar | Peso | Perguntas Padrão |
|-------|------|-----------------|
| **Gestão e Governança** | 30% | Governança (Novo Mercado)? Skin in the game? Histórico limpo de escândalos? Transição de liderança planejada? |
| **Vantagem Competitiva (Moat)** | 30% | Margens superiores aos pares? Market share dominante/crescente? Barreiras de entrada elevadas? |
| **Ecossistema e Regulação** | 20% | Independência de fornecedor/cliente único? Livre de risco de controle estatal? |
| **Cultura e Inovação** | 20% | Baixo turnover executivo? Inovação aderente ao core business? |

#### Funcionalidades do Módulo Qualitativo

* **Perguntas customizáveis:** O usuário pode adicionar, editar e excluir perguntas personalizadas (vinculadas ao `portfolio_id`), mantendo o padrão de resposta `Sim/Não/N/A`.
* **Pilares personalizáveis:** Estrutura preparada para o usuário criar novos pilares com pesos customizados.
* **Redistribuição de N/A:** Quando uma pergunta é marcada como "Não se aplica", seu peso é excluído do cálculo daquele pilar e redistribuído proporcionalmente entre as demais perguntas ativas.
* **Responsividade:** Botões de editar/excluir perguntas customizadas ficam sempre visíveis em dispositivos touch; em desktop aparecem via hover.

### B. Módulo Quantitativo (Fundamentos via API + Overrides Manuais)

Integração com Yahoo Finance para coleta automática de múltiplos fundamentalistas, com fallback para **overrides manuais** definidos pelo usuário.

**Implementação atual:** 
* Dados de API em `asset_fundamentals_cache` (Supabase).
* Overrides manuais em campos `manual_*` da tabela `portfolio_asset_definitions`.
* Mesclagem (merge) via `getMergedFundamentals()` em `fundamentalsService.ts`.
* Cálculo do score via `calculateQuantitativeScore()` e detalhamento via `getQuantitativeScoreDetails()` em `quantamentalEngine.ts`.
* Alertas visuais de contraste entre dados manuais e API no `AssetConfigModal.tsx`.

#### Critérios Quantitativos por Classe de Ativo

**Ações (100 pontos possíveis):**

| Critério | Indicador | Pontuação | Fallback |
|----------|-----------|-----------|----------|
| Rentabilidade | ROIC (%) | 30 pts (≥ excelente) · 15 pts (≥ 10%) · 0 pts | Threshold definido pelo usuário |
| Saúde Financeira | Dív. Líq. / EBITDA | 30 pts (≤ max) · 15 pts (≤ 4.0) · 0 pts | Se null: 30 pts (sem dívida) |
| Valuation | P/L vs Média 5a (ou EV/EBITDA) | 20 pts (≤ média) · 0 pts | Se sem histórico: 20 pts |
| Tendência | Endividamento 2 anos | 20 pts (não cresceu) · 0 pts | — |

**Fundos Imobiliários (100 pontos possíveis):**

| Critério | Indicador | Pontuação | Fallback |
|----------|-----------|-----------|----------|
| Rendimento | Dividend Yield (%) | 40 pts (≥ 8%) · 20 pts (≥ 6%) · 0 pts | — |
| Valuation | P/VP | 30 pts (≤ 1.05) · 15 pts (≤ 1.15) · 0 pts | Se null: 30 pts |
| Operacional | Vacância Física (%) | 30 pts (≤ 10%) · 15 pts (≤ 20%) · 0 pts | Se null: 30 pts |

**ETFs (100 pontos possíveis):**

| Critério | Indicador | Pontuação | Fallback |
|----------|-----------|-----------|----------|
| Custo | Taxa de Administração (%) | 50 pts (≤ 0.3%) · 25 pts (≤ 0.6%) · 0 pts | Se null: 50 pts |
| Eficiência | Tracking Error (%) | 50 pts (≤ 2%) · 25 pts (≤ 4%) · 0 pts | Se null: 50 pts |

#### Overrides Manuais e Alertas de Contraste

O modal de configuração de ativo (`AssetConfigModal.tsx`) permite ao usuário sobrescrever manualmente qualquer indicador quantitativo. Quando um override é definido:
* O app exibe um badge **"Manual"** ao lado do campo.
* Se o valor manual **diverge** do dado automático da API, é exibido um alerta animado: `⚠️ Contrasta com a API (valor)` com opção de clicar em **"Usar API"** para reverter ao dado automático.
* Se o valor manual está **alinhado** com a API, é exibido: `✓ Alinhado com a API (valor)`.

#### Checklist de Detalhamento Quantitativo

O modal de detalhamento do ativo (`AssetDetailModal.tsx`) exibe um checklist visual de cada critério quantitativo avaliado, mostrando:
* Nome do critério e descrição do alvo.
* Valor atual formatado do indicador.
* Pontuação obtida vs máxima possível (ex: `30 / 30 pts`).
* Status visual: 🟢 **Passou** · 🟡 **Parcial** · 🔴 **Rejeitado**.

---

## 3. O Motor de Indicação (Algoritmo de Enquadramento)

A *engine* do aplicativo não emite ordens de compra/venda. Ela calcula os **limites absolutos de exposição** e o **desvio da carteira atual** em relação aos parâmetros estabelecidos pelo usuário.

**Implementação atual:** Funções `calculateAbsoluteLimit()`, `determineEnquadramentoState()` e `determineTier()` em `quantamentalEngine.ts`, orquestradas pelo `usePortfolioState.ts`.

### Passo 1: Cálculo do Limite Absoluto

Para cada ativo cadastrado (ex: BBAS3, HGLG11), o sistema executa:

$$Limite_{Absoluto (\%)} = Target_{Classe (User\,Pref)} \times Limite_{Tier (User\,Pref)}$$

**Exemplo:** Se o target de Ações é 40% e o ativo tem Tier S (limite 20%), o Limite Absoluto = 40% × 20% = **8% do portfólio total**.

### Passo 2: Determinação do Tier de Convicção

O Score de Qualidade Híbrido determina automaticamente o Tier:
* Score ≥ 85 → **Tier S**
* Score ≥ 70 → **Tier A**
* Score ≥ 50 → **Tier B**
* Score < 50 → **Tier C**

### Passo 3: Verificação do Estado de Enquadramento

O sistema compara o percentual real do ativo na carteira com o Limite Absoluto, classificando-o em quatro estados:

| Estado | Condição | Indicação Visual | Ação do Sistema |
|--------|----------|-----------------|-----------------|
| 🟢 **Em Linha** | % atual < Limite Absoluto (margem > 0.05%) | Badge verde | Há espaço para novos aportes. |
| 🟡 **Limite Atingido** | \|% atual - Limite\| ≤ 0.05% | Badge amarelo | Aportes devem ser direcionados para outros ativos. |
| 🔴 **Desenquadrado por Excesso** | % atual > Limite + 0.05% | Badge vermelho | Exibe o excesso percentual. **Não sugere venda.** |
| ⚠️ **Qualitativo Obsoleto** | Avaliação Scuttlebutt expirada | Badge pulsante | Ativo perde status "Em Linha" até refazer o checklist. |

### Passo 4: Cálculo de Gaps

Para cada ativo "Em Linha", o sistema calcula:
* **Gap Financeiro:** `(Limite Absoluto / 100) × Valor Total do Portfólio - Valor Atual do Ativo` (em R$).
* **Gap Percentual:** `Limite Absoluto - Percentual Atual do Ativo` (em %).

Estes valores alimentam a tabela de holdings (`HoldingsTable.tsx`) e o simulador Smart Aporte.

---

## 4. UI/UX: Simulador de Distribuição Matemática (Smart Aporte)

O recurso central do aplicativo para fluxo de caixa mensal é um formulário de simulação matemática que respeita toda a arquitetura quantamental construída.

**Implementação atual:** Componente `SmartAporteSimulator.tsx` com engine `simulateSmartAporte()` em `quantamentalEngine.ts`.

### Fluxo de Simulação

**Input:** Usuário digita o valor disponível para aporte (ex: R$ 1.500,00).

**Output:** O sistema processa o roteamento financeiro e **sugere** uma divisão do capital seguindo a árvore de prioridades:

1. **Cálculo Macro:** Identifica as classes de ativos (Ações, FIIs, ETFs) que estão **percentualmente mais abaixo da meta** definida nas configurações globais. Ordena pela defasagem decrescente.
2. **Filtro Micro:** Dentro de cada classe defasada, filtra apenas os ativos com status 🟢 **Em Linha** e com avaliação qualitativa **não expirada**.
3. **Ordenação por Qualidade:** Organiza os ativos filtrados do maior para o menor *Score de Qualidade Híbrido*.
4. **Distribuição Proporcional:** Divide o valor do aporte entre os ativos elegíveis, calculando **quantos lotes/cotas inteiros** podem ser comprados sem que o ativo ultrapasse seu Limite Absoluto.
5. **Exceção de Trava Setorial:** Se a alocação em um ativo faria o setor ultrapassar o teto definido (`max_sector_acoes` ou `max_sector_fiis`), o algoritmo reduz a quantia alocada e joga o excedente para o próximo ativo da lista.
6. **Rota de Fuga (Fallback):** Se todos os ativos com Score alto estiverem com limites atingidos ou desenquadrados, o simulador direciona 100% do aporte para a classe **Caixa / Reserva Tática**.

### Log de Roteamento

O simulador exibe um **log detalhado** de todo o processo de decisão, incluindo:
* Classes defasadas identificadas e suas prioridades.
* Ativos desconsiderados por avaliação qualitativa expirada.
* Ativos elegíveis ordenados por convicção.
* Alocação realizada em cada ativo (valor, quantidade, novo peso estimado).
* Ativos travados por limite absoluto ou setorial.
* Sobra residual direcionada para Caixa.

### Barra de Progresso Empilhada (Stacked Bar)

Cada ativo sugerido exibe uma barra de progresso visual:
* **Cinza/Azul:** Alocação atual do ativo.
* **Verde:** Aporte adicional sugerido.
* Ambos dimensionados proporcionalmente ao **Limite Absoluto** do ativo (100% da largura = limite máximo).

---

## 5. Gatilho de Obsolescência (Decay Trigger)

**Implementação atual:** Função `checkScuttlebuttDecay()` em `quantamentalEngine.ts`, avaliada para cada ativo em `usePortfolioState.ts`.

* **Regra de Banco de Dados:** Todo registro de nota qualitativa (Scuttlebutt) recebe um *timestamp* (`updated_at` na tabela `scuttlebutt_answers`).
* Se `data_atual - última_avaliação > período_configurado`, o ativo é marcado como **`is_decayed = true`**.
* **Consequências no Frontend:**
  * O modal de detalhes exibe um card de alerta: `⚠️ Avaliação qualitativa expirada há mais de X dias` com a data da última avaliação.
  * O simulador Smart Aporte **ignora o ativo** na distribuição de aportes e registra o motivo no log de roteamento.
  * O ativo muda seu estado de enquadramento para `desenquadrado_obsoleto`.
* **Períodos configuráveis:** 90 dias, 180 dias ou 365 dias (via `scuttlebutt_decay_days` nas preferências).
* O app sugere ao usuário refazer o checklist factual do ativo para restaurar a confiabilidade do score.

---

## 6. Arquitetura de Dados (Modelagem no Supabase)

### Tabelas do Motor Quantamental

| Tabela | Propósito |
|--------|-----------|
| `portfolio_quant_preferences` | Preferências quantitativas por portfólio (tiers, limites setoriais, thresholds). Auto-criada via trigger `on_portfolio_created_setup_quant`. |
| `scuttlebutt_pillars` | Pilares do Scuttlebutt. `portfolio_id = NULL` = template global; com ID = pilar customizado. |
| `scuttlebutt_questions` | Perguntas por pilar. Suportam `portfolio_id` para perguntas customizadas do usuário. |
| `scuttlebutt_answers` | Respostas qualitativas por ativo/pergunta. PK composta: `(portfolio_id, ticker, question_id)`. |
| `asset_fundamentals_cache` | Cache global de indicadores fundamentalistas (ROIC, DY, P/L, etc.) sincronizado com Yahoo Finance. |
| `portfolio_asset_definitions` | Definições de ativos com 12 campos `manual_*` para overrides quantitativos. |
| `portfolio_group_targets` | Metas de alocação por classe e por setor. |

### Segurança (RLS)

Todas as tabelas possuem Row Level Security habilitado com políticas baseadas em `auth.uid()`, vinculando acesso via `portfolios.client_id` ou `portfolios.consultant_id`. Pilares e perguntas globais (`portfolio_id IS NULL`) são acessíveis para leitura por qualquer usuário autenticado.

---

## 7. Componentes da Interface (Investimentos)

| Componente | Arquivo | Função |
|-----------|---------|--------|
| `ExposureLimitsEditor` | `ExposureLimitsEditor.tsx` | Editor de metas de alocação por classe com validação de soma = 100%. |
| `QuantPreferencesEditor` | `QuantPreferencesEditor.tsx` | Editor de tiers, limites setoriais e thresholds fundamentalistas. |
| `HoldingsTable` | `HoldingsTable.tsx` | Tabela de posições com badges de enquadramento, tier e quality score. |
| `AssetDetailModal` | `AssetDetailModal.tsx` | Modal de detalhamento: scores, checklist quantitativo, gráfico de evolução, alerta de decay, barra de enquadramento. |
| `AssetConfigModal` | `AssetConfigModal.tsx` | Modal de configuração: pricing mode, overrides quantitativos com alertas de contraste vs API. |
| `ScuttlebuttEvaluationModal` | `ScuttlebuttEvaluationModal.tsx` | Modal de avaliação qualitativa: pilares, perguntas (editáveis), respostas sim/não/N/A. |
| `SmartAporteSimulator` | `SmartAporteSimulator.tsx` | Simulador de distribuição de aporte: input de valor, sugestões com barras empilhadas, log de roteamento. |
| `RebalancingView` | `RebalancingView.tsx` | Visão de rebalanceamento da carteira. |

---

## 8. Fluxo de Dados do Motor Quantamental

```
┌─────────────────────────────────────────────────────────────────┐
│                     usePortfolioState.ts                        │
│                                                                 │
│  1. Carrega do Supabase:                                       │
│     - Transações, Definições, Preços, Metas, Preferências      │
│     - Pilares, Perguntas, Respostas (Scuttlebutt)              │
│     - Cache de Fundamentos (API)                                │
│                                                                 │
│  2. Para cada ativo não-RF/Caixa:                              │
│     ┌──────────────────────────────────────────────────┐       │
│     │ A. Scuttlebutt → calculateScuttlebuttScore()     │       │
│     │ B. Fundamentos → getMergedFundamentals()         │       │
│     │    (API + Overrides manuais)                     │       │
│     │ C. Quantitativo → calculateQuantitativeScore()   │       │
│     │ D. Híbrido → (Quali + Quanti) / 2 ou 100% Quanti│       │
│     │ E. Tier → determineTier(qualityScore)            │       │
│     │ F. Decay → checkScuttlebuttDecay()               │       │
│     │ G. Limite → calculateAbsoluteLimit()             │       │
│     │ H. Estado → determineEnquadramentoState()        │       │
│     │ I. Gaps → Financeiro + Percentual                │       │
│     └──────────────────────────────────────────────────┘       │
│                                                                 │
│  3. Retorna posições enriquecidas para a UI                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Motor de Classificação de Ativos

**Implementação atual:** `assetClassifier.ts` — fonte única de verdade para classificação de tickers.

O classificador determina automaticamente a `asset_class` e `sector` de cada ativo a partir do ticker, utilizando heurísticas baseadas em padrões da B3 (sufixo numérico), listas de ETFs conhecidos, BDRs (sufixo 34), ações internacionais (2-5 letras sem números), criptomoedas e renda fixa (prefixos CDB, LCI, etc.).

As classes reconhecidas pelo motor quantitativo são:
* **Ações:** Verificação por `AÇÕES`, `AÇÃO`, `ACOES`, `EQUITY`, `STOCK` no nome da classe.
* **FIIs:** Verificação por `FII`, `IMOBILIARIO`, `IMOBILIÁRIO`, `REAL ESTATE`.
* **ETFs:** Verificação por `ETF`.
* **Outros:** Renda Fixa, Caixa, Criptoativos — não avaliados pelo motor quantamental (score padrão 100).