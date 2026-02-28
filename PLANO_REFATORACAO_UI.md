# Plano de refatoração visual – App de finanças (estilo app de banco)

Objetivo: padronizar todo o app com **Tailwind CSS**, visual **limpo e profissional** (referência: BTG Pactual), **responsivo** (mobile e desktop), mantendo **todas as funcionalidades** atuais.

---

## 1. Estado atual (resumo)

| Aspecto | Situação |
|--------|----------|
| **Estilo** | Mistura de Tailwind + variáveis CSS (`--color-*`) e classes utilitárias customizadas (`.text-primary`, `.bg-secondary`) que conflitam com nomes do Tailwind. |
| **Tema** | ThemeContext com `mono-light` / `mono-dark` + 3 paletas (vivid, sunset, ocean). Cores aplicadas via `documentElement.style`. |
| **Layout** | Mobile: bottom nav (6 itens). Desktop: sidebar 250px + conteúdo. Conteúdo com `max-w-md` (mobile) e `max-w-6xl` (desktop). |
| **Componentes** | Card, Button, Input, Modal, PageHeader, etc. usam `var(--color-*)` diretamente. |
| **Navegação** | 6 links principais + 2 de categorias no desktop. Sem submenu ou “home” tipo dashboard em destaque. |

---

## 2. Direção desejada (estilo app de banco – BTG como referência)

- **Hierarquia clara**: saldo / totais em destaque; ações secundárias discretas.
- **Cards** para blocos de informação (saldo, resumo do mês, lista de movimentações).
- **Tipografia**: títulos fortes, valores em destaque, labels menores e em cor secundária.
- **Cores**: uso consistente de uma cor de destaque (ex.: azul/dourado) + neutros; verde para entrada, vermelho para saída.
- **Espaçamento e bordas**: grid consistente (ex.: 4, 6, 8), bordas suaves, cantos arredondados padronizados.
- **Responsivo**: mobile first; bottom nav ou drawer no celular; sidebar ou top bar no desktop.
- **Tailwind como base**: preferir classes Tailwind; variáveis CSS apenas para tema (dark/light) e cores semânticas (income, expense, balance).

---

## 3. Escopo da refatoração (sem mudar funcionalidades)

### 3.1 Design system (Tailwind + tema)

- **Tailwind**
  - Estender `theme` em `tailwind.config.js`: cores semânticas (background, text, border, accent), espaçamento e border-radius padronizados.
  - Garantir que todas as telas usem **apenas** classes Tailwind + eventualmente 1–2 utilitários customizados documentados (ex.: safe-area).
- **CSS global**
  - Reduzir `index.css` ao mínimo: variáveis de tema (light/dark), safe-area, animações já usadas (fade-in, slide, etc.).
  - Remover utilitários que duplicam Tailwind (ex.: `.text-primary` que hoje aponta para `--color-text-primary`) e substituir por classes Tailwind ou por variáveis usadas via `theme()` no config.
- **Tema (ThemeContext)**
  - Manter light/dark e paletas; aplicar tema via **classes no `html`** (ex.: `dark`) e variáveis CSS, sem conflito com nomes do Tailwind (ex.: evitar `--color-primary` se for usado como “cor de destaque” e Tailwind tiver `primary`).

### 3.2 Layout e navegação

- **Mobile**
  - Bottom nav mantida, com ícones e labels; estilo alinhado ao design system (altura, padding, safe-area).
  - Header fixo opcional com título da tela e uma ação (ex.: “Nova”).
- **Desktop**
  - Sidebar fixa, mais “bank-like”: logo/marca no topo, agrupamento de itens (ex.: Visão geral, Movimentações, Relatórios, Configurações).
  - Categorias (despesa/renda) podem ficar em submenu ou seção separada na sidebar.
- **Conteúdo**
  - Larguras máximas e padding consistentes (ex.: `max-w-*` + `px-4`/`px-6`); mesma lógica em todas as páginas.

### 3.3 Componentes base (um por vez)

