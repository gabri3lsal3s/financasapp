import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, PieChart, FileText, Calendar } from 'lucide-react';
import Button from '@/components/Button';
import Loader from '@/components/Loader';
import PortfolioManagement from './PortfolioManagement';
import ConsultingReports from './ConsultingReports';

interface Client {
  id: string;
  name: string;
  email: string;
}

interface Report {
  id: string;
  month: string;
}

export default function ClientDashboard() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'reports'>('portfolio');
  const [selectedMonth, setSelectedMonth] = useState<string>('live');
  const [historyReports, setHistoryReports] = useState<Report[]>([]);

  useEffect(() => {
    if (clientId) {
      fetchClientData();
      fetchHistoryReports();
    }
  }, [clientId]);

  const fetchClientData = async () => {
    try {
      const { data, error } = await supabase
        .from('consulting_clients')
        .select('id, name, email')
        .eq('id', clientId)
        .single();
        
      if (error) throw error;
      setClient(data);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar os dados do cliente');
      navigate('/admin/consulting');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryReports = async () => {
    try {
      const { data, error } = await supabase
        .from('consulting_reports')
        .select('id, month, total_balance')
        .eq('client_id', clientId)
        .order('month', { ascending: false });
      
      if (error) throw error;
      setHistoryReports(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <Loader text="Carregando cliente..." className="min-h-[50vh]" />;
  }

  if (!client) return null;

  return (
    <div className="space-y-6">
      {/* Header Unificado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            className="p-2 bg-secondary/20 hover:bg-secondary/40 text-primary border-none"
            onClick={() => navigate('/admin/consulting')}
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight">
              {client.name}
            </h1>
            <p className="text-secondary font-medium">Gestão Integrada</p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Seletor de Mês */}
          <div className="flex items-center bg-black/20 rounded-xl border border-white/5 px-3 py-1.5 h-[42px]">
            <Calendar size={16} className="text-secondary mr-2" />
            <select
              className="bg-transparent text-primary text-sm font-bold focus:outline-none appearance-none cursor-pointer pr-4"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="live" className="bg-[#111] text-primary">Posição Atual (Live)</option>
              {historyReports.map(r => (
                <option key={r.id} value={r.id} className="bg-[#111] text-primary">
                  {r.month.split('-').reverse().join('/')} (Arquivado)
                </option>
              ))}
            </select>
          </div>

          {/* Navegação por Abas */}
          <div className="flex bg-black/20 p-1.5 rounded-xl border border-white/5 w-fit">
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'portfolio' 
                ? 'bg-primary text-white shadow-lg' 
                : 'text-secondary hover:text-primary hover:bg-white/5'
            }`}
          >
            <PieChart size={16} />
            <span className="hidden sm:inline">Portfólio</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'reports' 
                ? 'bg-primary text-white shadow-lg' 
                : 'text-secondary hover:text-primary hover:bg-white/5'
            }`}
          >
            <FileText size={16} />
            <span className="hidden sm:inline">Relatórios</span>
          </button>
        </div>
        </div>
      </div>
      {/* Área de Renderização das Abas */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'portfolio' && clientId && (
          <PortfolioManagement clientId={clientId} selectedMonth={selectedMonth} />
        )}
        
        {activeTab === 'reports' && clientId && (
          <ConsultingReports clientId={clientId} selectedMonth={selectedMonth} onReportArchived={fetchHistoryReports} />
        )}
      </div>
    </div>
  );
}
