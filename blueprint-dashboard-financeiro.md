# Blueprint do Dashboard Financeiro e Otimização de UI/UX

> **Última atualização:** Julho de 2026 — Planejamento de refinamento do Dashboard e Navegação.

---

Este blueprint estabelece as diretrizes e a arquitetura visual/técnica para a refatoração e otimização da página do Dashboard e dos elementos globais de navegação do aplicativo. O objetivo é melhorar a legibilidade, reduzir a carga cognitiva, unificar a linguagem visual (removendo neumorfismo) e corrigir problemas crônicos de usabilidade na navegação mobile.

---

## 1. Diretrizes Globais de Estilo (Visual & UI)

Antes de alterar a estrutura dos elementos, é necessário padronizar a linguagem de design em conformidade com o sistema de design da aplicação:

### A. Estilo dos Cartões (Cards)
* **Abandono do Neumorfismo:** Eliminar o excesso de sombras pesadas e efeitos tridimensionais (neumorfismo).
* **Fundo e Borda:**
  * **Tema Claro:** Fundo branco sólido (`#FFFFFF` ou `var(--ds-color-surface-primary)`) sobre o fundo de tela cinza muito claro (`#F4F6F8` ou `var(--ds-color-surface-secondary)`).
  * **Tema Escuro/Midnight:** Fundo de card mapeado para `var(--glass-surface-strong)` ou `var(--ds-color-surface-tertiary)` sobre o fundo de tela principal.
  * **Bordas:** Adicionar raio de borda (`border-radius`) de **12px (`var(--ds-radius-lg)`)** ou **16px (`var(--ds-radius-xl)`)** para um visual moderno e suave.
  * **Contorno:** Utilizar uma borda super fina de `1px solid var(--glass-border)` (ou `#E5E7EB` no tema claro) para delimitação de espaço, em substituição a sombras.

### B. Tipografia & Hierarquia
* **Negrito (Bold):** Restrito exclusivamente a valores monetários relevantes (ex: valores em dinheiro) e títulos principais de seção.
* **Textos Secundários:** Rótulos de apoio (ex: *"vs. mês anterior"*, *"restantes"*, *"utilizado"*) devem utilizar texto com peso regular e na cor cinza médio (`#6B7280` ou token `var(--color-text-secondary)`).

### C. Cores de Feedback Estratégico
* **Verde (`var(--color-income)`):** Reservado para ações positivas (dentro do orçamento, saldo positivo, dinheiro sobrando).
* **Vermelho/Laranja (`var(--color-expense)` / `var(--color-warning)`):** Reservado para alertas reais e críticos (orçamento estourado, saldo líquido negativo, limite atingido). Evitar o uso constante em elementos secundários para prevenir a "fadiga de alerta".

---

## 2. Estrutura da Tela do Dashboard (Top to Bottom)

A hierarquia da página principal é reestruturada para colocar o foco nas metas financeiras diárias e nos insights proativos.

### Seção 1: Cabeçalho (Header)
* **Remoção:** Excluir a barra estática de busca ("Pesquisar páginas...") do topo.
* **Saudação Amigável:** Título dinâmico no formato: `Olá, [Nome do Usuário] 👋`.
  * *Implementação:* Utilizar a função `resolveProfileDisplayName(profile)` importada de `@/utils/profileDisplayName` para recuperar o nome do usuário ativo.
* **Contexto Temporal:** Subtítulo dinâmico mostrando o progresso do mês atual: `Faltam [X] dias para o fim do mês.`
  * *Fórmula de cálculo:* `const remainingDays = daysInMonth - currentDay + 1`.
* **Ações Secundárias:** Ícone de Notificações (sino) e ícone de Lupa (pesquisa) posicionados lado a lado no canto superior direito do cabeçalho.
  * *Comportamento da Lupa:* Abre o modal/overlay de pesquisa rápida (`SearchOverlay`), mantendo a topbar limpa.

### Seção 2: O Herói (Gasto Disponível)
Esta seção é a métrica mais importante do usuário e deve ocupar o topo da área de conteúdo.
* **Layout:** Um card em destaque com cor de fundo sutil (ex: verde pastel ou azul muito claro/soft) para diferenciá-lo visualmente do restante do conteúdo.
* **Métrica Primária (Centro/Grande):** **DIÁRIO SUGERIDO** (R$ [Valor] / dia). Representa o limite diário que o usuário pode gastar com base no saldo restante do mês.
* **Métrica Secundária (Abaixo ou Lado a Lado):** **MENSAL LIVRE** (R$ [Valor] restantes).
* **Tratamento de Alerta (Estouro):** Caso o *Mensal Livre* esteja negativo, o card deve alterar dinamicamente suas cores para um tom de alerta leve (`bg-expense/10` ou similar) e mudar o status para **"Orçamento ultrapassado"**.

