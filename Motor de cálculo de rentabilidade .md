# **Blueprint Arquitetural: Motor de Cálculo de Rentabilidade**

1. **1\. Fundamentação do Motor:**  
   * O motor unifica a metodologia de cotização de fundos, valoração multiproduto (Yahoo Finance \+ Renda Fixa Interna) e provisão automatizada de Imposto de Renda (IR).  
   * O objetivo é calcular a rentabilidade real líquida da carteira do usuário.  
2. **2\. Arquitetura de Dados (Modelo de Entidades):**  
   * O banco de dados deve segregar o saldo consolidado do usuário do seu histórico de lotes para suportar o cálculo regressivo de IR e a estratégia tributária.  
   * **Tabelas Essenciais:** Ativos\_Catalogo, Carteiras\_Usuario, Lotes\_Posicao, e Historico\_Cotas\_Diario.  
   * **Gestão de Eventos Corporativos:** Implementar microsserviço de Eventos Corporativos para interceptar anúncios da B3 (Splits, Inplits) e atualizar retroativamente a coluna quantidade\_atual dos lotes afetados. Mapear 'Ativos Sucessores' na tabela Ativos\_Catalogo para Fusões de Empresas.  
3. **3\. Motor Multiproduto de Valoração (Mark-to-Market):**  
   * O módulo deve rodar diariamente às 18h (pós-fechamento dos mercados) para padronizar o **Valor Bruto de Fechamento** de ativos heterogêneos.  
   * **Valoração Externa (Renda Variável/Tesouro Direto):** Utiliza o Módulo A (Yahoo Finance API).  
   * **Valoração Interna (Renda Fixa Pós-fixada):** Utiliza o Módulo B (Accrual Engine Interno), capitalizando o lote pro-rata die baseado em 252 dias úteis, consultando a taxa SELIC/CDI diária da B3.  
   * **Mitigação de Falhas na API:** Implementar circuit breaker e fallback. Se a API falhar ou retornar variação \> 50% sem justificativa, replicar o último preço válido (Last Known Value).  
   * **Mitigação de Erro na Renda Fixa:** O motor interno deve consultar um calendário de dias úteis. A capitalização deve ser rigorosamente 1.0 em dias não úteis para evitar juros fantasma.  
4. **4\. Pipeline de Fechamento Diário (The Cron Job):**  
   * Processo noturno assíncrono que calcula a rentabilidade real líquida na sequência: Valoração → Cálculo IR → Limpeza do Patrimônio → Geração da Cota.  
   * **Etapas Chave:** 1\. Coleta de Preços e Atualização Bruta; 2\. Cálculo e Desconto do IR Latente (Lote por Lote); 3\. Consolidação do Patrimônio Líquido (PL); 4\. Cálculo e Registro da Cota Líquida.  
   * **Regras Fiscais:** Manter prejuizo\_acumulado\_compensavel no perfil do usuário. A provisão de IR sobre ações (RV) só deve ocorrer se o lucro do mês superar esse saldo, garantindo a aplicação da legislação brasileira.  
   * **Otimização de Escala:** Quebrar o pipeline em filas de processamento assíncrono em paralelo (Workers). Priorizar cálculos de valoração e IR em operações de lote (Bulk Updates) no banco de dados.  
   * **Inicialização da Conta:** Proteger contra ZeroDivisionError no primeiro aporte. Se total\_cotas\_ontem \== 0, definir valor\_cota\_atual \= 10.00 e calcular total\_cotas\_atual a partir do PL inicial.  
5. **5\. Gerenciamento de Transações (Ciclo de Vida de Eventos):**  
   * **Aportes/Resgates:** O sistema de cotização protege a rentabilidade percentual histórica contra o volume absoluto de dinheiro movimentado.  
     * **Novo Aporte:** Novas\_Cotas \= Valor\_Aporte / Valor\_Cota\_Hoje. O valor da cota individual permanece idêntico.  
     * **Resgate/Saque:** Cotas são destruídas com base no valor atual da cota.  
     * **Aporte Intraday (Solução):** O aporte é registrado como "Aporte Pendente de Cotização". As novas cotas são emitidas retroativamente à noite após o fechamento do mercado (18h).  
   * **Eventos de Geração de Alfa (Dividendos/Prêmios de Opções):** O valor líquido entra no Saldo\_Caixa. Nenhuma cota é alterada no momento. A valorização da cota ocorre via aumento do PL no fechamento diário.  
   * **Manobras Fiscais (Venda Isenta \< R$ 20k):** O sistema deve **preservar** o preço de custo original do lote para não zerar artificialmente o histórico de ganho.  
   * **Liquidação Descompassada (D+2):** Utilizar o concept de **Caixa Projetado**. O valor da venda compõe o PL da carteira imediatamente para fins de rentabilidade.  
6. **6\. Métricas e UI/UX:**  
   * A interface deve consumir dados prontos e pré-calculados da tabela Historico\_Cotas\_Diario.  
   * **Métricas de Exibição:** Rentabilidade Histórica Total, Rentabilidade no Mês Atual, Rentabilidade em 12 Meses (todas derivadas da variação da cota).  
   * **Transparência:** Implementar um toggle **\[Ver Carteira Bruta | Ver Carteira Líquida\]**. A visualização padrão deve ser a Bruta.  
   * **Alinhamento de Expectativa:** Usar etiquetas como **"Patrimônio Líquido Estimado de Resgate"** e tooltips para indicar o imposto provisionado.

