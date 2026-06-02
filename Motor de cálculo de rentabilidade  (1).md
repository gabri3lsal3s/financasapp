### **Blueprint Arquitetural: Motor de Cálculo de Rentabilidade v2.0 \- Sumário Executivo para Código**

#### **1\. Fundamentação do Motor**

* **Propósito Principal:** Calcular a rentabilidade real líquida e a cota patrimonial do usuário.  
* **Metodologia:** Unificar cotização de fundos, valoração multiproduto (Renda Variável via API externa \+ Renda Fixa Privada/Pública via Accrual Interno) e provisão automatizada de Imposto de Renda (IR).

#### **2\. Arquitetura de Dados (Modelo de Entidades)**

* O banco de dados deve segregar o saldo consolidado do histórico de lotes para suportar o Tesouro Direto com taxas distintas por aporte.  
* **Entidades Essenciais:**  
  * **Ativos\_Catalogo:** Dados globais do ativo.  
  * **Carteiras\_Usuario:** Saldo consolidado, cotas emitidas e PL atual.  
  * **Lotes\_Posicao:** Granularidade fundamental, onde cada aporte é uma linha.  
    * **Campos Cruciais em Lotes\_Posicao:** taxa\_pactuada\_anual, indexador (IPCA, SELIC, Prefixado), data\_vencimento, e vna\_compra (Valor Nominal Atualizado na data do aporte).  
  * **Historico\_Cotas\_Diario:** Snapshot diário para gráficos.  
* **Microsserviço de Eventos Corporativos:** Deve interceptar anúncios da B3 (Splits, Inplits) e atualizar retroativamente a coluna quantidade\_atual dos lotes de Renda Variável afetados.

#### **3\. Motor Multiproduto de Valoração (Marcação Diária)**

* O módulo de valoração deve rodar diariamente às 18h.  
* **Módulo A \- Valoração Externa (Renda Variável):**  
  * **Ativos:** Ações, FIIs e BDRs.  
  * **Fonte:** API de mercado (Yahoo Finance/B3).  
  * **Mitigação de Falhas:** Se a API falhar ou retornar variação brusca (\> 50%) sem justificativa corporativa, replicar o último preço válido (Last Known Value).  
* **Módulo B \- Accrual Interno Privado (CDB, LCI, LCA):**  
  * Capitalização pro-rata die baseada em 252 dias úteis.  
  * Consulta a curva do CDI.  
* **Módulo C \- Accrual Interno Público (Tesouro na Curva):**  
  * O cálculo utiliza estritamente a taxa\_pactuada\_anual do aporte, não consultando o preço de tela.  
  * Requer consulta a um calendário de feriados (ANBIMA) para contagem exata de dias úteis (n). Rendimento em dias não úteis é 1.0 (zero juros).  
  * **Fórmulas de Valoração:**  
    * Tesouro Prefixado: VF \= VP \* (1 \+ i)^(n/252)  
    * Tesouro IPCA+: Exige VNA (Valor Nominal Atualizado) da ANBIMA (dia 15 de cada mês) com projeção pro-rata da inflação para os dias quebrados: VF \= VP \* (VNA\_hoje / VNA\_compra) \* (1 \+ i)^(n/252)

#### **4\. Pipeline de Fechamento Diário (The Cron Job)**

* **Processo:** Execução noturna assíncrona para consolidação do Patrimônio Líquido (PL).  
* **Sequência de Etapas:**  
  1. **Atualização Bruta:** Cálculo do valor bruto atualizado de todos os lotes (via Módulos A, B e C).  
  2. **Provisão de IR Latente:** Aplicação da tabela regressiva baseada na idade do lote.  
     * Ações: Desconto de IR apenas se o ganho exceder o prejuizo\_acumulado\_compensavel ou a isenção dos R$ 20k no mês.  
     * Tesouro e Renda Fixa: Uso de tabela regressiva (22,5% a 15%) sobre o lucro individual do lote.  
  3. **Consolidação do PL:** Soma do valor líquido dos lotes. A totalização deve ser matematicamente cravada, garantindo 100% de peso no portfólio.  
  4. **Cota Líquida:** Cota\_Atual \= PL\_Hoje / Total\_Cotas\_Emitidas. Inicialização da Cota\_Atual em 10.00 se Total\_Cotas\_Ontem \== 0\.

#### **5\. Gerenciamento de Transações (Eventos de Ciclo de Vida)**

* **Aporte Intraday em Tesouro:** Registro como "Pendente". Emissão de novas cotas patrimoniais ocorre apenas no fechamento noturno (D+0 às 18h), ancorada na cota de fechamento.  
* **Consolidação Visual:** Lotes são agregados via Ativo\_ID. A rentabilidade bruta do ativo unificado é a média ponderada do desempenho dos lotes.  
* **Resgate/Venda:** Utiliza o método PEPS (Primeiro que Entra, Primeiro que Sai) ou permite seleção manual de lotes (para otimização fiscal). O lote é abatido e as cotas patrimoniais equivalentes são destruídas.

#### **6\. Métricas e UI/UX (Requisitos de Exibição)**

* **Tesouro Direto:** Exibir a "Taxa Média Pactuada" (ponderada pelo volume) para o ativo unificado.  
* **Toggle:** Manter a visão Bruta como padrão.  
* **Alinhamento de Expectativa (Tesouro):** Adicionar tooltip no card do Tesouro informando que a valoração é na curva (pela taxa contratada) e não reflete o valor de resgate antecipado a mercado.

#### **7\. Analytics e Fechamento de Período**

#### **7.1. Arquitetura de Dados (Roll-ups e Consolidação)**

* Criar tabelas de agregação (Snapshot\_Mensal\_Carteira e Snapshot\_Anual\_Carteira) para garantir carregamento instantâneo da UI.  
* **Dados Armazenados por Período (Snapshots):** cota\_abertura, cota\_fechamento, somatorio\_aportes, somatorio\_resgates, dividendos\_recebidos, e drawdown\_maximo.

#### **7.2. Matemática de Retorno do Período (Time-Weighted Return)**

* O cálculo utiliza as cotas para isolar distorções de fluxo de caixa.  
* **Fórmulas (Baseadas em Cota de Fechamento):**  
  * Rentabilidade do Mês (Rm): Rm \= (Cota\_fechamento\_mes / Cota\_fechamento\_mes\_anterior) \- 1  
  * Rentabilidade do Ano (Ra): Ra \= (Cota\_fechamento\_ano / Cota\_fechamento\_ano\_anterior) \- 1

#### **7.3. Pipeline Assíncrono de Fechamento (End-of-Month / End-of-Year Job)**

* **Rotina EOM (End of Month):** Executada na madrugada do dia 1º de cada mês. Consolida dados na Snapshot\_Mensal\_Carteira e dispara processos secundários (ex: Geração de PDF).  
* **Rotina EOY (End of Year):** Executada em 1º de janeiro. Gera o Informe de Rendimentos e Posição em 31/12 com preços médios exatos para a declaração de IR (DIRPF).

#### **7.4. UI/UX: Visualização do Analytics**

1. O frontend deve popular três componentes vitais a partir das tabelas de Snapshot:  
2. **Matriz de Rentabilidade (Heatmap):** Tabela mensal/anual com percentuais e acumulado do ano.  
3. **Crescimento Orgânico vs. Esforço de Poupança:** Gráfico de barras empilhadas que separa "Dinheiro Novo" (aportes líquidos) de "Rendimento do Mercado" (juros/valorização).  
4. **Comparativo de Benchmark:** Sobrepor a variação da cota do usuário à variação do CDI, IPCA e IBOVESPA no mesmo período.

