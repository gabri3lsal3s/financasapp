# 🏦 Plano Mestre de Redesign Visual UI/UX — Fintech Minimalista & Obsidian Glass (v3.5 Final Agressivo)

> **Documento Estratégico de Redesign Visual, Ergonomia e Design System**  
> **Versão:** 3.5 (Incorporada a Fase 8 de Redesign Visual Agressivo & Alta Impacto)  
> **Data:** 12/08/2026  
> **Conceito:** Fintech Minimalista de Alta Precisão (*Apple Wallet, Nubank Ultravioleta, Revolut, Wise, Linear*).  
> **Premissa:** Cobertura de 100% dos fluxos de negócio ativos com proteção contra quebras de layout, conflitos de teclado, extremos de dados e variações de tela.

---

## 📑 Índice
1. [Diretrizes de Design & Decisões Homologadas](#1-diretrizes-de-design--decisões-homologadas)
2. [Fundação Visual: Tokens, Camadas de Vidro e Tipografia Suíça](#2-fundação-visual-tokens-camadas-de-vidro-e-tipografia-suíça)
3. [Moldura Global: Shell, Navegação e Busca Integrada](#3-moldura-global-shell-navegação-e-busca-integrada)
4. [Redesign Detalhado Página por Página](#4-redesign-detalhado-página-por-página)
   - 4.1 [Dashboard (Home) — Bento Grid Aberto & Reorganizável](#41-dashboard-home--bento-grid-aberto--reorganizável)
   - 4.2 [Despesas (`Expenses.tsx`) — Feed de Cards Espaçados & Bottom Sheets](#42-despesas-expensestsx--feed-de-cards-espaçados--bottom-sheets)
   - 4.3 [Rendas (`Incomes.tsx`) — Entradas, Rateio Proporcional & Bottom Sheets](#43-rendas-incomestsx--entradas-rateio-proporcional--bottom-sheets)
   - 4.4 [Contas & Faturas (`Contas.tsx`) — Cartões com Cores dos Bancos & CSV](#44-contas--faturas-contastsx--cartões-com-cores-dos-bancos--csv)
   - 4.5 [Relatórios (`Reports.tsx`) — Visão Mensal Padrão, Comparações & Pesos](#45-relatórios-reportstsx--visão-mensal-padrão-comparações--pesos)
   - 4.6 [Categorias (`Categories.tsx`) — Sugestões & Tetos de Orçamento](#46-categorias-categoriestsx--sugestões--tetos-de-orçamento)
   - 4.7 [Configurações (`Settings.tsx`) — Biometria, Temas & Painel Admin](#47-configurações-settingstsx--biometria-temas--painel-admin)
   - 4.8 [PWA Offline, Sincronização & Notificações](#48-pwa-offline-sincronização--notificações)
5. [Padronização Global de Bottom Sheets (100% Harmonia de Interação)](#5-padronização-global-de-bottom-sheets-100-harmonia-de-interação)
6. [Diagnóstico de Simulação de UI/UX: Fragilidades Identificadas & Mitigações](#6-diagnóstico-de-simulação-de-uiux-fragilidades-identificadas--mitigações)
7. [Mapeamento Completo de Arquivos do Projeto](#7-mapeamento-completo-de-arquivos-do-projeto)
8. [Roteiro Executivo de Implementação em 8 Fases (Com Fase 8 Agressiva)](#8-roteiro-executivo-de-implementação-em-8-fases-com-fase-8-agressiva)
9. [Fase 8: Redesign Visual Agressivo de Alto Impacto (Obsidian Premium & Micro-Springs)](#9-fase-8-redesign-visual-agressivo-de-alto-impacto-obsidian-premium--micro-springs)
10. [Salvaguardas de Negócio e Protocolo de Qualidade](#10-salvaguardas-de-negócio-e-protocolo-de-qualidade)

---

## 1. Diretrizes de Design & Decisões Homologadas

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ DECISÕES DE DESIGN HOMOLOGADAS                                                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Dashboard: Widgets sempre abertos e distribuídos em colunas (com reordenação ativa).│
│ 2. Cartões de Crédito: Cores institucionais foscas dos bancos (Roxo, Laranja, Azul).   │
│ 3. Sparkline do Hero Card: Comparação visual da curva do mês atual vs mês anterior.    │
│ 4. Feed de Transações: Cards individuais generosos (16px radius) com foco no toque.    │
│ 5. Padrão de Interação: 100% Bottom Sheets no mobile para formulários, filtros e ações.│
│ 6. Relatórios: Visão Mensal com Gráficos de Evolução e Barras como tela padrão.        │
│ 7. Investimentos: Removido deste escopo (preservado para refatoração isolada futura). │
│ 8. Estética Geral: Fintech Minimalista de Alta Precisão & Impacto Agressivo em Vidro.  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Fundação Visual: Tokens, Camadas de Vidro e Tipografia Suíça

### 2.1 Camadas Obsidian Glass Sóbrias
* **L0 — Canvas:**
  * **Dark Slate:** `#0b0f19` (Chumbo escuro acetinado com profundidade de contraste).
  * **Midnight OLED:** `#000000` (Preto absoluto de alto contraste).
  * **Light Mode:** `#f8fafc` (Cinza gelo profissional com bordas em `rgba(15, 23, 42, 0.08)`).
* **L1 — Cards & Bento Containers:** Grafite translúcido fosco `rgba(15, 23, 42, 0.65)` com `backdrop-filter: blur(16px)` e borda ultrafina de 1px com brilho interno metálico (`box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.08)`).
* **L2 — Bottom Sheets & Drawers:** Superfícies elevadas com `backdrop-filter: blur(28px)`, fundo `rgba(11, 15, 25, 0.92)` e suporte ao gesto de deslizar para baixo (*drag-to-dismiss*).
* **L3 — Controles Interativos:** Botões, chips e switches com micro-compressão física de mola (`scale: 0.98`) e transições em 150ms.

---

## 3. Moldura Global: Shell, Navegação e Busca Integrada

### 3.1 Mobile Bottom Navigation & FAB Central
* **Barra Inferior:** Painel ultrafino em vidro fosco fumê, encaixado na `safe-area-bottom`.
* **Indicador de Aba Ativa:** Ponto discreto ou linha de 2px sob o ícone ativo.
* **FAB Central (+):** Botão circular de `52×52px` em titânio grafite escuro com resposta tátil firme. Ao tocar, abre a Bottom Sheet de seleção de lançamento.

---

## 4. Redesign Detalhado Página por Página

*(Manutenção integral da arquitetura de páginas: Dashboard, Despesas, Rendas, Contas & Faturas, Relatórios, Categorias e Configurações)*

---

## 5. Padronização Global de Bottom Sheets (100% Harmonia de Interação)

```
┌──────────────────────────────────────────────────────────┐
│              ─── BARRA DE ARRASTAR (PILL) ───            │
│  [Título da Sheet]                          [Botão Fechar]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│  • Formulários (Nova Despesa, Nova Renda, Nova Categoria)│
│  • Detalhes (Detalhes da Transação, Detalhes de Fatura)  │
│  • Filtros & Ações Rápidas (Reordenação de Widgets)      │
│                                                          │
│  [Botão de Ação Primária]                                │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Diagnóstico de Simulação de UI/UX: Fragilidades Identificadas & Mitigações

| # | Cenário Simulado & Fragilidade | Risco de UX | Solução / Mitigação Técnica no Código |
| :---: | :--- | :--- | :--- |
| **F1** | **Colisão do Teclado Virtual nas Bottom Sheets** | Bloqueio no mobile | `max-h-[85vh] overflow-y-auto` com cabeçalho *sticky* e botão de ação com `pb-safe`. |
| **F2** | **Contraste em Cartões com Cores Claras dos Bancos** | Ilegibilidade WCAG | *Scrim layer* fosco (`linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.6))`) garantindo contraste ≥ 4.5:1. |
| **F3** | **Overflow de Valores Monetários Extremos no Hero** | Quebra visual | Tipografia fluida responsiva (`text-2xl sm:text-3xl font-mono tabular-nums`). |
| **F4** | **Conflito de Gestos no Feed de Transações** | Troca de mês acidental | Calibração de ângulo e limite horizontal no hook `useSwipeMonth`. |
| **F5** | **Bordas de Vidro no Tema Claro** | Perda de estrutura | Bordas dinâmicas: `rgba(255,255,255,0.07)` nos escuros e `rgba(15,23,42,0.08)` no claro. |

---

## 7. Mapeamento Completo de Arquivos do Projeto

*(Mantido o mapeamento de paths reais dos 60+ componentes do projeto)*

---

## 8. Roteiro Executivo de Implementação em 8 Fases (Com Fase 8 Agressiva)

> **v3.6 (12/08/2026):** A Fase 8 original foi desdobrada em **R8–R12** (Redesign Agressivo
> Página por Página, mobile-first) após auditoria de cobertura: o shell (R2) já estava pronto,
> mas o pacote visual de alto impacto (bordas refratárias, micro-springs, cartões 3D, feed tátil)
> nunca havia sido implementado. As fases R8–R12 executam a Fase 8 do plano + varredura completa
> página por página.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 1: Fundação, Tokens Sóbrios de Fintech & Superfícies de Vidro                       │
│ FASE 2: Shell, Navegação Silenciosa, FAB e TopBar  ✅ JÁ ENTREGUE                       │
│ FASE 3: Dashboard (Home) — Bento Grid Aberto & Reorganizável  ✅ JÁ ENTREGUE            │
│ FASE 4: Extrato de Despesas, Rendas e Padronização de Bottom Sheets  ✅ JÁ ENTREGUE      │
│ FASE 5: Contas, Faturas com Cores dos Bancos, Conciliação CSV e Dívidas  ✅ JÁ ENTREGUE  │
│ FASE 6: Relatórios (Visão Mensal Padrão), Categorias e Configurações  ✅ JÁ ENTREGUE     │
│ FASE 7: Auth, Onboarding & PWA Offline  ✅ JÁ ENTREGUE                                   │
│ FASE 8 (REDESIGN AGRESSIVO — v3.6 desdobrada em R8–R12):                                │
│   R8 — Fundação Obsidian Premium & Micro-Interações (global)                             │
│   R9 — Despesas & Rendas: Feed Tátil Premium (mobile-first)                              │
│   R10 — Contas & Faturas: Cartões Apple Wallet 3D                                        │
│   R11 — Dashboard Premium (Hero, Bento Grid & Sparkline com pulso)                       │
│   R12 — Relatórios, Investimentos, Settings & Auth (polimento final + QA mobile)         │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### R8 — Fundação Obsidian Premium & Micro-Interações (impacto global) ✅ (12/08)
* **8.1 Bordas Refratárias Metálicas (L1):** tokens `--glass-refract`/`--glass-refract-strong`
  (inset highlight + sombra profunda, theme-aware via `color-mix` — sem cor hardcoded),
  utilities `.glass-refract`/`.glass-refract-strong`, aplicadas em `.glass-card-interactive`
  (global, com hover `refract + panel`) e nos KPI cards de Categorias e accordion de cartões.
* **8.2 Micro-Springs Físicos (framer-motion):** primitivo `ui/tactile.tsx` (`TactilePress`,
  spring `stiffness: 450, damping: 25`, `scale: 0.985` whileTap / `1.01` whileHover, respeita
  `prefers-reduced-motion`) + 3 testes; aplicado no accordion de cartões, tiles "Novo
  Orçamento/Nova Meta" e disponível para o feed (R9) e widgets (R11).
* **8.3 Pulso Fluorescente no Sparkline:** edição do usuário validada (NaN-guards ok,
  `overflow-visible` no SVG evita clipping) + `pointer-events-none` no grupo do pulso.
* **Critérios:** 0 mudança de contrato; **480 testes verdes** (3 novos); guardrails verde; build OK.

### R9 — Despesas & Rendas: Feed Tátil Premium (mobile-first) ✅ (12/08)
* **Feed de Alta Densidade Tactile (8.4):** `TransactionCard` (mobile + desktop) — ícone de
  categoria em **círculo de vidro com glow na cor** (`box-shadow: 0 0 14px color-mix(in srgb,
  <cor> 30%, transparent)`), pills de parcela/competência em vidro flutuante agora **também no
  mobile** (antes só desktop), montantes com `AmountText` (valor + original tachado), micro-press
  físico com `TactilePress` (spring 450/25) no card inteiro, barra lateral de cor substituída
  pelo badge de ícone no mobile.
* **Headers de página:** labels "Parceladas" e "Despesas do mês" → `Eyebrow` (Expenses);
  Incomes sem labels de seção (sem mudança). Bottom sheets já padronizados (R4).
* **Critérios:** **480 testes verdes**; tsc/lint/guardrails/build OK.

### R10 — Contas & Faturas: Cartões Apple Wallet 3D ✅ (12/08)
* **Face do cartão** `creditCards/CreditCardFace.tsx`: cor institucional do banco
  (`resolveCardColor`) + `BANK_CARD_SCRIM` (contraste WCAG F2) + brilho refratário superior,
  chip holográfico e selo da bandeira (`ui/card-hologram.tsx` — SVG puro, allowlist consciente
  no guardrails como arte/marca), Fatura Atual com `AmountText`, ciclo (fecha/vence).
* **Tilt 3D no hover (desktop):** `perspective: 1000px` + mousemove (máx ±6°, `preserve-3d`),
  reset no mouseleave; mobile estático (sem conflito de gestos — gate `(hover: hover)`).
* **Barra de Limite Térmica:** esmeralda → âmbar → coral conforme consumo 60/80%+, com
  glow na cor e % utilizado.
* **Critérios:** **480 testes verdes**; tsc/lint/guardrails (allowlist consciente)/build OK.

### R11 — Dashboard Premium (Hero, Bento Grid & Sparkline) ✅ (12/08)
* **Hero:** `glass-refract` + glow ambiente obsidian (radial `color-mix` sem cor hardcoded),
  label "Gastos acumulados no mês" → `Eyebrow`, sparkline com pulso fluorescente (R8).
* **Widgets (`WidgetCard`):** borda refratária (substitui `shadow-sm`), ícone do widget em
  badge de vidro com borda, hover `border-glass-strong`.
* **Critérios:** **480 testes verdes**; tsc/lint/guardrails/build OK.

### R12 — Relatórios, Investimentos, Settings & Auth (polimento final + QA mobile)
* Charts com tooltips glass consistentes; KPIs (já AmountText) sem regressão.
* Investimentos na mesma linguagem obsidian (cards, tabelas, pie legend).
* Settings/Auth: touch targets ≥ 44px, safe-areas, revisão final mobile-first.
* **Critérios:** suite completa verde + build + guardrails; docs atualizadas; commit final.


---

## 9. Fase 8: Redesign Visual Agressivo de Alto Impacto (Obsidian Premium & Micro-Springs)

Para entregar a transformação visual **mais marcante, agressiva e impressionante do app**, a **Fase 8** implementará um pacote de otimizações de alta fidelidade visual sem alterar qualquer contrato de negócio:

### 🌟 8.1 Matriz Obsidian Glass de Alto Contraste (L0–L3 Ultra)
* **Bordas Metálicas Refratárias (1px Refratário):** Todos os containers de vidro L1 recebem uma borda interna refratária com gradiente metálico sutil:
  ```css
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.12), 0 4px 20px -2px rgba(0, 0, 0, 0.5);
  ```
* **Superfície L2 com Vidro Escuro Fumê (Blur 28px):** As Bottom Sheets ganham desfoque ultra-intenso com backdrop escurecido em 92% de opacidade, imitando a textura física do titânio e do vidro temperado.

### ⚡ 8.2 Micro-Interações Físicas Tactile (Framer Motion Springs)
* **Prensa Física ao Tocar em Cards (`scale: 0.985`):** Ao tocar ou clicar em qualquer card de transação ou widget, o componente responde instantaneamente com uma animação de mola física (`type: "spring", stiffness: 450, damping: 25`).
* **Ponto de Pulso Neon Fluorescente no Sparkline:** O gráfico de Sparkline Duplo ganha um **ponto de pulso brilhante (*pulsing dot*)** no valor mais recente do mês, indicando atualização em tempo real.

### 💳 8.3 Cartões de Crédito Estilo Apple Wallet 3D
* **Efeito 3D Tilt sutil no Hover:** Ao passar o mouse sobre os cartões de crédito em desktop, o cartão inclina levemente acompanhando o cursor (`perspective: 1000px`).
* **Selo Holográfico em SVG:** Adição de microchips holográficos metálicos e selos reflexivos nas bandeiras (Visa, Mastercard, Elo, Amex).
* **Barra de Limite com Gradiente Térmico:** A barra de limite do cartão transita suavemente do esmeralda para o coral conforme o consumo da fatura atinge 80%+.

### 📊 8.4 Feed de Transações de Alta Densidade Tactile
* **Cards Arredondados de 16px com Destaque de Ícones em Vidro:** Ícones de categoria em círculos com brilho sutil na cor da categoria (`box-shadow: 0 0 12px var(--category-color-alpha)`).
* **Tags de Parcelamento e Fatura em Vidro Flutuante:** Pílulas de parcelas (`2/10`) com acabamento metálico fosco.

---

## 10. Salvaguardas de Negócio e Protocolo de Qualidade

1. **477 Testes Automatizados 100% Verdes:** Toda fase executa `npm run test:run` para assegurar integridade lógica de 100%.
2. **Governança de UI (`npm run guardrails:ui`):** Zero cores hardcoded e uso estrito de formatadores oficiais (`format.ts`).
3. **Acessibilidade e Ergonomia (WCAG AA):** Contraste ≥ 4.5:1, áreas de toque confortáveis (≥ 44×44px) e respeito às *safe areas* do mobile.
