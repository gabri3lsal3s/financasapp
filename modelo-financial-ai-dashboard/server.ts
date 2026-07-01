import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { Expense, Income } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log('Gemini client initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Gemini client:', error);
  }
} else {
  console.warn('GEMINI_API_KEY environment variable is not configured with a valid key. Using simulated AI responses.');
}

// API Routes
app.post('/api/chat', async (req, res) => {
  const { messages, currentFinancials } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages body' });
  }

  const userText = messages[messages.length - 1]?.text || '';

  // 1. If Gemini client is NOT configured, use a smart rules-based local assistant
  if (!ai) {
    return simulateAssistantResponse(userText, currentFinancials, res);
  }

  try {
    // Format previous messages for Gemini context
    const chatHistory = messages.map((m: any) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    // High-performance context compression to support large scale data & save tokens
    const { categorySummary, groupSummary, highlights, optimizedExpenses, optimizedIncomes } = optimizeFinancialContext(currentFinancials);

    const systemInstruction = `
Você é o co-piloto de inteligência financeira pessoal de Gabriel. Suas respostas devem ser extremamente organizadas, sintetizadas, resumidas e fáceis de ler pelo celular.
Mês de referência: Junho de 2026.
Idioma: Português do Brasil.

Seu foco principal é auxiliar a equilibrar as finanças e economizar de forma extremamente direta e objetiva.

Dados financeiros consolidados de Gabriel:
- Saldo atual: R$ ${currentFinancials?.balance?.toFixed(2) || '1.238,85'}
- Receitas totais: R$ ${currentFinancials?.totalIncome?.toFixed(2) || '1.238,85'}
- Despesas totais: R$ ${currentFinancials?.totalExpense?.toFixed(2) || '1.939,52'}
- Saldo Líquido atual: R$ ${(currentFinancials?.totalIncome - currentFinancials?.totalExpense)?.toFixed(2) || '-700,67'}
- Gastos de hoje: R$ ${currentFinancials?.spentToday?.toFixed(2) || '30,00'}
- Fatura Cartão de Crédito: R$ ${currentFinancials?.cardInvoice?.toFixed(2) || '2.270,90'}

Resumo por Categoria de Despesa (Exato):
${categorySummary}

Resumo por Grupo de Despesa:
${groupSummary}

Destaques e Métricas Avançadas:
${highlights}

Ledger de Lançamentos de Despesa (Amostra Otimizada dos Mais Recentes e Relevantes):
Formato: Data | Título | Categoria | Valor | Grupo
${optimizedExpenses}

Ledger de Lançamentos de Renda (Mais Recentes):
Formato: Data | Título | Categoria | Valor
${optimizedIncomes}

REGRAS CRÍTICAS DE PERSONA, RESPOSTA E FORMATAÇÃO:
1. NUNCA USE SAUDAÇÕES CONVERSACIONAIS OU INFORMAIS: Não comece com "Olá Gabriel!", "Oi Gabriel!", "Fala, Gabriel!", ou saudações similares. Comece respondendo diretamente à pergunta ou com o fato principal solicitado.
2. SEJA EXTREMAMENTE DIRETO E OBJETIVO: Vá direto ao ponto das finanças. Comece imediatamente com enunciados assertivos como "Aqui está o seu resumo financeiro de hoje, dia 30 de Junho:" ou "Seu saldo líquido atual...".
3. SINTETIZE E RESUMA AO MÁXIMO: Apresente somente as informações essenciais e necessárias com base direta no que foi solicitado.
4. EVITE EXCESSO DE TÓPICOS: Não divida muitas informações em bullet points ou listas longas. Prefira textos breves, fluidos e corridos.
5. SEM PARÁGRAFOS GRANDES: Limite cada parágrafo a no máximo 2 linhas.
6. DESTAQUE valores, categorias e metas em **negrito** (ex: **R$ 50,00**).
7. NUNCA USE EMOJIS DE FORMA NENHUMA: Não inclua emojis, ícones ou símbolos pictográficos (como 📊, 🔍, 💡, 💰, ⏱️, 🚗, ➕, 🌸, 📉, 👏, ⚠️, 🎯, 👉) nas suas respostas.
8. Se o usuário pedir gráficos ou históricos, inclua a linha especial ao final:
[CHART_DATA: [{"name":"SEG", "value":30}, {"name":"TER", "value":55}, {"name":"QUA", "value":156.46}, {"name":"HOJE", "value":30, "active":true}]]
`;

    // Call the model (gemini-3.5-flash is perfect for fast chat responses)
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: userText,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    const replyText = response.text || 'Desculpe, não consegui processar sua solicitação no momento.';
    
    // Check if replyText contains [CHART_DATA: ...]
    let text = replyText;
    let chartData = undefined;
    const chartRegex = /\[CHART_DATA:\s*(\[.*?\])\s*\]/;
    const match = replyText.match(chartRegex);
    if (match) {
      try {
        chartData = JSON.parse(match[1]);
        text = replyText.replace(chartRegex, '').trim();
      } catch (err) {
        console.error('Failed to parse chart data generated by model', err);
      }
    }

    return res.json({ text, chartData });

  } catch (error: any) {
    console.error('Gemini API Error:', error);
    // Fallback to simulated assistant if real API call fails
    return simulateAssistantResponse(userText, currentFinancials, res);
  }
});

