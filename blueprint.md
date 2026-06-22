Blueprint Arquitetural: Motor de Cálculo de Rentabilidade (Production-Ready)1. Filosofia e Arquitetura BaseO sistema centraliza a "verdade matemática" no banco de dados, utilizando a metodologia Time-Weighted Return (TWR). O motor é desenhado para impedir anomalias matemáticas na interface de usuário — o uso estrito de tipos numéricos no banco garante que a distribuição do portfólio sempre some exatos 100% (evitando aquele erro clássico de gráficos de pizza que somam 111% por falhas de arredondamento). A conciliação via planilhas da B3 atua apenas como combustível (movimentação) e auditoria (posição).2. Modelagem de Dados (O Ledger no Supabase)Tipos numéricos precisos são inegociáveis. Toda a estrutura depende de rastreabilidade exata.Ativos: Catálogo global.Colunas: id, ticker (ex: HGLG11), classe, moeda.Transacoes: O Livro-Razão imutável da carteira.Colunas: id, usuario_id, ativo_id, ativo_id_origem (Nulo exceto em cisões), hash_idempotencia (MD5 da linha para evitar duplicatas via CSV), tipo_operacao, data, quantidade (DECIMAL 15,6), valor_unitario (DECIMAL 15,6).Posicao_Consolidada: Fotografia em tempo real gerenciada pelo banco.Colunas: usuario_id, ativo_id, quantidade_atual, total_investido.Precos_Diarios: Oráculo global (B3, Bacen, PTAX, Curvas).Colunas: ativo_id, data, preco_fechamento.Snapshots_Usuario: Registro diário para gráficos.Colunas: usuario_id, data, patrimonio_liquido, cotas_emitidas, valor_cota.3. Dicionário de Ingestão B3 e Eventos do SistemaO motor traduz eventos externos para movimentações puras de caixa e custódia.Compra / Transferência (B3): $\rightarrow$ COMPRA. Permuta saldo do caixa por ativo.Venda / Transferência (B3): $\rightarrow$ VENDA. Permuta ativo por caixa. Absorve qualquer marcação a mercado real em caso de resgate antecipado de Renda Fixa.Rendimento / JCP Liquido (B3): $\rightarrow$ DIVIDENDO. Credita o valor direto no caixa. Eleva a cota diária organicamente sem emitir novas cotas.Amortização (B3): $\rightarrow$ AMORTIZACAO. Credita o valor no caixa, mantém a quantidade do ativo intacta, mas reduz o total_investido (ajustando o preço médio).Desdobramento / Grupamento (B3): $\rightarrow$ AJUSTE_CUSTODIA. Modifica a quantidade a custo zero para neutralizar a variação de preço na B3.Cisão / Spin-off: $\rightarrow$ COMPRA com ativo_id_origem. Injeta um novo ativo descontando o valor do custo histórico do ativo de origem.4. Engine em Tempo Real (Triggers PL/pgSQL)Este código roda no "bare metal" do PostgreSQL. Intercepta inserções no Ledger e atualiza a posição instantaneamente, garantindo complexidade O(1) na hora de fechar a carteira à noite.SQLCREATE OR REPLACE FUNCTION tf_atualizar_posicao_consolidada()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ativo_id IS NOT NULL AND NEW.tipo_operacao IN ('COMPRA', 'VENDA', 'AJUSTE_CUSTODIA', 'AMORTIZACAO') THEN
        INSERT INTO posicao_consolidada (usuario_id, ativo_id, quantidade_atual, total_investido, ultima_atualizacao)
        VALUES (
            NEW.usuario_id, NEW.ativo_id,
            CASE 
                WHEN NEW.tipo_operacao IN ('COMPRA', 'AJUSTE_CUSTODIA') THEN NEW.quantidade
                WHEN NEW.tipo_operacao = 'VENDA' THEN -NEW.quantidade
                ELSE 0 
            END,
            CASE 
                WHEN NEW.tipo_operacao = 'COMPRA' THEN (NEW.quantidade * NEW.valor_unitario)
                ELSE 0 
            END,
            NOW()
        )
        ON CONFLICT (usuario_id, ativo_id) 
        DO UPDATE SET
            quantidade_atual = posicao_consolidada.quantidade_atual + 
                CASE 
                    WHEN NEW.tipo_operacao IN ('COMPRA', 'AJUSTE_CUSTODIA') THEN NEW.quantidade
                    WHEN NEW.tipo_operacao = 'VENDA' THEN -NEW.quantidade
                    ELSE 0 
                END,
            total_investido = GREATEST(0, posicao_consolidada.total_investido + 
                CASE 
                    WHEN NEW.tipo_operacao = 'COMPRA' THEN (NEW.quantidade * NEW.valor_unitario)
                    WHEN NEW.tipo_operacao = 'VENDA' THEN -(NEW.quantidade * (posicao_consolidada.total_investido / NULLIF(posicao_consolidada.quantidade_atual, 0)))
                    WHEN NEW.tipo_operacao = 'AMORTIZACAO' THEN -(NEW.quantidade * NEW.valor_unitario)
                    ELSE 0 
                END),
            ultima_atualizacao = NOW();
            
        -- Cisão: Abate o custo do ativo de origem
        IF NEW.ativo_id_origem IS NOT NULL THEN
            UPDATE posicao_consolidada 
            SET total_investido = GREATEST(0, total_investido - (NEW.quantidade * NEW.valor_unitario))
            WHERE usuario_id = NEW.usuario_id AND ativo_id = NEW.ativo_id_origem;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atualiza_posicao_consolidada
