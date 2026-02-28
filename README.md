# Minhas Finanças

Aplicativo mobile first para organização de finanças pessoais mensais, com foco em simplicidade e visualização clara de dados financeiros.

## Funcionalidades

- ✅ **Gestão de Categorias**: Adicionar, editar e remover categorias de despesa
- ✅ **Controle de Despesas**: 
  - Adicionar despesas com valor, data e categoria
  - Despesas fixas com parcelamento automático
  - Despesas recorrentes (mensais)
- ✅ **Registro de Rendas**: Incluir renda mensal com tipos (salário, freelancer, dividendos, aluguel, outros)
- ✅ **Planejamento Financeiro**: Campo para valor reservado a investimentos ou poupança mensal
- ✅ **Relatórios e Visualizações**:
  - Gráficos mensais e anuais das despesas
  - Categorias de gasto organizadas
  - Análise de evolução ao longo do tempo

## Tecnologias

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Supabase (banco de dados)
- Recharts (gráficos)
- React Router (navegação)

## Configuração

1. Instale as dependências:
```bash
npm install
```

2. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` e adicione suas credenciais do Supabase:
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

3. Configure o banco de dados no Supabase:

Execute os seguintes SQLs no Supabase SQL Editor:

```sql
-- Tabela de categorias
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- Tabela de despesas
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  description TEXT,
  is_fixed BOOLEAN DEFAULT FALSE,
  is_recurring BOOLEAN DEFAULT FALSE,
  installments INTEGER,
  current_installment INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- Tabela de rendas
CREATE TABLE incomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('salary', 'freelancer', 'dividends', 'rent', 'other')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- Tabela de investimentos
CREATE TABLE investments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(10, 2) NOT NULL,
  month TEXT NOT NULL, -- formato YYYY-MM
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- Índices para melhor performance
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_incomes_date ON incomes(date);
CREATE INDEX idx_investments_month ON investments(month);
```

4. Execute o projeto:
```bash
npm run dev
```

## Estrutura do Projeto

```
src/
├── components/     # Componentes reutilizáveis
├── hooks/          # Custom hooks para gerenciar dados
├── pages/          # Páginas da aplicação
├── lib/            # Configurações (Supabase)
├── types/          # Tipos TypeScript
└── utils/          # Funções utilitárias
```

## Desenvolvimento

O projeto está configurado para desenvolvimento mobile first, com:
- Layout responsivo otimizado para telas pequenas
- Navegação por abas na parte inferior
- Modais para formulários
- Gráficos responsivos

## Build

Para gerar a build de produção:

```bash
npm run build
```

Os arquivos estarão na pasta `dist/`.