function optimizeFinancialContext(currentFinancials: any) {
  if (!currentFinancials) {
    return {
      categorySummary: 'Nenhuma registrada',
      groupSummary: 'Nenhum registrado',
      highlights: 'Sem métricas adicionais',
      optimizedExpenses: 'Nenhuma registrada',
      optimizedIncomes: 'Nenhuma registrada'
    };
  }

  const expenses: Expense[] = currentFinancials.expenses || [];
  const incomes: Income[] = currentFinancials.incomes || [];

  // 1. Calculate Category Totals (Despesas)
  const categoryMap: Record<string, number> = {};
  let totalExpense = 0;
  expenses.forEach(e => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
    totalExpense += e.amount;
  });

  const categorySummary = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => {
      const pct = totalExpense > 0 ? ((val / totalExpense) * 100).toFixed(1) : '0';
      return `- ${cat}: R$ ${val.toFixed(2)} (${pct}%)`;
    })
    .join('\n');

  // 2. Calculate Group Totals
  const groupMap: Record<string, number> = {};
  expenses.forEach(e => {
    const grp = e.group || 'DESPESAS DO MÊS';
    groupMap[grp] = (groupMap[grp] || 0) + e.amount;
  });
  const groupSummary = Object.entries(groupMap)
    .map(([grp, val]) => `- ${grp}: R$ ${val.toFixed(2)}`)
    .join('\n');

  // 3. Highlights
  let largestExpenseName = 'Nenhum';
  let largestExpenseAmount = 0;
  expenses.forEach(e => {
    if (e.amount > largestExpenseAmount) {
      largestExpenseAmount = e.amount;
      largestExpenseName = `${e.title} (${e.category})`;
    }
  });

  const avgExpense = expenses.length > 0 ? (totalExpense / expenses.length).toFixed(2) : '0.00';
  const highlights = `- Total de lançamentos de despesa: ${expenses.length} itens\n- Média por despesa: R$ ${avgExpense}\n- Maior despesa única: ${largestExpenseName} por R$ ${largestExpenseAmount.toFixed(2)}`;

  // 4. Compact Ledger of Expenses (Sort by Date / Amount to get a highly relevant sample)
  // To avoid token bloat with thousands of items, we select a smart mix:
  // - Top 12 largest expenses
  // - Top 15 most recent expenses
  // Deduplicate them to keep it lean.
  const sortedByAmount = [...expenses].sort((a, b) => b.amount - a.amount);
  const sortedByDate = [...expenses].sort((a, b) => {
    const [dayA, monthA] = (a.date || '').split('/').map(Number);
    const [dayB, monthB] = (b.date || '').split('/').map(Number);
    if (monthA !== monthB) return (monthB || 0) - (monthA || 0);
    return (dayB || 0) - (dayA || 0);
  });

  const selectedExpenses = new Map<string, Expense>();
  // Add top 12 largest
  sortedByAmount.slice(0, 12).forEach(e => {
    if (e && e.id) selectedExpenses.set(e.id, e);
  });
  // Add top 15 most recent
  sortedByDate.slice(0, 15).forEach(e => {
    if (e && e.id) selectedExpenses.set(e.id, e);
  });

  const optimizedExpenses = Array.from(selectedExpenses.values())
    .map(e => `${e.date || '30/06'} | ${e.title} | ${e.category} | R$ ${e.amount.toFixed(2)} | ${e.group || 'DESPESAS DO MÊS'}`)
    .join('\n');

  // 5. Incomes Compact Ledger
  const optimizedIncomes = incomes
    .slice(0, 15) // Limit to recent 15 incomes
    .map(i => `${i.date || '30/06'} | ${i.title} | ${i.category} | R$ ${i.amount.toFixed(2)}`)
    .join('\n');

  return {
    categorySummary: categorySummary || 'Nenhuma registrada',
    groupSummary: groupSummary || 'Nenhum registrado',
    highlights: highlights,
    optimizedExpenses: optimizedExpenses || 'Nenhuma registrada',
    optimizedIncomes: optimizedIncomes || 'Nenhuma registrada'
  };
}