### Seção 3: Termômetro do Mês (Progresso)
Substituição dos 4 cards de KPIs anteriores por um visualizador unificado de fluxo financeiro.
* **Layout:** Um único cartão consolidado chamado **"Resumo do Mês"**.
* **Elemento Visual:** Uma barra de progresso horizontal, espessa e com bordas arredondadas.
  * **Fundo da barra:** Representa a Renda Total do mês (ou o limite estabelecido).
  * **Preenchimento da barra:** Representa as Despesas Totais até o momento.
* **Textos de Apoio:**
  * **Esquerda (Abaixo/Acima da barra):** `Gastos: R$ [Total Despesas]`
  * **Direita (Abaixo/Acima da barra):** `Limite/Renda: R$ [Total Incomes]`
  * **Centro (Sobre a barra ou centralizado):** `[X]% utilizado`

### Seção 4: Copiloto Proativo de IA (Insights)
O assistente de IA deve guiar o usuário de forma proativa.
* **Comportamento:** Exibe insights automáticos sem a necessidade de o usuário enviar uma pergunta primeiro.
* **Layout:** Um carrossel de cartões com rolagem horizontal (swipe). Cada card contém:
  * Um ícone contextual (ex: ⚠️ para alertas, 💰 para economia).
  * Um texto de insight curto (ex: *"Você gastou 30% a mais em Delivery esta semana."*).
  * Um botão de ação rápido (ex: `[Analisar]` ou `[Poupar]`).
* **Caixa de Entrada:** Manter o campo de entrada *"Pergunte à IA..."* logo abaixo do carrossel de insights, de forma menor e discreta, sem os chips flutuantes que poluíam a visualização anterior.

### Seção 5: Ações de Otimização (Quick Wins)
* **Layout:** Grade (*grid*) de 2 a 4 botões retangulares/quadrados com ícones, fornecendo atalhos diretos para otimização financeira.
* **Ações Sugeridas:**
  1. **Revisar Assinaturas:** Atalho para identificar gastos recorrentes.
  2. **Desafios de Economia:** Atalho para gamificação de metas.
  3. **Limites por Categoria:** Direciona para a configuração de limites de despesas (`/categories`).

---

## 3. Correção Crítica da Navegação (Bottom Navigation & FAB)

Esta é a correção técnica de maior prioridade para garantir a usabilidade móvel da aplicação.

### A. Barra de Navegação Inferior (Bottom Nav)
* **Opacidade:** Deve possuir fundo **100% opaco** (geralmente branco no tema claro ou a cor exata do tema ativo).
* **Divisão de Conteúdo:** Adicionar uma sombra sutil projetada para cima (`box-shadow: 0px -2px 10px rgba(0,0,0,0.05)`) ou uma borda superior fina de `1px` para separá-la claramente do conteúdo que rola por trás.
* **Evitar Sobreposição:** O container de conteúdo principal (`main` ou similar) deve possuir um `padding-bottom` correspondente à altura da barra de navegação mais o espaço seguro (`safe-area-bottom`), garantindo que o último elemento da página não seja encoberto.

### B. Botão Flutuante (FAB +)
Para o acionamento de novos lançamentos (Renda, Despesa, Investimento):
* **Opção A (Recomendada):** Integrar o botão `+` diretamente ao **centro exato** da barra inferior de navegação móvel. Os outros 4 ícones ficam dispostos ao redor dele:
  `[Início]`  `[Despesas]`   **[  +  ]**   `[Rendas/Contas]`  `[Mais]`
* **Opção B:** Se mantido de forma flutuante fora da barra, ele deve flutuar **acima** da barra inferior, com uma distância de segurança de pelo menos **16px** do topo da barra inferior, prevenindo conflitos de clique com o botão "Mais".

---

## 4. Mapeamento Técnico de Componentes

Para a implementação destas alterações, os seguintes componentes e arquivos serão modificados:

1. **`src/pages/Dashboard.tsx`:**
   * Reestruturação do JSX para incluir o novo Cabeçalho (Section 1).
   * Refatoração do painel de Gasto Disponível como o Card Herói (Section 2).
   * Criação do componente visual "Resumo do Mês" com a barra de progresso (Section 3).
   * Integração do carrossel horizontal de insights no Copiloto IA (Section 4).
   * Implementação da grade de botões de otimização (Section 5).
2. **`src/components/AppTopBar.tsx`:**
   * Remoção da barra de pesquisa desktop.
   * Ajuste do posicionamento dos ícones de Lupa e Sino.
   * Exibição condicional de saudação/título e contexto de dias com base no path ativo.
3. **`src/components/Layout.tsx`:**
   * Atualização do estilo da classe `glass-bottom-nav` para garantir opacidade total e sombra projetada para cima.
   * Readequação do `padding-bottom` dinâmico do container de conteúdo principal.
   * Implementação do botão `+` integrado ou reposicionamento do `PageActionButtonHub`.
4. **`src/components/PageActionButtonHub.tsx`:**
   * Ajuste de posicionamento e margens verticais caso a Opção B de flutuação acima da barra seja a escolhida.