AFTER INSERT ON transacoes
FOR EACH ROW EXECUTE FUNCTION tf_atualizar_posicao_consolidada();
5. Precificação e Provisão de IR DinâmicoCálculos restritos a dias úteis (consultando cache em memória para evitar requests excessivos).Prefixados (Curva de 252 Dias Úteis):$$VF_{hoje} = VP_{compra} \times (1 + i_{fixo})^{\frac{n}{252}}$$Tesouro IPCA+ (VNA Projetado Sinteticamente):$$VF_{hoje} = VP_{compra} \times \frac{VNA_{hoje}}{VNA_{compra}} \times (1 + i_{fixo})^{\frac{n}{252}}$$Interceptador Fiscal (Tabela Regressiva): Subtraído do lucro latente antes do fechamento do PL diário. Varia de 22,5% (até 180 dias) a 15,0% (acima de 720 dias).6. Pipeline Assíncrono (Worker em Python)Script executado fora do front-end para evitar timeouts, processando o fechamento do dia.Filtro de Calendário & Oráculos: Bloqueia execução se for fim de semana/feriado. Busca PTAX, B3 e gera o VNA daquele dia.Lock Concorrente: Na leitura dos usuários, aplica SELECT FOR UPDATE para evitar inconsistências caso depósitos entrem de madrugada.Last Known Value: Na precificação, usa COALESCE(preco_hoje, preco_ontem) para evitar que falhas da API da B3 zerem a carteira do usuário.Cálculo da Cota TWR: Emissão de cotas fechada com base na rentabilidade pura do mercado:$$Valor\ da\ Cota_{Hoje} = \frac{PL_{Fechamento}}{Cotas\ Emitidas_{Ontem}}$$Limbo de Cota Zero: Se Cotas_Emitidas_Ontem == 0 (resgate total anterior), reseta o valor da cota para base 10.00 antes dos novos aportes do dia.7. Regras de Interface e Experiência do Usuário (UX)O Problema do "Caixa Fantasma": A conciliação da B3 traz os ativos, mas não o dinheiro aportado, negativando a Conta Caixa do sistema.Solução UI: Após importar o CSV com sucesso, exibir modal: "Identificamos suas operações. Qual era seu saldo em conta na corretora no dia X?"O motor calcula a diferença e injeta um DEPOSITO retroativo na data mais antiga, aterrando o PL e a rentabilidade sem distorções.Yield on Cost (YoC): No dashboard, calcular como SUM(dividendos) / total_investido. A existência do evento AMORTIZACAO mantém essa métrica honesta, focada apenas em lucros reais.Benchmarks Naturais: IBOVESPA e CDI são inseridos no banco como ativos comuns, cotizados na base 10.00 no mesmo dia da criação da conta do usuário. Isso permite cruzar gráficos de rentabilidade e Sharpe instantaneamente.