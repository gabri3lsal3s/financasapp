# Blueprint do Sistema Quantamental: Gestão Indicativa de Portfólio

## 1. Módulo de Configuração Global (User Preferences & Constraints)

A funcionalidade deve ser criativa na forma de apresentar as informações, buscando uma experiencia agradavel e intuitiva para o usuário. Deve evitar que todas as escolhas sejam feitas em tela única de configurações mas de forma fluída e criativa, como através de sugestões de alterações nas coisas que somente o usuário pode definir e trabalhar de forma automática no que pode ser definido pelo próprio sistema. A experiencia deve ser agradavel, interativa e educativa para o usuário explicando os fundamentos através de "pípulas de informações" sutiz e necessárias..

### A. Alocação Macro (Asset Allocation)

O usuário define o "perfil de risco" e o percentual ideal de patrimônio que deseja ter em cada classe de ativo. A soma deve ser estritamente igual a 100%.

* `target_acoes_br`: Ex: 20%
* `target_fiis`: Ex: 20%
* `target_mercado_exterior`: Ex: 20%
* `target_renda_fixa`: Ex: 30%
* `target_caixa`: Ex: 10% (Classe de segurança e destino de aportes quando não há ativos enquadrados).

o app mostra sugestões de perfis de risco, mas permite ao usuário personalizar as porcentagens por tipos de ativos

### B. Limites Relativos de Convicção (Tiers)

O usuário estipula o peso máximo que um ativo pode ocupar **dentro de sua respectiva classe**, baseado na nota final (Score Total).

* `tier_S_limit` (Score 85-100): Default sugerido 20%
* `tier_A_limit` (Score 70-84): Default sugerido 10%
* `tier_B_limit` (Score 50-69): Default sugerido 5%
* `tier_C_limit` (Score < 50): Default sugerido 0% (Congelamento de aportes)

### C. Travas Setoriais (Concentration Limits)

O usuário define o máximo que um único setor pode representar dentro de uma classe.

* `max_sector_acoes`: Ex: 30% (Evita concentração excessiva em Bancos ou Elétricas).
* `max_sector_fiis`: Ex: 45% (Permite maior margem para FIIs de Papel/CRIs, comuns no Brasil).

### D. Limiares Fundamentalistas (Thresholds)

O usuário parametriza os gatilhos que o algoritmo usará para dar as notas aos indicadores que chegam via API.

* Exemplo: `min_roic_excelente`: 15% / `max_divida_ebitda`: 2.5x.

---

## 2. Camada Micro: Avaliação Híbrida e Factual (Bottom-Up)

A avaliação do ativo gera uma nota de 0 a 100. A regra de pesos varia por classe:

* **Ações e FIIs:** 50% Scuttlebutt (Qualitativo) / 50% Fundamentos (Quantitativo).
* **ETFs Passivos (ex: VOO, IVVB11):** 100% Fundamentos (Custos e Eficiência do Índice).

### A. Módulo Qualitativo (Scuttlebutt Parametrizado)

Substitui os *sliders* de achismo por um checklist de fatos. As respostas booleanas (Sim/Não/Não se aplica) somam a pontuação.

* **Pilar Gestão (30%):** Nível de governança (Novo Mercado)? Troca de CEO recente? Histórico de escândalos? Skin in the game (Diretoria possui ações)?
* **Pilar Moat (30%):** Margem superior aos pares? Market share dominante ou em crescimento?
* **Pilar Ecossistema (20%):** Dependência de fornecedor único? Monopólio estatal sujeito a canetadas regulatórias?
* **Pilar Cultura e Inovação (20%):** Baixo turnover executivo? Inovação tecnológica aderente ao core business?

Deve ser possível ao usuário adicionar pilares e perguntas, definindo pesos para cada um mas mantendo o padrão de resposta sim/não/não se aplica e o limite de porcentagem para o módulo. Quando considerado como "Não se aplica" o peso da pergunta deve ser distribuido entre os outros pilares de forma proporcional.

### B. Módulo Quantitativo e Sanitização de Dados

Integração com APIs financeiras (ex: Brapi, HG Brasil, Yahoo Finance) para coleta de múltiplos, aplicando mecanismos de *fallback* para evitar distorções matemáticas.

| Categoria | Indicador Base | Lógica do Algoritmo e Regras de Fallback (Backend) |
| --- | --- | --- |
| **Rentabilidade** | ROIC (Ações)<br>

