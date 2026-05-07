import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, PieChart, FileText, Calendar } from 'lucide-react';
import Button from '@/components/Button';
import Loader from '@/components/Loader';
import PageHeader from '@/components/PageHeader';
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
      <PageHeader 
        title={client.name}
        subtitle="Gestão Integrada de Consultoria"
        action={
          <div className="flex flex-col md:flex-row items-center gap-3">
             {/* Seletor de Mês */}
             <div className="flex items-center bg-secondary/50 rounded-xl border border-primary px-3 py-1.5 h-[42px] shadow-sm">
               <Calendar size={16} className="text-secondary mr-2" />
               <select
                 className="bg-transparent text-primary text-[10px] uppercase tracking-widest font-black focus:outline-none appearance-none cursor-pointer pr-4"
                 value={selectedMonth}
                 onChange={(e) => setSelectedMonth(e.target.value)}
               >
                 <option value="live" className="bg-primary text-primary">Posição Atual (Live)</option>
                 {historyReports.map(r => (
                   <option key={r.id} value={r.id} className="bg-primary text-primary">
                     {r.month.split('-').reverse().join('/')} (Arquivado)
                   </option>
                 ))}
               </select>
             </div>

             {/* Navegação por Abas */}
             <div className="flex bg-secondary/50 p-1 rounded-xl border border-primary w-fit shadow-sm">
               <button
                 onClick={() => setActiveTab('portfolio')}
                 className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                   activeTab === 'portfolio' 
                     ? 'bg-primary text-primary shadow-md border border-primary' 
                     : 'text-secondary opacity-60 hover:text-primary hover:opacity-100'
                 }`}
               >
                 <PieChart size={14} />
                 <span>Portfólio</span>
               </button>
               <button
                 onClick={() => setActiveTab('reports')}
                 className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                   activeTab === 'reports' 
                     ? 'bg-primary text-primary shadow-md border border-primary' 
                     : 'text-secondary opacity-60 hover:text-primary hover:opacity-100'
                 }`}
               >
                 <FileText size={14} />
                 <span>Relatórios</span>
               </button>
             </div>

             <Button onClick={() => navigate('/admin/consulting')} variant="ghost" size="sm" className="hidden md:flex items-center gap-2">
                <ArrowLeft size={16} /> Voltar
             </Button>
          </div>
        }
      />
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
