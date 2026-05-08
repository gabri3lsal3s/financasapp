import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, PieChart, FileText, Calendar, ChevronDown, Check } from 'lucide-react';
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

export default function ClientDashboard() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'reports'>('portfolio');
  const [selectedMonth, setSelectedMonth] = useState('live');
  const [historyReports, setHistoryReports] = useState<any[]>([]);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

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
          <div className="flex flex-col sm:flex-row items-center gap-2 md:gap-3 w-full sm:w-auto">
             {/* Linha 1: Voltar + Abas (Ícones no Mobile) */}
             <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                <Button onClick={() => navigate('/admin/consulting')} variant="ghost" size="sm" className="h-9 px-2 flex items-center gap-2">
                   <ArrowLeft size={18} />
                   <span className="hidden sm:inline">Voltar</span>
                </Button>

                <div className="flex bg-primary p-0.5 md:p-1 rounded-xl border border-primary shadow-sm">
                   <button
                     onClick={() => setActiveTab('portfolio')}
                     className={`flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                       activeTab === 'portfolio' 
                         ? 'bg-primary text-primary shadow-sm border border-primary/20' 
                         : 'text-secondary opacity-60 hover:text-primary hover:opacity-100'
                     }`}
                     title="Portfólio"
                   >
                     <PieChart size={16} />
                     <span className="hidden sm:inline">Portfólio</span>
                   </button>
                   <button
                     onClick={() => setActiveTab('reports')}
                     className={`flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                       activeTab === 'reports' 
                         ? 'bg-primary text-primary shadow-sm border border-primary/20' 
                         : 'text-secondary opacity-60 hover:text-primary hover:opacity-100'
                     }`}
                     title="Relatórios"
                   >
                     <FileText size={16} />
                     <span className="hidden sm:inline">Relatórios</span>
                   </button>
                </div>
             </div>

             {/* Linha 2: Seletor de Posição (Customizado) */}
             <div className="relative w-full sm:w-auto">
               <button 
                 onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
                 className="flex items-center justify-between bg-primary rounded-xl border border-primary px-3 py-1 h-9 md:h-[42px] shadow-sm w-full sm:w-auto transition-all hover:border-primary/50 group"
               >
                 <div className="flex items-center">
                   <Calendar size={14} className="text-secondary mr-2 group-hover:text-primary transition-colors" />
                   <span className="text-primary text-[10px] uppercase tracking-widest font-black truncate max-w-[150px] sm:max-w-none">
                     {selectedMonth === 'live' 
                        ? 'Posição Atual (Live)' 
                        : historyReports.find(r => r.id === selectedMonth)?.month.split('-').reverse().join('/') + ' (Arquivado)'
                     }
                   </span>
                 </div>
                 <ChevronDown size={14} className={`text-secondary ml-2 transition-transform duration-300 ${isMonthPickerOpen ? 'rotate-180' : ''}`} />
               </button>

               {isMonthPickerOpen && (
                 <>
                   {/* Backdrop para fechar ao clicar fora */}
                   <div 
                     className="fixed inset-0 z-[40] bg-transparent" 
                     onClick={() => setIsMonthPickerOpen(false)}
                   />
                   
                   <div className="absolute top-full left-0 right-0 sm:left-auto sm:right-0 mt-2 min-w-full sm:min-w-[220px] bg-primary border border-primary rounded-2xl shadow-2xl z-[50] overflow-hidden animate-page-enter">
                      <div className="p-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                         <button
                           onClick={() => { setSelectedMonth('live'); setIsMonthPickerOpen(false); }}
                           className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                             selectedMonth === 'live' 
                               ? 'bg-secondary text-primary' 
                               : 'text-secondary hover:bg-secondary/50 hover:text-primary'
                           }`}
                         >
                           <div className="flex items-center gap-2">
                             <div className={`w-1.5 h-1.5 rounded-full ${selectedMonth === 'live' ? 'bg-income' : 'bg-transparent'}`} />
                             Posição Atual (Live)
                           </div>
                           {selectedMonth === 'live' && <Check size={12} className="text-income" />}
                         </button>

                         {historyReports.map(r => (
                           <button
                             key={r.id}
                             onClick={() => { setSelectedMonth(r.id); setIsMonthPickerOpen(false); }}
                             className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                               selectedMonth === r.id 
                                 ? 'bg-secondary text-primary' 
                                 : 'text-secondary hover:bg-secondary/50 hover:text-primary'
                             }`}
                           >
                             <div className="flex items-center gap-2">
                               <div className={`w-1.5 h-1.5 rounded-full ${selectedMonth === r.id ? 'bg-primary' : 'bg-transparent'}`} />
                               {r.month.split('-').reverse().join('/')} (Arquivado)
                             </div>
                             {selectedMonth === r.id && <Check size={12} className="text-primary" />}
                           </button>
                         ))}
                      </div>
                   </div>
                 </>
               )}
             </div>
          </div>
        }
      />
      {/* Área de Renderização das Abas */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'portfolio' && clientId && (
          <PortfolioManagement 
            clientId={clientId} 
            selectedMonth={selectedMonth} 
            onReportArchived={fetchHistoryReports}
            hideHeader={true} 
          />
        )}
        
        {activeTab === 'reports' && clientId && (
          <ConsultingReports 
            clientId={clientId} 
            selectedMonth={selectedMonth} 
            onReportArchived={fetchHistoryReports} 
            onMonthChange={(month) => setSelectedMonth(month)}
            hideHeader={true} 
          />
        )}
      </div>
    </div>
  );
}
