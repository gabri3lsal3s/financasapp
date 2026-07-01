export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number; // Stored as a float number
  date: string; // e.g. "30/06"
  color: string; // Tailwind class e.g. "bg-green-500" or hex code
  group: 'PARCELADAS' | 'DESPESAS DO MÊS';
}

export interface Income {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string; // e.g. "19/06"
  color: string;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  icon: string;
}

export interface CreditCard {
  id: string;
  name: string;
  brand: string;
  closingDay: number;
  dueDay: number;
  currentInvoice: number;
  color: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  chartData?: Array<{ name: string; value: number; active?: boolean }>;
}
