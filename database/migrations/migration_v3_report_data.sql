-- ADICIONAR COLUNAS PARA PERSISTÊNCIA DE DADOS EDITÁVEIS NO RELATÓRIO
ALTER TABLE consulting_reports 
ADD COLUMN IF NOT EXISTS performance_table JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS planning_actions JSONB DEFAULT '[]'::jsonb;

-- COMENTÁRIO PARA DOCUMENTAÇÃO
COMMENT ON COLUMN consulting_reports.performance_table IS 'Dados da Tabela A (Balanço de Performance) editados pelo consultor';
COMMENT ON COLUMN consulting_reports.planning_actions IS 'Lista de diretrizes de ações planejadas para o próximo ciclo';