// Mock/Simulated Assistant logic to handle cases when there is no API key configured or connection fails
function simulateAssistantResponse(userText: string, currentFinancials: any, res: any) {
  const query = userText.toLowerCase();
  let text = '';
  let chartData = undefined;

  if (query.includes('gasto') || query.includes('despesa') || query.includes('consumo')) {
    if (query.includes('últimos') || query.includes('dias') || query.includes('gráfico') || query.includes('comparativo')) {
      text = `**Análise Diária de Gastos**\n\nSeu maior gasto recente ocorreu na quarta-feira com o "Rolê no Ville" (**R$ 156,46**), enquanto hoje você gastou apenas **R$ 30,00** (Vivo Easy).\n\n**Dica**: Reduza gastos adicionais com Lazer nos próximos dias para reverter o saldo negativo.`;
      chartData = [
        { name: 'SEG', value: 30, active: false },
        { name: 'TER', value: 55, active: false },
        { name: 'QUA', value: 156.46, active: true },
        { name: 'HOJE', value: 30, active: false }
      ];
    } else if (query.includes('categoria') || query.includes('onde')) {
      text = `**Distribuição de Gastos**\n\nSeus maiores consumos estão concentrados em **Transporte/Carro** (**R$ 233,34**) e **Lazer** (**R$ 156,46**).\n\n**Ação**: Seu saldo líquido mensal está negativo em **-R$ 700,67**. Moderar o lazer ajudará a restabelecer o caixa.`;
      chartData = [
        { name: 'Transporte', value: 233.34 },
        { name: 'Lazer', value: 156.46 },
        { name: 'Assinaturas', value: 30.00 },
        { name: 'Supermercado', value: 21.97 }
      ];
    } else {
      text = `**Relatório de Despesas**\n\nSuas despesas somam **R$ ${currentFinancials?.totalExpense?.toFixed(2) || '1.939,52'}**. O "Seguro do Corolla" (**R$ 222,34**) é o principal custo fixo.\n\n**Foco**: Economizar 10% em lazer ajudará a restabelecer seu equilíbrio financeiro.`;
    }
  } else if (query.includes('saldo') || query.includes('dinheiro') || query.includes('quanto tenho')) {
    text = `**Diagnóstico de Saldo**\n\nVocê possui **R$ ${currentFinancials?.balance?.toFixed(2) || '1.238,85'}** em conta, mas suas despesas (**R$ ${currentFinancials?.totalExpense?.toFixed(2) || '1.939,52'}**) superaram as receitas.\n\n**Alerta**: Com um déficit de **-R$ ${(currentFinancials?.totalExpense - currentFinancials?.totalIncome)?.toFixed(2) || '700,67'}**, sugerimos adiar compras adicionais imediatamente.`;
  } else if (query.includes('diario') || query.includes('diário') || query.includes('acompanhamento') || query.includes('hoje') || query.includes('limite')) {
    text = `**Acompanhamento Diário**\n\nHoje você gastou **R$ ${currentFinancials?.spentToday?.toFixed(2) || '30,00'}**, permanecendo dentro do limite diário sugerido de **R$ 41,29**.\n\n**Meta**: Manter essa disciplina diária ajudará a cobrir gradualmente o saldo negativo mensal.`;
    chartData = [
      { name: 'LIMITE', value: 41.29, active: false },
      { name: 'HOJE', value: currentFinancials?.spentToday || 30.00, active: true }
    ];
  } else if (query.includes('corolla') || query.includes('carro')) {
    text = `**Análise do Seguro do Corolla**\n\nO seguro consome **R$ 222,34** mensais, representando **11%** de todas as suas despesas.\n\n**Dica**: No próximo vencimento, busque realizar cotações com outras companhias para tentar reduzir esse custo fixo.`;
  } else if (query.includes('ajuda') || query.includes('olá') || query.includes('oi') || query.includes('bom dia') || query.includes('boa tarde')) {
    text = `Aqui está o suporte financeiro inteligente:\n\nEstou pronto para analisar seu saldo atual, detalhar metas diárias ou avaliar o impacto de despesas específicas.`;
  } else {
    text = `**Resumo de Indicadores**\n\nSuas receitas de **R$ ${currentFinancials?.totalIncome?.toFixed(2) || '1.238,85'}** estão abaixo das despesas de **R$ ${currentFinancials?.totalExpense?.toFixed(2) || '1.939,52'}**, gerando um déficit de **-R$ ${(currentFinancials?.totalExpense - currentFinancials?.totalIncome)?.toFixed(2) || '700,67'}**.\n\nPeça-me uma análise de gastos recentes para começarmos a planejar.`;
  }

  return res.json({ text, chartData });
}

// Vite and static build setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer();
