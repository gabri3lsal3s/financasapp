import React, { useState, useEffect, useRef } from 'react';
import { 
  motion, 
  AnimatePresence 
} from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Send, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  AlertTriangle, 
  Sparkles, 
  ArrowLeft, 
  DollarSign, 
  Calendar, 
  User, 
  Wallet, 
  MoreHorizontal, 
  Check, 
  Loader2, 
  Activity, 
  Percent, 
  PiggyBank, 
  Scale, 
  Receipt,
  Eye,
  EyeOff,
  Home,
  Search,
  Lightbulb,
  X,
  Pin,
  RefreshCw
} from 'lucide-react';
import { 
  Expense, 
  Income, 
  CreditCard as ICreditCard, 
  ChatMessage 
} from './types';
import { InteractiveAIChart } from './components/InteractiveAIChart';
import { 
  INITIAL_EXPENSES, 
  INITIAL_INCOMES, 
  CREDIT_CARDS, 
  MOCK_CHATS 
} from './data';

// Helper to filter and organize raw AI narrative text into a concise, high-value summary points list
const getOrganizedSummary = (text: string): string[] => {
  if (!text) return [];
  
  // Split into lines/sentences
  const sentences = text.split(/[.\n;]+/).map(s => s.trim()).filter(s => s.length > 5);
  
  const ignorePatterns = [
    /olá/i,
    /gabriel/i,
    /como posso ajudar/i,
    /montei seu painel/i,
    /analisei suas/i,
    /entendido/i,
    /adicionei com sucesso/i,
    /faturas e gráficos/i,
    /o que gostaria de/i,
    /interessante pergunta/i,
    /sou seu assistente/i,
    /basta clicar no botão/i,
    /se você quiser comparar/i,
    /clicando no botão/i
  ];

  return sentences.filter(sentence => {
    const isIgnore = ignorePatterns.some(pattern => pattern.test(sentence));
    const hasFinancialTerm = /gasto|despesa|receita|saldo|R\$|%|limite|meta|fatura|economia|cartão|reduzir|controle/i.test(sentence);
    return hasFinancialTerm && !isIgnore;
  }).map(sentence => {
    // Strip bullet points, numbers, asterisks from front
    let cleaned = sentence.replace(/^[\s•\-\*引导\d\.\s]+/, '').trim();
    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return cleaned;
  });
};

const parseBoldText = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2);
      // If it contains currency like R$ or percentage, highlight it beautifully
      const isCurrency = /R\$\s*-?\d+/.test(content) || /\d+%/.test(content);
      if (isCurrency) {
        return (
          <span key={idx} className="bg-blue-50/80 text-blue-700 font-extrabold px-1.5 py-0.5 rounded-md font-mono text-[10px] mx-0.5 inline-block align-middle whitespace-nowrap">
            {content}
          </span>
        );
      }
      return <strong key={idx} className="font-extrabold text-slate-800">{content}</strong>;
    }
    return <span key={idx}>{part}</span>;
  });
};