- **Card**: apenas Tailwind + variáveis de tema; variantes opcionais (e.g. `elevated`, `outlined`).
- **Button**: variantes (primary, secondary, danger, outline, ghost) e tamanhos via Tailwind; cores do tema via variáveis ou cores do `theme`.
- **Input / Select**: bordas, focus ring e estados de erro padronizados.
- **Modal**: overlay, animação e conteúdo centralizado; mesma base em todo o app.
- **PageHeader**: título + descrição + ação opcional; comportamento responsivo definido (ex.: título quebra em mobile).
- **Listas (Despesas, Rendas, Investimentos)**: item = card ou linha com ícone de categoria, valor e ações; espaçamento e hierarquia tipográfica uniformes.

### 3.4 Páginas (só visual e estrutura)

- **Dashboard**: cards de totais (Rendas, Despesas, Investimentos, Saldo) em grid responsivo; seletor de mês; lista “Maiores despesas” com mesmo padrão de card/linha.
- **Despesas / Rendas / Investimentos**: header + seletor de mês + botão “Nova/o” + lista de itens; modal de formulário igual em todas.
- **Categorias (despesa e renda)**: lista de categorias com cor e ações; mesmo padrão de card.
- **Relatórios**: seletor ano/mês; gráficos e tabelas com cores do tema; seções bem separadas (resumo anual → detalhe mensal).
- **Configurações**: seções (Tema, Cores, Banco de dados) com mesmo estilo de card/seção.

### 3.5 Limpeza de código

- Remover classes e arquivos CSS não utilizados.
- Remover duplicação de estilos (ex.: mesmo `rounded-lg` + `border` em vários lugares → garantir que venha do componente base).
- Garantir que nenhum estilo “solo” (ex.: `style={{ color: '...' }}`) fique sem necessidade; preferir classes ou variáveis.

---

## 4. Ordem sugerida de execução

1. **Design system**  
   Ajustar `tailwind.config.js` e `index.css`; definir variáveis de tema e mapear para Tailwind (ex.: `backgroundColor.theme`, `colors.income`).
2. **Tema**  
   Garantir que ThemeContext aplique apenas variáveis/classes; sem conflito com nomes do Tailwind.
3. **Componentes base**  
   Card → Button → Input/Select → Modal → PageHeader (e outros que forem comuns).
4. **Layout**  
   Refatorar Layout (mobile + desktop) com o novo sistema.
5. **Páginas**  
   Dashboard → Despesas / Rendas / Investimentos → Categorias → Relatórios → Configurações.
6. **Revisão**  
   Responsivo, acessibilidade básica (contraste, foco), remoção de código morto.

---

## 5. Perguntas para alinhar o escopo

Responda em tópicos para que o plano possa ser afinado antes de implementar.

1. **Identidade visual**  
   Você quer manter a possibilidade de **trocar paletas** (vivid / sunset / ocean) e **tema claro/escuro**, ou prefere um visual único (ex.: só escuro estilo BTG) para simplificar?

2. **Cor de destaque / marca**  
   Prefere uma cor fixa de destaque (ex.: azul ou dourado, como em muitos bancos) ou que a “cor de destaque” continue vindo da paleta escolhida pelo usuário?

3. **Navegação mobile**  
   Manter **bottom bar** com os 6 itens atuais (Início, Despesas, Rendas, Investimentos, Relatórios, Configurações) ou prefere menos itens na barra (ex.: 4) e o restante em menu (hamburger) ou na tela inicial?

4. **Categorias no desktop**  
   Categorias de despesa e de renda devem continuar como **dois links na sidebar** ou prefere um único item “Categorias” que abre uma tela com abas (Despesas | Rendas)?

5. **Dashboard como “home”**  
   O primeiro item da navegação deve ser sempre o **Dashboard** (resumo do mês, totais, maiores despesas), com mesmo destaque que “início” em app de banco, ou você quer outra tela como “home”?

6. **Prioridade mobile vs desktop**  
   O uso principal será no **celular** ou no **PC**? Isso define se priorizamos bottom nav + gestos ou sidebar + tabelas/gráficos maiores.

---

Após suas respostas, o plano pode ser ajustado e a implementação feita em fases (por exemplo: design system + tema → componentes → layout → páginas).
