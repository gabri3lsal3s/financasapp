import { Expense, Income, CreditCard, ChatMessage } from './types';

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    title: 'Vivo Easy (Chip pessoal)',
    category: 'Assinaturas',
    amount: 30.00,
    date: '30/06',
    color: 'bg-emerald-500',
    group: 'PARCELADAS'
  },
  {
    id: 'exp-2',
    title: 'Seguro do Corolla',
    category: 'Carro',
    amount: 222.34,
    date: '10/06',
    color: 'bg-emerald-500',
    group: 'PARCELADAS'
  },
  {
    id: 'exp-3',
    title: 'Livro: Terapia Centrada na Pessoa',
    category: 'Capex',
    amount: 39.97,
    date: '09/06',
    color: 'bg-indigo-500',
    group: 'PARCELADAS'
  },
  {
    id: 'exp-4',
    title: 'Refrigerante',
    category: 'Supermercado',
    amount: 10.00,
    date: '29/06',
    color: 'bg-orange-500',
    group: 'DESPESAS DO MÊS'
  },
  {
    id: 'exp-5',
    title: 'Milho para pipoca',
    category: 'Supermercado',
    amount: 11.97,
    date: '29/06',
    color: 'bg-orange-500',
    group: 'DESPESAS DO MÊS'
  },
  {
    id: 'exp-6',
    title: 'Rolê no Ville',
    category: 'Lazer',
    amount: 156.46,
    date: '28/06',
    color: 'bg-blue-500',
    group: 'DESPESAS DO MÊS'
  },
  {
    id: 'exp-7',
    title: 'Água',
    category: 'Compras',
    amount: 5.97,
    date: '26/06',
    color: 'bg-cyan-500',
    group: 'DESPESAS DO MÊS'
  },
  {
    id: 'exp-8',
    title: 'Transporte',
    category: 'Transporte',
    amount: 11.00,
    date: '26/06',
    color: 'bg-emerald-500',
    group: 'DESPESAS DO MÊS'
  }
];

export const INITIAL_INCOMES: Income[] = [
  {
    id: 'inc-1',
    title: 'Blablacar',
    category: 'Táxi Free-lancer',
    amount: 47.00,
    date: '19/06',
    color: 'bg-indigo-500'
  },
  {
    id: 'inc-2',
    title: 'Blablacar',
    category: 'Táxi Free-lancer',
    amount: 48.00,
    date: '18/06',
    color: 'bg-indigo-500'
  },
  {
    id: 'inc-3',
    title: 'Cashback Cartão Rico',
    category: 'Reembolso',
    amount: 16.15,
    date: '12/06',
    color: 'bg-cyan-500'
  },
  {
    id: 'inc-4',
    title: 'Bolsa Mãe',
    category: 'Corte de Gastos',
    amount: 900.00,
    date: '11/06',
    color: 'bg-emerald-500'
  },
  {
    id: 'inc-5',
    title: 'Monitoria',
    category: 'Monitoria',
    amount: 227.70,
    date: '10/06',
    color: 'bg-orange-500'
  }
];

export const CREDIT_CARDS: CreditCard[] = [
  {
    id: 'card-1',
    name: 'Rico',
    brand: 'Visa',
    closingDay: 7,
    dueDay: 15,
    currentInvoice: 2270.90,
    color: '#E11D48' // rose-600
  }
];

export const MOCK_CHATS: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'ai',
    text: 'Olá! Sou seu Assistente de IA Financeira. 🌸\nComo posso ajudar com suas finanças hoje? Notei que você gastou 15% a menos em Lazer esta semana!',
    timestamp: '16:20'
  },
  {
    id: 'msg-2',
    sender: 'user',
    text: 'Como foram meus gastos nos últimos 4 dias?',
    timestamp: '16:21'
  },
  {
    id: 'msg-3',
    sender: 'ai',
    text: 'Aqui está o comparativo dos seus últimos dias. Houve um pico na quarta-feira devido ao "Rolê no Ville":',
    timestamp: '16:21',
    chartData: [
      { name: 'SEG', value: 30, active: false },
      { name: 'TER', value: 55, active: false },
      { name: 'QUA', value: 156.46, active: true },
      { name: 'HOJE', value: 30, active: false }
    ]
  }
];