const BeautifulMarkdown = ({ text }: { text: string }) => {
  if (!text) return null;

  // Split text by lines
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  return (
    <div className="space-y-2 text-slate-600 text-[11px] font-semibold leading-relaxed">
      {lines.map((line, idx) => {
        // Check if line is a header (starts with ### or ## or #, or starts and ends with **)
        const isHeading3 = line.startsWith('###');
        const isHeading2 = line.startsWith('##') && !isHeading3;
        const isHeading1 = line.startsWith('#') && !isHeading2 && !isHeading3;
        const isPureBoldHeader = line.startsWith('**') && line.endsWith('**') && line.length > 4 && !line.includes('\n');
        
        if (isHeading1 || isHeading2 || isHeading3 || isPureBoldHeader) {
          const cleanText = line
            .replace(/^#+\s*/, '')
            .replace(/^\*\*(.*)\*\*$/, '$1');
          return (
            <h4 key={idx} className="font-display font-black text-slate-800 text-[11px] uppercase tracking-wider mt-4 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-1">
              {parseBoldText(cleanText)}
            </h4>
          );
        }

        // Check if line is a bullet point
        const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
        if (isBullet) {
          const cleanedLine = line.replace(/^[•\-\*]\s*/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5 py-0.5">
              <span className="text-blue-500 text-[10px] select-none mt-0.5">•</span>
              <span className="flex-1">{parseBoldText(cleanedLine)}</span>
            </div>
          );
        }

        // Regular paragraph line
        return (
          <p key={idx} className="py-0.5">
            {parseBoldText(line)}
          </p>
        );
      })}
    </div>
  );
};

export default function App() {
  // Screen States
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom notifications list state
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'Meta Diária de Junho',
      desc: 'Excelente! Você economizou R$ 30,00 ontem em relação ao seu limite diário.',
      time: '1h atrás',
      unread: true,
      type: 'success'
    },
    {
      id: 2,
      title: 'Fatura Rico Visa Próxima',
      desc: 'Sua fatura do cartão Rico de R$ 2.270,90 vence dia 07/07. Toque para analisar com a IA.',
      time: '3h atrás',
      unread: true,
      type: 'warning'
    },
    {
      id: 3,
      title: 'Dica do Seguro do Corolla',
      desc: 'Seu seguro do Corolla (R$ 222,34) representa 11% das despesas. Toque para ver dicas.',
      time: 'Ontem',
      unread: false,
      type: 'ai'
    }
  ]);
  
  // Data States
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [incomes, setIncomes] = useState<Income[]>(INITIAL_INCOMES);
  const [creditCards, setCreditCards] = useState<ICreditCard[]>(CREDIT_CARDS);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = Junho de 2026, -1 = Maio, +1 = Julho
  
  // Accounts screen loader state
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [activeAccountsSubTab, setActiveAccountsSubTab] = useState<'cartoes' | 'pendencias'>('cartoes');

  // New Transaction Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [txType, setTxType] = useState<'despesa' | 'receita'>('despesa');
  const [txTitle, setTxTitle] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState('30/06');
  const [txExpenseGroup, setTxExpenseGroup] = useState<'PARCELADAS' | 'DESPESAS DO MÊS'>('DESPESAS DO MÊS');

  // AI Chat States
  const [chats, setChats] = useState<ChatMessage[]>(MOCK_CHATS);
  const [chatInput, setChatInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Computed AI assistant state for integrated dashboard
  const latestAiMessage = [...chats].reverse().find(msg => msg.sender === 'ai');
  const latestUserMessage = [...chats].reverse().find(msg => msg.sender === 'user');

  // Financial Calculations
  const [totalIncome, setTotalIncome] = useState(1238.85);
  const [totalExpense, setTotalExpense] = useState(1939.52);
  const [balance, setBalance] = useState(1238.85);
  const [spentToday, setSpentToday] = useState(30.00);
  const [cardInvoice, setCardInvoice] = useState(2270.90);

  // User selected budget source ('atual' | 'projetada' | 'customizada')
  const [incomeSource, setIncomeSource] = useState<'atual' | 'projetada' | 'customizada'>('atual');
  const [customIncome, setCustomIncome] = useState<number>(2500);

  // Pinned AI analysis & card state
  const [pinnedAnalysis, setPinnedAnalysis] = useState<{
    text: string;
    chartData: Array<{ name: string; value: number; active?: boolean }>;
    queryText?: string;
    dataHash?: string;
  } | null>(() => {
    const saved = localStorage.getItem('pinned_analysis');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Save changes to localStorage
  useEffect(() => {
    if (pinnedAnalysis) {
      localStorage.setItem('pinned_analysis', JSON.stringify(pinnedAnalysis));
    } else {
      localStorage.removeItem('pinned_analysis');
    }
  }, [pinnedAnalysis]);

  // Current fingerprint of all transactions to detect additions or updates
  const currentDataHash = `exp:${expenses.length}_${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}|inc:${incomes.length}_${incomes.reduce((s, i) => s + i.amount, 0).toFixed(2)}`;
  const hasNewDataForPinned = !!(pinnedAnalysis && pinnedAnalysis.dataHash !== currentDataHash);

  // Recalculate financial totals whenever items change
  useEffect(() => {
    // Dynamic calculation matching standard mock profile
    const expensesSum = expenses.reduce((sum, item) => sum + item.amount, 0);
    const incomesSum = incomes.reduce((sum, item) => sum + item.amount, 0);
    
    // Calculate spent today (e.g. date is '30/06' or current date)
    const todayStr = '30/06';
    const todaySum = expenses
      .filter(item => item.date === todayStr)
      .reduce((sum, item) => sum + item.amount, 0);

    // Let's keep a stable balance calculation: Income - Expense (or a pre-configured starting wallet balance)
    // To match the screens: Incomes is 1.238,85. Expenses is 1.939,52. Saldo in account is R$ 1.238,85.
    // If user adds items, let's adjust them starting from these values to keep it intuitive!
    const startingIncome = 1238.85;
    const startingExpense = 1939.52;
    const startingBalance = 1238.85;
    const startingCardInvoice = 2270.90;

    const addedExpense = expensesSum - INITIAL_EXPENSES.reduce((sum, item) => sum + item.amount, 0);
    const addedIncome = incomesSum - INITIAL_INCOMES.reduce((sum, item) => sum + item.amount, 0);

    setTotalIncome(startingIncome + addedIncome);
    setTotalExpense(startingExpense + addedExpense);
    setBalance(startingBalance + addedIncome - addedExpense);
    setSpentToday(30.00 + (todaySum - INITIAL_EXPENSES.filter(e => e.date === todayStr).reduce((sum, e) => sum + e.amount, 0)));
    setCardInvoice(startingCardInvoice + addedExpense);
  }, [expenses, incomes]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, isAiTyping]);

  const [isUpdatingPinned, setIsUpdatingPinned] = useState(false);
  const [pinnedUpdateFeedback, setPinnedUpdateFeedback] = useState<string | null>(null);

  const handleUpdatePinnedAnalysis = async () => {
    if (!pinnedAnalysis) return;

    // Calculate the current financial data hash (fingerprint of count and total sum of expenses & incomes)
    const currentHash = `exp:${expenses.length}_${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}|inc:${incomes.length}_${incomes.reduce((s, i) => s + i.amount, 0).toFixed(2)}`;

    if (pinnedAnalysis.dataHash === currentHash) {
      // Data hasn't changed! Economize tokens by skipping the API call.
      setPinnedUpdateFeedback('Nenhuma alteração nos lançamentos detectada. Economizando tokens!');
      setTimeout(() => {
        setPinnedUpdateFeedback(null);
      }, 4000);
      return;
    }

    setIsUpdatingPinned(true);
    setPinnedUpdateFeedback(null);

    try {
      const currentFinancials = {
        balance,
        totalIncome,
        totalExpense,
        spentToday,
        cardInvoice,
        expenses,
        incomes
      };

      const userPrompt = pinnedAnalysis.queryText || 'Relatório Consolidado';

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            { id: `sys-pinned-${Date.now()}`, sender: 'user', text: userPrompt, timestamp: getCurrentTimeString() }
          ],
          currentFinancials
        })
      });

      if (!response.ok) {
        throw new Error('Server returned an error');
      }

      const data = await response.json();

      setPinnedAnalysis({
        text: data.text,
        chartData: data.chartData || [],
        queryText: userPrompt,
        dataHash: currentHash
      });

      setPinnedUpdateFeedback('Análise e valores atualizados com sucesso!');
      
      // Also add a friendly notification to the list
      setNotifications(prev => [
        {
          id: Date.now(),
          title: 'Análise Fixada Atualizada',
          desc: `O card de análise "${userPrompt}" foi atualizado com as novas despesas/receitas!`,
          time: 'Agora',
          unread: true,
          type: 'success'
        },
        ...prev
      ]);

      setTimeout(() => {
        setPinnedUpdateFeedback(null);
      }, 4000);

    } catch (err) {
      console.error('Pinned update error:', err);
      setPinnedUpdateFeedback('Ocorreu um erro ao atualizar os dados.');
      setTimeout(() => {
        setPinnedUpdateFeedback(null);
      }, 4000);
    } finally {
      setIsUpdatingPinned(false);
    }
  };

  // Handle chat submission
  const handleSendChat = async (e?: React.FormEvent, customInput?: string) => {
    if (e) e.preventDefault();
    const input = (customInput !== undefined ? customInput : chatInput).trim();
    if (!input) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: input,
      timestamp: getCurrentTimeString()
    };

    setChats(prev => [...prev, userMessage]);
    setChatInput('');
    setIsAiTyping(true);

    const lower = input.toLowerCase();

    // Natural Language Transaction Parser
    let parsedAmount = 0;
    let parsedTitle = '';
    let parsedType: 'despesa' | 'receita' | null = null;
    let parsedCategory = 'Outros';

    const isExpense = lower.includes('despesa') || lower.includes('gastei') || lower.includes('gastou') || lower.includes('gasto') || lower.includes('paguei') || lower.includes('pagou') || lower.includes('compra') || lower.includes('comprei');
    const isIncome = lower.includes('receita') || lower.includes('recebi') || lower.includes('ganhei') || lower.includes('renda') || lower.includes('entrada') || lower.includes('salário') || lower.includes('salario') || lower.includes('pix');

    if (isExpense || isIncome) {
      parsedType = isExpense ? 'despesa' : 'receita';
      
      // Match amount (R$ 45,00 or 45,00 or 45)
      const rxAmount = /(?:r\$\s*)?(\d+(?:[.,]\d{2})?)/i;
      const amountMatch = lower.match(rxAmount);
      if (amountMatch) {
        // Parse float safely
        const rawAmount = amountMatch[1].replace(',', '.');
        parsedAmount = parseFloat(rawAmount);
      }
      
      // Extract title/description after "com", "de", "em"
      const rxDesc = /(?:com|de|em|para)\s+([a-zA-Z0-9\sãáàâéêíóôúç]{3,20})/i;
      const descMatch = lower.match(rxDesc);
      if (descMatch) {
        parsedTitle = descMatch[1].trim();
        parsedTitle = parsedTitle.charAt(0).toUpperCase() + parsedTitle.slice(1);
      } else {
        parsedTitle = isExpense ? 'Gasto IA' : 'Receita IA';
      }

      // Infer category
      if (parsedTitle.toLowerCase().includes('cafe') || parsedTitle.toLowerCase().includes('almoço') || parsedTitle.toLowerCase().includes('comida') || parsedTitle.toLowerCase().includes('refrigerante') || parsedTitle.toLowerCase().includes('pizza')) {
        parsedCategory = 'Supermercado';
      } else if (parsedTitle.toLowerCase().includes('carro') || parsedTitle.toLowerCase().includes('gasolina') || parsedTitle.toLowerCase().includes('uber') || parsedTitle.toLowerCase().includes('taxi') || parsedTitle.toLowerCase().includes('transporte')) {
        parsedCategory = 'Transporte';
      } else if (parsedTitle.toLowerCase().includes('cinema') || parsedTitle.toLowerCase().includes('role') || parsedTitle.toLowerCase().includes('festa') || parsedTitle.toLowerCase().includes('lazer')) {
        parsedCategory = 'Lazer';
      } else if (parsedTitle.toLowerCase().includes('salario') || parsedTitle.toLowerCase().includes('pagamento') || parsedTitle.toLowerCase().includes('reembolso')) {
        parsedCategory = 'Reembolso';
      } else if (parsedTitle.toLowerCase().includes('monitoria')) {
        parsedCategory = 'Monitoria';
      }
    }

    if (parsedType && parsedAmount > 0) {
      const categoryColors: Record<string, string> = {
        'Assinaturas': 'bg-emerald-500',
        'Carro': 'bg-emerald-500',
        'Transporte': 'bg-emerald-500',
        'Lazer': 'bg-blue-500',
        'Supermercado': 'bg-orange-500',
        'Compras': 'bg-cyan-500',
        'Capex': 'bg-indigo-500',
        'Reembolso': 'bg-cyan-500',
        'Corte de Gastos': 'bg-emerald-500',
        'Monitoria': 'bg-orange-500',
        'Outros': 'bg-slate-400'
      };
      const color = categoryColors[parsedCategory] || 'bg-slate-400';

      if (parsedType === 'despesa') {
        const newExp: Expense = {
          id: `exp-ia-${Date.now()}`,
          title: parsedTitle,
          category: parsedCategory,
          amount: parsedAmount,
          date: '30/06',
          color: color,
          group: 'DESPESAS DO MÊS'
        };
        setExpenses(prev => [newExp, ...prev]);
      } else {
        const newInc: Income = {
          id: `inc-ia-${Date.now()}`,
          title: parsedTitle,
          category: parsedCategory,
          amount: parsedAmount,
          date: '30/06',
          color: color
        };
        setIncomes(prev => [newInc, ...prev]);
      }

      // Add a small delay for a high-fidelity assistant animation feel
      setTimeout(() => {
        setChats(prev => [...prev, {
          id: `ai-parse-${Date.now()}`,
          sender: 'ai',
          text: `🎯 **Entendido!** Adicionei com sucesso esta ${parsedType === 'despesa' ? 'despesa' : 'receita'} ao seu aplicativo:\n\n• **Item:** ${parsedTitle}\n• **Valor:** R$ ${parsedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n• **Categoria:** ${parsedCategory}\n\nSeu saldo, faturas e gráficos foram atualizados na tela em tempo real! 🌸`,
          timestamp: getCurrentTimeString()
        }]);
        setIsAiTyping(false);
      }, 750);
      return;
    }

    try {
      // Build the contextual state to send to Gemini
      const currentFinancials = {
        balance,
        totalIncome,
        totalExpense,
        spentToday,
        cardInvoice,
        expenses,
        incomes
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [...chats, userMessage],
          currentFinancials
        })
      });

      if (!response.ok) {
        throw new Error('Server returned an error');
      }

      const data = await response.json();
      
      setChats(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.text,
        timestamp: getCurrentTimeString(),
        chartData: data.chartData
      }]);

    } catch (err) {
      console.error('Chat error:', err);
      // Fallback message
      setChats(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: 'Desculpe, tive uma instabilidade de conexão com os servidores do Gemini. Mas posso te dar uma dica: mantenha suas despesas de mercado sob controle para evitar estourar o orçamento diário! 🌸',
        timestamp: getCurrentTimeString()
      }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // Helper: Get formatted current time
  const getCurrentTimeString = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  // Month Display Label Helper
  const getMonthDisplayLabel = (offsetOverride?: number) => {
    const baseMonth = 5; // Junho is 5
    const baseYear = 2026;
    const currentOffset = offsetOverride !== undefined ? offsetOverride : monthOffset;
    const date = new Date(baseYear, baseMonth + currentOffset, 15);
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[date.getMonth()]} de ${date.getFullYear()}`;
  };

  // Submitting new transaction
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txTitle.trim() || !txAmount.trim() || isNaN(parseFloat(txAmount))) return;

    const amountNum = parseFloat(txAmount);
    const categoryColors: Record<string, string> = {
      'Assinaturas': 'bg-emerald-500',
      'Carro': 'bg-emerald-500',
      'Transporte': 'bg-emerald-500',
      'Lazer': 'bg-blue-500',
      'Supermercado': 'bg-orange-500',
      'Compras': 'bg-cyan-500',
      'Capex': 'bg-indigo-500',
      'Reembolso': 'bg-cyan-500',
      'Corte de Gastos': 'bg-emerald-500',
      'Monitoria': 'bg-orange-500',
      'Outros': 'bg-slate-400'
    };

    const color = categoryColors[txCategory] || 'bg-slate-400';

    if (txType === 'despesa') {
      const newExp: Expense = {
        id: `exp-${Date.now()}`,
        title: txTitle,
        category: txCategory || 'Outros',
        amount: amountNum,
        date: txDate,
        color: color,
        group: txExpenseGroup
      };
      setExpenses([newExp, ...expenses]);
      
      // Push system chat message letting the AI know they added an expense!
      setChats(prev => [...prev, {
        id: `ai-notif-${Date.now()}`,
        sender: 'ai',
        text: `💰 **Nova despesa adicionada!** Lancei **R$ ${amountNum.toFixed(2)}** em *"${txTitle}"* (${txCategory}). Isso atualiza seu saldo líquido. Deseja que eu recalcule suas metas diárias?`,
        timestamp: getCurrentTimeString()
      }]);
    } else {
      const newInc: Income = {
        id: `inc-${Date.now()}`,
        title: txTitle,
        category: txCategory || 'Outros',
        amount: amountNum,
        date: txDate,
        color: color
      };
      setIncomes([newInc, ...incomes]);

      // Push system chat message letting the AI know they added an income!
      setChats(prev => [...prev, {
        id: `ai-notif-${Date.now()}`,
        sender: 'ai',
        text: `🎉 **Nova receita adicionada!** Registrei o ganho de **R$ ${amountNum.toFixed(2)}** de *"${txTitle}"* (${txCategory}). Excelente entrada para seu caixa de Junho!`,
        timestamp: getCurrentTimeString()
      }]);
    }

    // Reset Form & Close Modal
    setTxTitle('');
    setTxAmount('');
    setIsAddModalOpen(false);
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const handleDeleteIncome = (id: string) => {
    setIncomes(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="relative min-h-screen bg-[#ebeff4] font-sans text-slate-800 flex justify-center items-center p-0 sm:p-4 overflow-x-hidden antialiased">
      
      {/* Mobile Frame Container: Simulates a neat 390px iPhone for elegant responsive layout on desktops */}
      <div className="relative w-full max-w-[420px] min-h-screen sm:min-h-[850px] sm:max-h-[90vh] bg-[#f4f6fa] border-x border-slate-200/60 flex flex-col shadow-[0_15px_50px_rgba(45,58,75,0.08)] overflow-hidden pb-8 sm:rounded-[40px] sm:border">
        
        {/* APP HEADER */}
        <header className="sticky top-0 z-30 bg-[#f4f6fa]/90 backdrop-blur-lg px-6 py-4 flex flex-col gap-3.5 border-b border-slate-200/40 shadow-[0_4px_20px_-4px_rgba(148,163,184,0.05)]">
          {/* Top Row: Search Bar & Premium Notification Bell */}
          <div className="flex justify-between items-center gap-3 w-full">
            {/* Search Bar in place of Brand/App Name */}
            <div className="flex-1 relative group">
              <input
                type="text"
                placeholder="Buscar despesas, rendas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/95 border border-slate-200/80 rounded-2xl py-2.5 pl-10 pr-9 text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/80 transition-all text-slate-800 placeholder:text-slate-400 shadow-[0_2px_8px_-1px_rgba(0,0,0,0.02)] hover:border-slate-300"
              />
              <Search className="absolute left-3.5 top-3.5 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 w-5 h-5 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Notification Bell Icon */}
            <button 
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="w-10 h-10 bg-white rounded-2xl shadow-[0_2px_8px_-1px_rgba(0,0,0,0.02)] flex items-center justify-center border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all cursor-pointer relative text-slate-500 hover:text-slate-700 shrink-0"
            >
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifications.filter(n => n.unread).length > 0 && (
                  <span className="absolute -top-2.5 -right-2.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white shadow-sm shadow-rose-200 border-2 border-white animate-pulse">
                    {notifications.filter(n => n.unread).length}
                  </span>
                )}
              </div>
            </button>
          </div>
        </header>

        {/* SLIDE-DOWN NOTIFICATIONS DROPDOWN */}
        <AnimatePresence>
          {isNotificationOpen && (
            <>
              {/* Overlay */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.15 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsNotificationOpen(false)}
                className="absolute inset-0 bg-slate-900/15 z-40"
              />
              {/* Dropdown Box */}
              <motion.div 
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -30, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="absolute top-[134px] left-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl border border-[#e8edf3] shadow-lg z-50 p-4 space-y-3.5"
              >
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="font-sans font-bold text-xs text-slate-800">Notificações Recentes</span>
                  <button 
                    onClick={() => {
                      setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
                    }}
                    className="text-[9px] text-blue-600 font-bold hover:underline"
                  >
                    Marcar como lidas
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      onClick={() => {
                        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
                        setIsNotificationOpen(false);
                        
                        let queryText = '';
                        if (notif.id === 1) queryText = 'Como economizei R$ 20 ontem?';
                        if (notif.id === 2) queryText = 'O que está consumindo na minha fatura Rico Visa de R$ 2270?';
                        if (notif.id === 3) queryText = 'Por que o Seguro do Corolla de R$ 222,34 está alto? Como economizar?';
                        
                        setChatInput(queryText);
                        setTimeout(() => {
                          document.getElementById('home-ai-assistant-section')?.scrollIntoView({ behavior: 'smooth' });
                        }, 150);
                      }}
                      className="p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/60 rounded-xl transition-all cursor-pointer flex items-start gap-2.5"
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                        notif.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {notif.type === 'success' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : notif.type === 'warning' ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : (
                          <Lightbulb className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="space-y-0.5 text-left">
                        <div className="flex items-center gap-1.5">
                          <h6 className="font-bold text-[10px] text-slate-800 leading-none">{notif.title}</h6>
                          <span className="text-[8px] text-slate-400 font-bold font-mono">{notif.time}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-normal font-medium">{notif.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* VIEW AREA */}
        <main className="flex-1 px-5 pt-4 overflow-y-auto no-scrollbar">
          
          <AnimatePresence mode="wait">
            
            {/* VIEW 1: HOME TAB */}
            {(() => {
              const defaultAiReportText = `Aqui está o seu resumo financeiro de hoje, dia 30 de Junho:

Seu saldo líquido atual está em **-R$ 700,67**. Por outro lado, parabéns por gastar **15% a menos** em Lazer esta semana, mantendo os custos de transporte sob controle.

**Próxima Ação**: Como posso ajudar você a equilibrar as contas hoje?`;

              const defaultChartData = [
                { name: 'SEG', value: 30, active: false },
                { name: 'TER', value: 55, active: false },
                { name: 'QUA', value: 156.46, active: true },
                { name: 'HOJE', value: 30, active: false }
              ];

              const activeChartData = latestAiMessage ? latestAiMessage.chartData : defaultChartData;
              const activeReportText = latestAiMessage?.text || defaultAiReportText;
              const activeQueryText = latestUserMessage?.text;
              const isCurrentActivePinned = !!(pinnedAnalysis && pinnedAnalysis.text === activeReportText && !isAiTyping);
              const isDailyBudgetRequested = activeQueryText && (
                activeQueryText.toLowerCase().includes('diár') ||
                activeQueryText.toLowerCase().includes('diar') ||
                activeQueryText.toLowerCase().includes('hoje') ||
                activeQueryText.toLowerCase().includes('limite') ||
                activeQueryText.toLowerCase().includes('acompanhamento')
              );

              const selectedIncomeVal = incomeSource === 'atual' ? totalIncome : incomeSource === 'projetada' ? 2500 : customIncome;
              const dailyLimitVal = selectedIncomeVal / 30;
              const dailyRemainingVal = dailyLimitVal - spentToday;
              const monthlyRemainingVal = selectedIncomeVal - totalExpense;

              return (
                <motion.div
                  key="home-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5 pb-8"
                >


                  {/* Core Financial Indicators / Raw Inputs */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3.5">
                      {/* Revenue card */}
                      <div className="bg-white border border-slate-100 p-4.5 rounded-3xl shadow-[0_4px_16px_-4px_rgba(15,118,110,0.04)] relative overflow-hidden flex flex-col justify-between h-[125px] hover:shadow-[0_8px_24px_-4px_rgba(15,118,110,0.08)] hover:-translate-y-0.5 hover:bg-white transition-all duration-300 group">
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-emerald-500" />
                        <div>
                          <div className="flex justify-between items-center text-slate-400 text-[9px] font-bold tracking-wider uppercase">
                            <span>RENDAS DO MÊS</span>
                            <div className="p-1 rounded-lg bg-emerald-50 text-emerald-500 group-hover:scale-110 transition-transform">
                              <TrendingUp className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-slate-800 font-display font-black text-sm mt-2">
                            R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <svg className="w-full h-6 text-emerald-500/80 group-hover:text-emerald-500 transition-colors" viewBox="0 0 100 20" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="revenue-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.1"/>
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0"/>
                              </linearGradient>
                            </defs>
                            <path d="M0,18 Q15,18 30,19 T60,5 T90,15 T100,14" fill="url(#revenue-grad)" />
                            <path d="M0,18 Q15,18 30,19 T60,5 T90,15 T100,14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                          <div className="text-[8px] text-emerald-600 font-extrabold mt-1 uppercase tracking-wide">
                            vs. mês anterior -14,37%
                          </div>
                        </div>
                      </div>

                      {/* Expenses card */}
                      <div className="bg-white border border-slate-100 p-4.5 rounded-3xl shadow-[0_4px_16px_-4px_rgba(225,29,72,0.04)] relative overflow-hidden flex flex-col justify-between h-[125px] hover:shadow-[0_8px_24px_-4px_rgba(225,29,72,0.08)] hover:-translate-y-0.5 hover:bg-white transition-all duration-300 group">
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-rose-500" />
                        <div>
                          <div className="flex justify-between items-center text-slate-400 text-[9px] font-bold tracking-wider uppercase">
                            <span>DESPESAS DO MÊS</span>
                            <div className="p-1 rounded-lg bg-rose-50 text-rose-500 group-hover:scale-110 transition-transform">
                              <TrendingDown className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-slate-800 font-display font-black text-sm mt-2">
                            R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <svg className="w-full h-6 text-rose-450/80 group-hover:text-rose-500 transition-colors" viewBox="0 0 100 20" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="expense-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.1"/>
                                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0"/>
                              </linearGradient>
                            </defs>
                            <path d="M0,17 Q15,10 30,15 T60,2 T90,12 T100,10" fill="url(#expense-grad)" />
                            <path d="M0,17 Q15,10 30,15 T60,2 T90,12 T100,10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                          <div className="text-[8px] text-rose-600 font-extrabold mt-1 uppercase tracking-wide">
                            vs. mês anterior +2,04%
                          </div>
                        </div>
                      </div>

                      {/* Investments card */}
                      <div className="bg-white border border-slate-100 p-4.5 rounded-3xl shadow-[0_4px_16px_-4px_rgba(37,99,235,0.03)] relative overflow-hidden flex flex-col justify-between h-[115px] hover:shadow-[0_8px_24px_-4px_rgba(37,99,235,0.06)] hover:-translate-y-0.5 hover:bg-white transition-all duration-300 group">
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-blue-500" />
                        <div>
                          <div className="flex justify-between items-center text-slate-400 text-[9px] font-bold tracking-wider uppercase">
                            <span>INVESTIMENTOS</span>
                            <div className="p-1 rounded-lg bg-blue-50 text-blue-500 group-hover:scale-110 transition-transform">
                              <PiggyBank className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-slate-800 font-display font-black text-sm mt-1.5">
                            R$ 0,00
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-1.5">
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="w-[0%] h-full bg-blue-500 rounded-full"></div>
                          </div>
                          <div className="text-[8px] text-slate-400 font-bold mt-1 uppercase tracking-wide leading-none">
                            aportado este mês
                          </div>
                        </div>
                      </div>

                      {/* Balance Ratio card */}
                      <div className="bg-white border border-slate-100 p-4.5 rounded-3xl shadow-[0_4px_16px_-4px_rgba(249,115,22,0.03)] relative overflow-hidden flex flex-col justify-between h-[115px] hover:shadow-[0_8px_24px_-4px_rgba(249,115,22,0.06)] hover:-translate-y-0.5 hover:bg-white transition-all duration-300 group">
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-orange-500" />
                        <div>
                          <div className="flex justify-between items-center text-slate-400 text-[9px] font-bold tracking-wider uppercase">
                            <span>TAXA DE SALDO</span>
                            <div className="p-1 rounded-lg bg-orange-50 text-orange-500 group-hover:scale-110 transition-transform">
                              <Percent className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-slate-800 font-display font-black text-sm mt-1.5">
                            -56,56%
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-1.5">
                          <div className="text-[8px] text-rose-600 font-extrabold uppercase tracking-wide leading-none">
                            Déficit: -R$ {(totalExpense - totalIncome).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Assistant Prompter (Completely Integrated at the Top of Home) */}
                  <div className="space-y-3">
                    <form 
                      onSubmit={(e) => handleSendChat(e)}
                      className="flex items-center gap-2.5 bg-white border border-slate-200/80 rounded-2xl pl-4 pr-1.5 py-1.5 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.02)] focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all"
                    >
                      <Sparkles className="w-4.5 h-4.5 text-blue-500 fill-blue-500/15 shrink-0" />
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Peça à IA para analisar seu painel ou 'Como economizar?'"
                        className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none min-w-0 font-semibold"
                      />
                      <button
                        type="submit"
                        aria-label="Reconfigurar painel"
                        className="h-9 px-3.5 rounded-xl bg-blue-600 text-white flex items-center justify-center gap-1.5 shrink-0 active:scale-95 hover:bg-blue-700 transition-all cursor-pointer shadow-sm text-[10px] font-bold"
                      >
                        <span>Analisar</span>
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>

                    {/* Horizontal Scroll Suggestions */}
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      {[
                        "Acompanhamento diário",
                        "Resumo do mês",
                        "Como economizar?",
                        "Dicas para Corolla",
                        "Previsão de gastos"
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => handleSendChat(undefined, suggestion)}
                          className={`shrink-0 border text-[10px] font-extrabold px-3.5 py-2 rounded-full whitespace-nowrap active:scale-95 transition-all cursor-pointer shadow-[0_2px_6px_-1px_rgba(0,0,0,0.01)] ${
                            activeQueryText === suggestion 
                              ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-xs' 
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Narrative Workspace Card */}
                  {!isCurrentActivePinned && (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: -15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ type: "spring", stiffness: 280, damping: 26 }}
                      className="bg-white border border-slate-100 p-5.5 rounded-3xl shadow-[0_4px_20px_-4px_rgba(148,163,184,0.06)] space-y-4 relative"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-black text-[11px] text-slate-850 uppercase tracking-widest">
                            {activeQueryText ? `"${activeQueryText}"` : 'Análise da IA'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const isPinned = pinnedAnalysis && pinnedAnalysis.text === activeReportText;
                              if (isPinned) {
                                setPinnedAnalysis(null);
                              } else {
                                const currentHash = `exp:${expenses.length}_${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}|inc:${incomes.length}_${incomes.reduce((s, i) => s + i.amount, 0).toFixed(2)}`;
                                setPinnedAnalysis({
                                  text: activeReportText,
                                  chartData: activeChartData,
                                  queryText: activeQueryText || 'Relatório Consolidado',
                                  dataHash: currentHash
                                });
                              }
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-50 transition-all cursor-pointer"
                            title={pinnedAnalysis && pinnedAnalysis.text === activeReportText ? "Desafixar esta análise" : "Fixar esta análise"}
                          >
                            <Pin className={`w-3.5 h-3.5 ${pinnedAnalysis && pinnedAnalysis.text === activeReportText ? 'text-blue-500 fill-blue-500/15' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {isAiTyping ? (
                        /* Shimmering Dynamic Builder Loader */
                        <div className="space-y-3 py-2 animate-pulse">
                          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                            <span>IA recalculando métricas e estruturando visualizações...</span>
                          </div>
                          <div className="h-4 bg-slate-100 rounded-lg w-full" />
                          <div className="h-4 bg-slate-100 rounded-lg w-11/12" />
                          <div className="h-4 bg-slate-100 rounded-lg w-4/5" />
                        </div>
                      ) : (
                        /* Fully integrated insight text styled elegantly, not like a chat bubble */
                        <div className="text-slate-700">
                          <BeautifulMarkdown text={activeReportText} />
                        </div>
                      )}

                      {/* DYNAMIC CHART: Completely integrated in the AI Workspace */}
                      {!isAiTyping && (
                        <div className="pt-2">
                          <InteractiveAIChart 
                            chartData={activeChartData} 
                            expenses={expenses}
                            onBarClick={(item) => {
                              setChatInput(`Como economizar nos gastos de ${item.name}?`);
                            }}
                          />
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Pinned AI Analysis Card */}
                  {pinnedAnalysis && (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 15 }}
                      transition={{ type: "spring", stiffness: 280, damping: 26 }}
                      className="bg-white border border-slate-100 p-5.5 rounded-3xl shadow-[0_4px_20px_-4px_rgba(148,163,184,0.06)] space-y-4 relative"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-black text-[11px] text-slate-850 uppercase tracking-widest">
                            {pinnedAnalysis.queryText ? `"${pinnedAnalysis.queryText}"` : 'Análise da IA'}
                          </span>
                        </div>

                        {/* Minimalist and discrete actions */}
                        <div className="flex items-center gap-1.5">
                          {(hasNewDataForPinned || isUpdatingPinned) && (
                            <button
                              onClick={handleUpdatePinnedAnalysis}
                              disabled={isUpdatingPinned}
                              className={`px-2 py-0.5 rounded-lg hover:bg-slate-50/80 transition-all cursor-pointer flex items-center gap-1.5 border border-slate-100/80 bg-slate-50/30 ${
                                isUpdatingPinned ? 'text-blue-500 opacity-60 pointer-events-none' : 'text-slate-400 hover:text-slate-600'
                              }`}
                              title="Novos lançamentos detectados! Toque para atualizar a análise."
                            >
                              {!isUpdatingPinned && <span className="relative flex h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                              <RefreshCw className={`w-2.5 h-2.5 ${isUpdatingPinned ? 'animate-spin text-blue-500' : ''}`} />
                              <span className="text-[7.5px] font-black uppercase tracking-widest">Atualizar</span>
                            </button>
                          )}
                          <button
                            onClick={() => setPinnedAnalysis(null)}
                            className="p-1 text-slate-400 hover:text-slate-650 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                            title="Desafixar esta análise"
                          >
                            <Pin className="w-3.5 h-3.5 fill-slate-400/25 text-slate-400" />
                          </button>
                        </div>
                      </div>

                      {/* Loading & feedback status */}
                      {(isUpdatingPinned || pinnedUpdateFeedback) && (
                        <div className="pt-0.5">
                          {isUpdatingPinned && (
                            <div className="flex items-center gap-2 text-blue-600 font-extrabold text-[9px] uppercase tracking-wider bg-blue-50/70 p-2.5 rounded-2xl border border-blue-100">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>IA recalculando valores e análise de seu prompt...</span>
                            </div>
                          )}
                          
                          {pinnedUpdateFeedback && !isUpdatingPinned && (
                            <div className={`flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wider p-2.5 rounded-2xl border ${
                              pinnedUpdateFeedback.includes('Nenhuma alteração') 
                                ? 'bg-amber-50/70 text-amber-700 border-amber-100' 
                                : 'bg-emerald-50/70 text-emerald-700 border-emerald-100'
                            }`}>
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>{pinnedUpdateFeedback}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Summarized/Organized Insights list */}
                      <div className="text-slate-700">
                        <BeautifulMarkdown text={pinnedAnalysis.text} />
                      </div>

                      {/* CHART INSIDE PINNED CARD */}
                      {pinnedAnalysis.chartData && pinnedAnalysis.chartData.length > 0 && (
                        <div className="pt-2">
                          <InteractiveAIChart 
                            chartData={pinnedAnalysis.chartData} 
                            expenses={expenses}
                            onBarClick={(item) => {
                              setChatInput(`Como economizar nos gastos de ${item.name}?`);
                            }}
                          />
                        </div>
                      )}
                    </motion.div>
                  )}



                  {/* Card de Gasto Disponível (Simplificado e Organizado) */}
                  <div className="bg-white border border-slate-100 p-5.5 rounded-3xl shadow-[0_4px_20px_-4px_rgba(148,163,184,0.06)] space-y-4 relative">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display font-black text-xs text-slate-800 uppercase tracking-wider">
                          Gasto Disponível
                        </h3>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-wide">
                          Limite diário e mensal baseado em sua renda
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {/* Compact Segmented Control */}
                        <div className="bg-slate-100/70 p-0.5 rounded-xl flex border border-slate-200/40 gap-0.5">
                          <button
                            onClick={() => setIncomeSource('atual')}
                            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold transition-all cursor-pointer flex flex-col items-center min-w-[70px] ${
                              incomeSource === 'atual' 
                                ? 'bg-white text-slate-850 shadow-sm border border-slate-200/50' 
                                : 'text-slate-450 hover:text-slate-650'
                            }`}
                          >
                            <span className="uppercase tracking-wider">Renda Real</span>
                            <span className="text-[8px] opacity-75 font-mono">R$ {totalIncome.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                          </button>
                          
                          <button
                            onClick={() => setIncomeSource('projetada')}
                            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold transition-all cursor-pointer flex flex-col items-center min-w-[70px] ${
                              incomeSource === 'projetada' 
                                ? 'bg-white text-slate-850 shadow-sm border border-slate-200/50' 
                                : 'text-slate-450 hover:text-slate-650'
                            }`}
                          >
                            <span className="uppercase tracking-wider">Projetada</span>
                            <span className="text-[8px] opacity-75 font-mono">R$ 2.500</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Simplified and Elegant 2-Column Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      {/* Column 1: Diário */}
                      <div className="bg-slate-50/55 p-4 rounded-2xl border border-slate-100/50 space-y-3.5">
                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5">
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest block">
                              DISPONÍVEL HOJE
                            </span>
                            <span className={`text-xl font-display font-black tracking-tight block ${dailyRemainingVal >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                              R$ {dailyRemainingVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className={`p-1.5 rounded-xl ${dailyRemainingVal >= 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                            <Calendar className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] text-slate-450 font-extrabold uppercase tracking-wider">
                            <span>Gasto Hoje: R$ {spentToday.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="text-slate-400">Meta: R$ {dailyLimitVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200/40 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${dailyRemainingVal >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                              style={{ width: `${Math.min(Math.max((spentToday / dailyLimitVal) * 100, 0), 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Column 2: Mensal */}
                      <div className="bg-slate-50/55 p-4 rounded-2xl border border-slate-100/50 space-y-3.5">
                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5">
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest block">
                              DISPONÍVEL NO MÊS
                            </span>
                            <span className={`text-xl font-display font-black tracking-tight block ${monthlyRemainingVal >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                              R$ {monthlyRemainingVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className={`p-1.5 rounded-xl ${monthlyRemainingVal >= 0 ? 'bg-blue-50 text-blue-500' : 'bg-rose-50 text-rose-500'}`}>
                            <PiggyBank className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] text-slate-450 font-extrabold uppercase tracking-wider">
                            <span>Total Gasto: R$ {totalExpense.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                            <span className="text-slate-400">Orçamento: R$ {selectedIncomeVal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200/40 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${monthlyRemainingVal >= 0 ? 'bg-blue-500' : 'bg-rose-500'}`} 
                              style={{ width: `${Math.min(Math.max((totalExpense / selectedIncomeVal) * 100, 0), 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Integrated Footnote Caption (Very clean, no heavy borders) */}
                    <div className={`p-2.5 rounded-xl flex items-center gap-2 ${
                      dailyRemainingVal >= 0 && monthlyRemainingVal >= 0
                        ? 'bg-emerald-50/50 text-emerald-800'
                        : monthlyRemainingVal < 0
                        ? 'bg-rose-50/50 text-rose-800'
                        : 'bg-amber-50/50 text-amber-800'
                    }`}>
                      <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${
                        dailyRemainingVal >= 0 && monthlyRemainingVal >= 0 ? 'text-emerald-500' :
                        monthlyRemainingVal < 0 ? 'text-rose-500' : 'text-amber-500'
                      }`} />
                      <p className="text-[9px] leading-tight font-bold uppercase tracking-wide">
                        {dailyRemainingVal >= 0 && monthlyRemainingVal >= 0 
                          ? `Excelente: R$ ${dailyRemainingVal.toFixed(2)} livres hoje. Saldo do mês positivo em R$ ${monthlyRemainingVal.toFixed(2)}.`
                          : monthlyRemainingVal < 0
                          ? `Atenção: Despesas superam a renda. Ajuste seu orçamento em R$ ${Math.abs(monthlyRemainingVal).toFixed(2)}.`
                          : `Muito bom: Economizou hoje! Saldo mensal saudável com R$ ${monthlyRemainingVal.toFixed(2)} de margem.`}
                      </p>
                    </div>
                  </div>


                </motion.div>
              );
            })()}
          </AnimatePresence>
        </main>





      </div>
    </div>
  );
}