<br>Div. Yield (FIIs) | O sistema compara o valor com o `Threshold` definido pelo usuário. |
| **Valuation** | P/L ou EV/EBITDA | Compara o múltiplo atual com a **Média Histórica de 5 anos do próprio ativo** (elimina distorção setorial).<br>

<br>⚠️ *Fallback:* Se Lucro Líquido < 0 (Prejuízo), nota de Valuation = 0 automática. |
| **Saúde Financeira** | Dívida Líquida / EBITDA | Compara com o `Threshold` do usuário. Tendência de alta na dívida por 2 anos seguidos reduz a nota em 50%. |

O app deve sempre mostrar a nota final do ativo na classe correspondente e indicar se o ativo está em linha, em limite atingido ou desenquadrado por excesso. O app deve sugerir um rebalanceamento da carteira quando o ativo estiver em limite atingido ou desenquadrado por excesso. O app deve sugerir os valores Threshold ideais para cada indicador se o usuário não os tiver definidos mas pedir para o usuário definir como uma sugestão.
---

## 3. O Motor de Indicação (Algoritmo de Enquadramento)

A *engine* do aplicativo não emite ordens, apenas calcula os limites absolutos de exposição e o desvio da carteira atual em relação aos parâmetros estabelecidos.

### Passo 1: Cálculo do Limite Absoluto

Para cada ativo cadastrado (ex: BBAS3, HGLG11), o sistema executa a fórmula matemática que cruza a classe macro com o micro:

$$Limite_{Absoluto (\%)} = Target_{Classe (User\,Pref)} \times Limite_{Tier (User\,Pref)}$$

### Passo 2: Verificação do Estado de Enquadramento

O sistema compara o percentual financeiro real do ativo na carteira com o $Limite_{Absoluto}$ e o $Limite_{Setorial}$, classificando o ativo em três estados visuais no Frontend:

1. 🟢 **Em Linha:** O percentual atual < $Limite_{Absoluto}$ **E** percentual do setor < $Limite_{Setorial}$. (Há espaço para novos aportes).
2. 🟡 **Limite Atingido:** O percentual atual é exatamente igual (ou possui margem mínima de 0.5%) ao $Limite_{Absoluto}$.
3. 🔴 **Desenquadrado por Excesso:** O percentual atual ultrapassou o limite estabelecido (devido a uma forte valorização de mercado ou rebaixamento de nota). *Ação do App: Exibir o excesso em %. Não sugerir venda.*

---

## 4. UI/UX: Simulador de Distribuição Matemática (Smart Aporte)

O recurso central do aplicativo para fluxo de caixa mensal é um formulário de simulação matemática que respeita a arquitetura construída.

**Input:** Usuário digita o valor disponível (ex: R$ 1.500,00).
**Output:** O sistema processa o roteamento financeiro e **sugere** uma divisão do capital seguindo a árvore de prioridades:

1. **Cálculo Macro:** Identifica as classes de ativos (Ações, FIIs, ETFs) que estão percentualmente mais abaixo da meta definida nas configurações globais.
2. **Filtro Micro:** Dentro da classe mais defasada, filtra apenas os ativos com o status 🟢 **Em Linha**.
3. **Ordenação por Qualidade:** Organiza os ativos filtrados do maior para o menor *Score de Convicção*.
4. **Distribuição Proporcional:** Divide o valor do aporte entre os top ativos da lista, calculando quantos lotes/cotas podem ser comprados sem que o ativo mude seu status para "Desenquadrado".
5. **Exceção de Trava Setorial:** Se a alocação em uma ação fizer o setor ultrapassar o teto definido, o algoritmo reduz a quantia alocada nela e joga o excedente para a próxima da lista.
6. **Rota de Fuga (Fallback):** Se o sistema varrer a base e todos os ativos com Score alto estiverem 🟡 *Limite Atingido* ou 🔴 *Desenquadrados*, o simulador direciona 100% do aporte sugerido para a classe **Caixa / Reserva Tática**.

### Gatilho de Obsolescência (Decay Trigger)

* **Regra de Banco de Dados:** Todo registro de nota qualitativa (Scuttlebutt) recebe um *timestamp*.
* Se `current_date - last_evaluation_date > 365 dias`, a interface exibe um ícone de advertência (⚠️) informando que o ativo possui um *Score Qualitativo Obsoleto*. O ativo perde temporariamente o status "Em Linha" até que o usuário refaça o checklist factual, forçando o acompanhamento da tese de investimento. O app faz uma sugestão ao usuário de refazer o checklist factual do ativo. O usuário pode escolher o período da advertência, 90 dias, 180 dias ou 365 dias.