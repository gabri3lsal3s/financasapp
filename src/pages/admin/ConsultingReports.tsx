import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Download, Loader2, BarChart2, Save, Calculator, Trash2, FileText, ArrowRight, TrendingUp, Edit2 } from 'lucide-react';
import Button from '@/components/Button';
import { Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import Select from '@/components/Select';
import Input from '@/components/Input';
import Loader from '@/components/Loader';
import MonthPickerModal from '@/components/MonthPickerModal';
import { formatCurrency, formatMonthShort, addMonths, getCurrentMonthString } from '@/utils/format';
import { toast } from 'react-hot-toast';

interface Client { id: string; name: string; }

interface PortfolioSector {
  id: string; client_id: string; macro_category: string; sector_name: string; target_percentage: number;
}

interface PortfolioAsset {
  id?: string; category: string; asset_name: string; current_balance: number;
  sector_id?: string; applied_amount?: number; custom_rate?: string; maturity_date?: string; variation_month?: string; variation_total?: string;
}

interface ConsultingReport { id: string; month: string; total_balance: number; notes: string; created_at: string; }

// Constants moved or no longer needed in this scope


interface TableARow {
  label: string;
  rentMês: string;
  benchMês: string;
  rentInício: string;
  benchInício: string;
  yield: string;
}

interface PlanningRow {
  acao: string;
  ativo: string;
  justificativa: string;
}

export default function ConsultingReports() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  
  const [liveSectors, setLiveSectors] = useState<PortfolioSector[]>([]);
  const [liveAssets, setLiveAssets] = useState<PortfolioAsset[]>([]);
  const [liveTotal, setLiveTotal] = useState(0);

  const [historyReports, setHistoryReports] = useState<ConsultingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMonth, setSavingMonth] = useState(false);

  // PDF Engine State
  const [activeReportMode, setActiveReportMode] = useState<'live' | string | null>(null); 
  const [activeReportData, setActiveReportData] = useState<ConsultingReport | null>(null);
  const [activePdfAssets, setActivePdfAssets] = useState<PortfolioAsset[]>([]);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [notes, setNotes] = useState('');

  // Table A Editing State
  const [tableA, setTableA] = useState<Record<string, TableARow>>({});
  const [feeRate, setFeeRate] = useState('0,1');
  const [planning, setPlanning] = useState<PlanningRow[]>([
     { acao: 'Aportar', ativo: 'FIIs / Exterior', justificativa: 'Ativos sub-alocados em relação ao alvo.' },
     { acao: 'Aguardar', ativo: 'Ações Nacionais', justificativa: 'Exposição acima do limite; aguardar diluição.' }
  ]);

  // History Management State
  const [showEditDateModal, setShowEditDateModal] = useState(false);
  const [reportToEdit, setReportToEdit] = useState<ConsultingReport | null>(null);
  const [newReportMonth, setNewReportMonth] = useState('');

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchClients(); }, []);
  useEffect(() => {
    if (selectedClientId) { fetchClientData(selectedClientId); setActiveReportMode(null); }
    else { setLiveAssets([]); setHistoryReports([]); setLiveSectors([]); }
  }, [selectedClientId]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase.from('consulting_clients').select('id, name').order('name');
      if (error) throw error;
      setClients(data || []);
      if (data && data.length > 0) setSelectedClientId(data[0].id);
    } catch (err) {} finally { setLoading(false); }
  };

  const fetchClientData = async (clientId: string) => {
    setLoading(true);
    try {
      const { data: secData } = await supabase.from('portfolio_sectors').select('*').eq('client_id', clientId);
      setLiveSectors(secData || []);

      const { data: assetsData } = await supabase.from('portfolio_assets').select('*').eq('client_id', clientId);
      const live = assetsData || [];
      setLiveAssets(live);
      setLiveTotal(live.reduce((acc, a) => acc + a.current_balance, 0));

      const { data: reportsData } = await supabase.from('consulting_reports').select('*').eq('client_id', clientId).order('month', { ascending: true });
      const history = (reportsData || []) as ConsultingReport[];
      setHistoryReports(history);
      
      // Auto-archive check
      checkAutoArchive(clientId, history, live);
    } catch (err) {} finally { setLoading(false); }
  };

  const checkAutoArchive = async (clientId: string, history: ConsultingReport[], assets: PortfolioAsset[]) => {
     if (assets.length === 0) return;
     
     const currentMonth = getCurrentMonthString();
     const prevMonth = addMonths(currentMonth, -1);
     
     // Check if prev month is missing in history
     const exists = history.some(r => r.month === prevMonth);
     if (!exists) {
        setSavingMonth(true);
        try {
           const total = assets.reduce((sum, a) => sum + a.current_balance, 0);
           const { data: newReport, error } = await supabase.from('consulting_reports').insert([{ 
              client_id: clientId, 
              month: prevMonth, 
              total_balance: total, 
              notes: "Arquivamento automático gerado pelo sistema." 
           }]).select().single();
           
           if (!error && newReport) {
              const frozenAssets = assets.map(a => ({
                 report_id: newReport.id, asset_name: a.asset_name, category: a.category, current_balance: a.current_balance,
                 sector_id: a.sector_id, applied_amount: a.applied_amount, custom_rate: a.custom_rate, maturity_date: a.maturity_date, variation_month: a.variation_month, variation_total: a.variation_total
              }));
              await supabase.from('consulting_report_assets').insert(frozenAssets);
              
              // Refresh history
              const { data: updatedHistory } = await supabase.from('consulting_reports').select('*').eq('client_id', clientId).order('month', { ascending: true });
              setHistoryReports(updatedHistory || []);
              toast.success(`Mês de ${prevMonth} arquivado automaticamente.`);
           }
        } catch (e) {} finally { setSavingMonth(false); }
     }
  };

  const initTableA = (assetsArray: PortfolioAsset[]) => {
     const macros = ['Consolidada', ...new Set(assetsArray.map(a => {
        const s = liveSectors.find(ls => ls.id === a.sector_id);
        return s ? s.macro_category : a.category;
     }))];
     
     const newTable: Record<string, TableARow> = {};
     macros.forEach(m => {
         let bench = '-';
         if (m === 'Consolidada') bench = 'CDI';
         else if (m === 'Ações Nacionais') bench = 'IBOV';
         else if (m === 'Renda Fixa') bench = 'CDI';
         else if (m === 'Fundo Imobiliário (FII)') bench = 'IFIX';
         else if (m === 'Exterior (ETFs)') bench = 'S&P500';

         newTable[m] = {
            label: m,
            rentMês: '-',
            benchMês: bench,
            rentInício: '-',
            benchInício: '-',
            yield: '-'
         }
      });
      setTableA(newTable);
   };

  const selectedClientName = useMemo(() => clients.find(c => c.id === selectedClientId)?.name || '', [clients, selectedClientId]);

  const handleSaveMonth = async () => {
     if (!selectedClientId) return;
     if (liveAssets.length === 0) return alert("Não há ativos.");
     const monthStr = new Date().toISOString().slice(0, 7);
     if (historyReports.some(r => r.month === monthStr)) {
         if(!window.confirm(`Deseja substituir os dados de ${monthStr}?`)) return;
     }

     setSavingMonth(true);
     try {
        const { data: newReport } = await supabase.from('consulting_reports').insert([{ client_id: selectedClientId, month: monthStr, total_balance: liveTotal, notes: "" }]).select().single();
        const frozenAssets = liveAssets.map(a => ({
           report_id: newReport.id, asset_name: a.asset_name, category: a.category, current_balance: a.current_balance,
           sector_id: a.sector_id, applied_amount: a.applied_amount, custom_rate: a.custom_rate, maturity_date: a.maturity_date, variation_month: a.variation_month, variation_total: a.variation_total
        }));
        await supabase.from('consulting_report_assets').insert(frozenAssets);
        alert('Mês arquivado com sucesso!');
        fetchClientData(selectedClientId);
     } catch (err) {} finally { setSavingMonth(false); }
  };

   const handleUpdateHistoricalReport = async () => {
      if (!activeReportData || activeReportMode === 'live') return;
      setSavingMonth(true);
      try {
         // Update Metadata
         await supabase.from('consulting_reports').update({ 
            notes: notes 
         }).eq('id', activeReportData.id);

         // Note: Logic for updating frozen assets could be added here if needed, 
         // but usually notes and planning (tags) are the priority for corrections.
         
         toast.success("Histórico atualizado com sucesso");
         fetchClientData(selectedClientId);
      } catch (err) {
         toast.error("Erro ao atualizar histórico");
      } finally {
         setSavingMonth(false);
      }
   };

   const handleDeleteReport = async (reportId: string) => {
      if (!window.confirm("Tem certeza que deseja excluir este fechamento permanentemente?")) return;
      try {
          const { error } = await supabase.from('consulting_reports').delete().eq('id', reportId);
          if (error) throw error;
          toast.success("Fechamento removido");
          if (activeReportMode === reportId) setActiveReportMode(null);
          fetchClientData(selectedClientId);
      } catch (e) {
          toast.error("Erro ao excluir");
      }
   };

   const handleOpenEditModal = (report: ConsultingReport) => {
      setReportToEdit(report);
      setNewReportMonth(report.month);
      setShowEditDateModal(true);
   };

  const loadPdfEngineFor = async (mode: 'live' | string) => {
     setActiveReportMode(mode); setNotes('');
     if (mode === 'live') {
        const data = { id: 'live', month: new Date().toISOString().slice(0,7), total_balance: liveTotal, notes: '', created_at: new Date().toISOString() };
        setActiveReportData(data);
        setActivePdfAssets(liveAssets);
        initTableA(liveAssets);
     } else {
        const rep = historyReports.find(r => r.id === mode);
        if (rep) {
           setActiveReportData(rep); setNotes(rep.notes || '');
           const { data } = await supabase.from('consulting_report_assets').select('*').eq('report_id', rep.id);
           const assetsFromSnapshot = (data || []) as PortfolioAsset[];
           setActivePdfAssets(assetsFromSnapshot);
           initTableA(assetsFromSnapshot);
        }
     }
  };

   const comparisonData = useMemo(() => {
     if (!activeReportData) return null;
     const currentIndex = historyReports.findIndex(r => r.id === activeReportData.id);
     const prevReport = currentIndex > 0 ? historyReports[currentIndex - 1] : 
                        (activeReportMode === 'live' && historyReports.length > 0 ? historyReports[historyReports.length - 1] : null);
     
     if (!prevReport) return null;
     
     const diff = activeReportData.total_balance - prevReport.total_balance;
     const percent = (diff / prevReport.total_balance) * 100;
     
     return {
        prevBalance: prevReport.total_balance,
        diff,
        percent,
        prevMonth: prevReport.month,
        benchmarks: [
           { label: 'CDI', value: '—' },
           { label: 'IBOV', value: '—' },
           { label: 'S&P500', value: '—' },
           { label: 'IFIX', value: '—' }
        ]
     };
   }, [activeReportData, historyReports, activeReportMode]);

  const pdfRebalanceData = useMemo(() => {
     const res: Record<string, { sectorName: string, macro: string, currentBal: number, targetP: number, status: string, statusColor: string, assetsArr: any[] }> = {};
     activePdfAssets.forEach(a => {
        const secId = a.sector_id || 'orphan';
        if (!res[secId]) {
           const sObj = liveSectors.find(ls => ls.id === secId);
           res[secId] = {
              sectorName: sObj ? sObj.sector_name : 'Sem Setor Atribuído',
              macro: sObj ? sObj.macro_category : a.category,
              currentBal: 0,
              targetP: sObj ? sObj.target_percentage : 0,
              status: '', statusColor: '',
              assetsArr: []
           }
        }
        res[secId].currentBal += a.current_balance;
        res[secId].assetsArr.push(a);
     });

     const activeTotal = activePdfAssets.reduce((sum, a) => sum + a.current_balance, 0);
     Object.keys(res).forEach(k => {
        const currP = activeTotal > 0 ? res[k].currentBal / activeTotal : 0;
        const diff = currP - res[k].targetP;
        if (diff > 0.05) { res[k].status = 'Excesso Crítico'; res[k].statusColor = '#ef4444'; }
        else if (diff > 0.02) { res[k].status = 'Excesso'; res[k].statusColor = '#f97316'; }
        else if (diff < -0.05) { res[k].status = 'Prioridade de Aporte'; res[k].statusColor = '#10b981'; }
        else if (diff < -0.02) { res[k].status = 'Aporte Secundário'; res[k].statusColor = '#3b82f6'; }
        else { res[k].status = 'Enquadrado'; res[k].statusColor = '#9ca3af'; }
     });
     return res;
  }, [activePdfAssets, liveSectors]);

  const generatePDF = async () => {
    if (!reportRef.current) return;
    setGeneratingPDF(true);
    try {
      await new Promise(r => setTimeout(r, 600));
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Relatorio_${selectedClientName}_${activeReportData?.month}.pdf`);
    } catch (err) { alert("Erro ao gerar PDF"); } finally { setGeneratingPDF(false); }
  };

  const evolutionData = useMemo(() => {
     let data = historyReports.map(r => ({ month: formatMonthShort(r.month), Patrimônio: r.total_balance }));
     data.push({ month: 'Atual', Patrimônio: liveTotal });
     return data;
  }, [historyReports, liveTotal]);

  const updateTableA = (label: string, field: keyof TableARow, value: string) => {
     setTableA(prev => ({
        ...prev,
        [label]: { ...prev[label], [field]: value }
     }));
  };

  if (loading && !selectedClientId) return <div className="flex justify-center p-20"><Loader text="Sincronizando dados..." /></div>;

  return (
    <div>
      <PageHeader 
        title="Consultoria de Investimentos" 
        subtitle="Analise a evolução patrimonial e gere relatórios com o Método Cerrado" 
      />
      
      <div className="p-4 lg:p-6 space-y-6 animate-page-enter">
          {/* Top Row: Client & Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
             <Card className="p-6 flex flex-col justify-between bg-secondary/10 hover:border-primary/20 transition-all border-white/5 md:col-span-1">
                <Select 
                  label="Selecione o Cliente"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  options={clients.map(c => ({ value: c.id, label: c.name }))}
                />
                <div className="mt-6 flex flex-col gap-3">
                   <Button onClick={handleSaveMonth} disabled={savingMonth || !selectedClientId} variant="outline" className="w-full flex items-center justify-center gap-2 border-primary/20 hover:bg-primary/10 transition-all font-black text-xs">
                      {savingMonth ? <Loader2 size={14} className="animate-spin" /> : <Save size={14}/>}
                      Arquivar Mês Atual
                   </Button>
                </div>
             </Card>

             <Card className="p-6 bg-secondary/10 relative overflow-hidden group border-white/5 md:col-span-1 lg:col-span-3">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <TrendingUp size={100} className="text-primary"/>
                </div>
                <h3 className="text-sm font-semibold text-secondary flex items-center gap-2 mb-4">
                   <BarChart2 size={16} className="text-primary"/> Evolução do Patrimônio Gerido
                </h3>
                <div className="h-44 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={evolutionData}>
                         <defs>
                           <linearGradient id="colorPat" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4}/>
                             <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                           </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                         <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: 'var(--color-text-secondary)', fontSize: 10}} dy={10} />
                         <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`} tick={{fill: 'var(--color-text-secondary)', fontSize: 10}} dx={-10}/>
                         <Tooltip 
                            contentStyle={{backgroundColor: 'var(--color-primary)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)'}}
                            itemStyle={{color: 'var(--color-primary)', fontWeight: 'bold'}}
                            formatter={(v: number) => formatCurrency(v)} 
                         />
                         <Area type="monotone" dataKey="Patrimônio" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorPat)" />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
             {/* Left Column: History Sidebar */}
             <div className="lg:col-span-1 space-y-4">
                <h3 className="text-xs font-semibold text-secondary uppercase tracking-widest pl-1 opacity-60">Histórico de Fechamentos</h3>
                <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                     {/* Live State Card */}
                     <div 
                        onClick={() => loadPdfEngineFor('live')}
                        className={`p-4 rounded-xl border transition-all cursor-pointer group relative ${activeReportMode === 'live' ? 'border-primary/50 bg-primary/5 scale-[1.02]' : 'border-white/5 bg-secondary/5 hover:border-white/10 hover:lift-subtle'}`}
                     >
                        <div className="flex justify-between items-center mb-1">
                           <span className={`text-[10px] font-semibold uppercase tracking-wider ${activeReportMode === 'live' ? 'text-primary' : 'text-secondary opacity-50'}`}>Situação Atual</span>
                           <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/20">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></div>
                              <span className="text-[10px] font-semibold text-[#10b981] uppercase">Live</span>
                           </div>
                        </div>
                        <p className={`font-semibold text-lg tracking-tight transition-colors ${activeReportMode === 'live' ? 'text-primary' : 'text-secondary/80'}`}>Posição em Aberto</p>
                        <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                           <p className="text-sm font-bold text-primary">{formatCurrency(liveTotal)}</p>
                           <ArrowRight size={14} className={`transition-all ${activeReportMode === 'live' ? 'translate-x-1 text-primary' : 'text-secondary opacity-20'}`} />
                        </div>
                     </div>

                     {/* Historical Cards */}
                     {historyReports.map(r => (
                        <div 
                           key={r.id} onClick={() => loadPdfEngineFor(r.id)}
                           className={`p-4 rounded-xl border transition-all cursor-pointer group relative ${activeReportMode === r.id ? 'border-primary/50 bg-primary/5 scale-[1.02]' : 'border-white/5 bg-secondary/5 hover:border-white/10 hover:lift-subtle'}`}
                        >
                           <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                 onClick={(e) => { e.stopPropagation(); handleOpenEditModal(r); }}
                                 className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-secondary hover:text-primary transition-all"
                                 title="Editar data"
                              >
                                 <Edit2 size={12} />
                              </button>
                              <button 
                                 onClick={(e) => { e.stopPropagation(); handleDeleteReport(r.id); }}
                                 className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-secondary hover:text-red-500 transition-all"
                                 title="Excluir fechamento"
                              >
                                 <Trash2 size={12} />
                              </button>
                           </div>

                           <div className="flex justify-between items-center mb-1">
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${activeReportMode === r.id ? 'text-primary' : 'text-secondary opacity-50'}`}>Relatório Mensal</span>
                           </div>
                           <p className={`font-semibold text-lg tracking-tight transition-colors ${activeReportMode === r.id ? 'text-primary' : 'text-secondary/80'}`}>{r.month}</p>
                           <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                              <p className="text-sm font-bold text-primary">{formatCurrency(r.total_balance)}</p>
                              <ArrowRight size={14} className={`transition-all ${activeReportMode === r.id ? 'translate-x-1 text-primary' : 'text-secondary opacity-20'}`} />
                           </div>
                        </div>
                     ))}

                    {historyReports.length === 0 && (
                       <div className="text-center py-10 opacity-40">
                          <p className="text-xs font-black text-secondary uppercase italic">Nenhum registro</p>
                       </div>
                    )}
                </div>
             </div>

             {/* Right Column: Main Editor */}
             <div className="lg:col-span-3 space-y-6">
                {activeReportMode && activeReportData ? (
                   <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                         <div>
                            <h2 className="text-2xl font-bold text-primary tracking-tight">Editor de Relatório</h2>
                            <p className="text-secondary text-sm">Configurando emissão para <span className="text-primary font-semibold">{activeReportData.month}</span></p>
                         </div>
                         <div className="flex gap-3">
                            {activeReportMode !== 'live' && (
                               <Button onClick={handleUpdateHistoricalReport} disabled={savingMonth} variant="outline" className="flex items-center gap-2 border-primary/40">
                                  {savingMonth ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                  Salvar Histórico
                               </Button>
                            )}
                            <Button variant="primary" onClick={generatePDF} disabled={generatingPDF} className="flex items-center gap-3 px-6 h-12 shadow-2xl shadow-primary/20 font-black uppercase text-xs tracking-widest">
                               {generatingPDF ? <Loader2 size={16} className="animate-spin" /> : <Download size={18} />}
                               Exportar Relatório Minimalista
                            </Button>
                         </div>
                      </div>

                      {/* Comparison Highlights */}
                      {comparisonData && (
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in zoom-in duration-500">
                            <Card className="p-4 bg-primary/5 border-primary/20">
                               <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Patrimônio Anterior ({comparisonData.prevMonth})</p>
                               <p className="text-lg font-black text-primary/80">{formatCurrency(comparisonData.prevBalance)}</p>
                            </Card>
                            <Card className="p-4 bg-primary/5 border-primary/20">
                               <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Variação Nominal</p>
                               <div className="flex items-center gap-2">
                                  <p className={`text-lg font-black ${comparisonData.diff >= 0 ? 'text-[#10b981]' : 'text-red-500'}`}>
                                     {comparisonData.diff >= 0 ? '+' : ''}{formatCurrency(comparisonData.diff)}
                                  </p>
                                  {comparisonData.diff >= 0 ? <TrendingUp size={16} className="text-[#10b981]"/> : <TrendingUp size={16} className="text-red-500 rotate-180"/>}
                               </div>
                            </Card>
                            <Card className="p-4 bg-primary/5 border-primary/20">
                               <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Rentabilidade Estimada</p>
                               <p className={`text-lg font-black ${comparisonData.percent >= 0 ? 'text-[#10b981]' : 'text-red-500'}`}>
                                  {comparisonData.percent >= 0 ? '+' : ''}{comparisonData.percent.toFixed(2)}%
                               </p>
                            </Card>
                         </div>
                      )}

                      <div className="space-y-6">
                         {/* Table A Editor */}
                         <Card className="p-0 overflow-hidden bg-secondary/10 border-white/5">
                            <div className="bg-white/5 p-4 border-b border-white/5">
                               <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest">Balanço de Performance Consolidado (Tabela A)</h4>
                            </div>
                            <div className="overflow-x-auto custom-scrollbar">
                               <table className="w-full text-left border-collapse min-w-[700px]">
                                  <thead>
                                     <tr className="text-[10px] text-secondary uppercase font-semibold border-b border-white/5 bg-black/20">
                                        <th className="p-4">Carteira / Classe</th>
                                        <th className="p-4 text-center">Referência (%)</th>
                                        <th className="p-4 text-center">Índice (Bench)</th>
                                        <th className="p-4 text-center">Rentabilidade Total (%)</th>
                                        <th className="p-4 text-center">Yield Esperado (%)</th>
                                     </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5">
                                     {Object.values(tableA).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                           <td className="p-4">
                                              <span className={`text-sm font-bold tracking-tight ${row.label === 'Consolidada' ? 'text-primary underline decoration-primary/30' : 'text-secondary group-hover:text-primary transition-colors'}`}>
                                                 {row.label}
                                              </span>
                                           </td>
                                           <td className="p-4">
                                              <input className="w-full bg-secondary border border-white/10 rounded-lg px-2 py-1.5 text-center text-primary font-medium outline-none focus:border-primary transition-all text-xs" value={row.rentMês} onChange={e => updateTableA(row.label, 'rentMês', e.target.value)} />
                                           </td>
                                           <td className="p-4">
                                              <input className="w-full bg-secondary border border-white/10 rounded-lg px-2 py-1.5 text-center text-primary font-medium outline-none focus:border-primary transition-all text-xs" value={row.benchMês} onChange={e => updateTableA(row.label, 'benchMês', e.target.value)} />
                                           </td>
                                           <td className="p-4">
                                              <input className="w-full bg-secondary border border-white/10 rounded-lg px-2 py-1.5 text-center text-primary font-medium outline-none focus:border-primary transition-all text-xs" value={row.rentInício} onChange={e => updateTableA(row.label, 'rentInício', e.target.value)} />
                                           </td>
                                           <td className="p-4">
                                              <input className="w-full bg-secondary border border-white/10 rounded-lg px-2 py-1.5 text-center text-primary font-medium outline-none focus:border-primary transition-all text-xs" value={row.yield} onChange={e => updateTableA(row.label, 'yield', e.target.value)} />
                                           </td>
                                        </tr>
                                     ))}
                                  </tbody>
                               </table>
                            </div>
                         </Card>

                         {/* Analysis & Fee */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6 bg-secondary/10 border-white/5">
                               <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-4">Parecer do Especialista</h4>
                               <textarea 
                                 className="w-full bg-black/20 border border-white/10 text-primary rounded-2xl p-4 min-h-[140px] outline-none focus:border-primary transition-all text-sm leading-relaxed scrollbar-hide" 
                                 value={notes} 
                                 onChange={e=>setNotes(e.target.value)} 
                                 placeholder="Insira aqui sua análise técnica mensal e visão estratégica de mercado..."
                               />
                            </Card>

                            <Card className="p-6 bg-secondary/10 border-white/5 flex flex-col justify-between">
                               <div>
                                  <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-4">Cálculo de Fee Baseado em Patrimônio</h4>
                                  <Input label="Comissão Mensal (%)" value={feeRate} onChange={e=>setFeeRate(e.target.value)} />
                               </div>
                               <div className="p-5 bg-primary/10 rounded-2xl border border-primary/20 text-center mt-6">
                                  <p className="text-[9px] font-black text-secondary uppercase tracking-widest mb-1 opacity-60">Valor Estimado do Fee</p>
                                  <p className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(activeReportData.total_balance * (parseFloat(feeRate.replace(',','.')) / 100))}</p>
                               </div>
                            </Card>
                         </div>

                         {/* Actions Planner */}
                         <Card className="p-6 bg-secondary/10 border-white/5 relative overflow-hidden">
                            <div className="flex justify-between items-center mb-6 relative z-10">
                               <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest">Diretriz de Ações Para o Próximo Ciclo</h4>
                               <Button size="sm" variant="ghost" onClick={() => setPlanning([...planning, { acao: '', ativo: '', justificativa: '' }])} className="text-[9px] font-black uppercase text-primary border border-primary/20 hover:bg-primary/20 h-8 px-4">Nova Diretriz</Button>
                            </div>
                            <div className="space-y-3 relative z-10">
                               {planning.map((p, i) => (
                                  <div key={i} className="group flex flex-col md:flex-row gap-4 p-4 bg-black/30 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                                     <div className="md:w-1/4">
                                        <label className="text-[9px] font-black text-secondary uppercase block mb-1 opacity-40">Ação</label>
                                        <input className="w-full bg-transparent border-none text-primary font-black text-sm p-0 focus:ring-0" placeholder="Ex: Manter" value={p.acao} onChange={e => {
                                           const n = [...planning]; n[i].acao = e.target.value; setPlanning(n);
                                        }} />
                                     </div>
                                     <div className="md:w-1/4">
                                        <label className="text-[9px] font-black text-secondary uppercase block mb-1 opacity-40">Ativo / Grupo</label>
                                        <input className="w-full bg-transparent border-none text-primary font-black text-sm p-0 focus:ring-0" placeholder="Ex: Renda Fixa" value={p.ativo} onChange={e => {
                                           const n = [...planning]; n[i].ativo = e.target.value; setPlanning(n);
                                        }} />
                                     </div>
                                     <div className="flex-1">
                                        <label className="text-[9px] font-black text-secondary uppercase block mb-1 opacity-40">Motivo da Decisão</label>
                                        <input className="w-full bg-transparent border-none text-secondary text-sm p-0 focus:ring-0" placeholder="Análise técnica curta..." value={p.justificativa} onChange={e => {
                                           const n = [...planning]; n[i].justificativa = e.target.value; setPlanning(n);
                                        }} />
                                     </div>
                                     <button onClick={() => setPlanning(planning.filter((_, idx)=>idx!==i))} className="text-red-500/30 hover:text-red-500 transition-colors self-end md:self-center">
                                        <Trash2 size={18} />
                                     </button>
                                  </div>
                               ))}
                            </div>
                         </Card>

                         {/* Separator */}
                         <div className="flex items-center gap-6 py-10 opacity-20">
                            <div className="h-px flex-1 bg-white"></div>
                            <FileText size={24} className="text-white"/>
                            <div className="h-px flex-1 bg-white"></div>
                         </div>

                         {/* PDF PREVIEW BOX */}
                         <div className="bg-[#f0f0f0] p-4 md:p-12 overflow-x-auto rounded-3xl border-4 border-white/5">
                            <div className="bg-white shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] mx-auto rounded-sm overflow-hidden" style={{ width: '840px', minWidth: '840px' }}>
                               <div ref={reportRef} className="p-20 text-[12px]" style={{ backgroundColor: '#fff', color: '#111', fontFamily: 'Arial, Helvetica, sans-serif', lineHeight: '1.6' }}>
                                  
                                  {/* Minimalist Header PDF */}
                                  <div className="border-b-[6px] mb-12 pb-8 flex justify-between items-end" style={{ borderBottomColor: '#000' }}>
                                     <div>
                                       <h1 className="text-5xl font-black tracking-tighter" style={{ color: '#000', marginBottom: '8px' }}>RELATÓRIO MENSAL</h1>
                                       <p className="text-[14px] font-black tracking-[0.4em]" style={{ color: '#888' }}>GESTAO DE ALOCAÇÃO PATRIMONIAL</p>
                                     </div>
                                     <div className="text-right">
                                        <p className="text-2xl font-black tracking-tighter" style={{ color: '#000', textTransform: 'uppercase' }}>{selectedClientName}</p>
                                        <p style={{color: '#888', fontSize: '12px', fontWeight: '900', letterSpacing: '0.1em'}}>{activeReportData.month.split('-').reverse().join(' / ')}</p>
                                     </div>
                                  </div>

                                  {/* 1. EXECUTIVE SUMMARY */}
                                  <h3 className="font-black uppercase mb-4 text-[16px] border-b-2 pb-1" style={{borderColor: '#eee'}}>1. SUMÁRIO EXECUTIVO</h3>
                                  <div className="mb-10 p-8 bg-[#fcfcfc] border-l-[10px] border-[#000]">
                                     <p className="font-medium text-[14px] leading-relaxed" style={{color: '#222'}}>
                                        {notes || "Apresentação consolidada da carteira sob custódia, estruturada através do Método Cerrado para fins de rebalanceamento e otimização de rentabilidade histórica."}
                                     </p>
                                  </div>

                                  {/* 1.1 REBALANCE TABLE */}
                                  <h4 className="font-black uppercase mb-3 text-[12px] tracking-wider">1.1 TABELA DE REBALANCEAMENTO ESTRUTURAL</h4>
                                  <table className="w-full text-left mb-14 border-collapse" style={{fontSize: '11px'}}>
                                     <thead>
                                        <tr style={{ backgroundColor: '#000', color: '#fff' }}>
                                           <th className="p-4 border border-black uppercase tracking-widest">SETOR / CLASSIFICAÇÃO</th>
                                           <th className="p-4 border border-black text-center">EXPOSIÇÃO (%)</th>
                                           <th className="p-4 border border-black text-center">LIMITE ALVO (%)</th>
                                           <th className="p-4 border border-black text-right">DIRETRIZ DE APORTE</th>
                                        </tr>
                                     </thead>
                                     <tbody>
                                        {Object.values(pdfRebalanceData).sort((a,b) => b.currentBal - a.currentBal).map((sec, idx) => (
                                           <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                              <td className="p-4 border border-[#eee]">
                                                 <span className="font-black uppercase text-[12px]" style={{color: '#000'}}>{sec.macro}</span><br/>
                                                 <span style={{fontSize: '10px', color: '#666', fontWeight: 'bold'}}>{sec.sectorName}</span>
                                              </td>
                                              <td className="p-4 border border-[#eee] text-center font-black">{( (sec.currentBal / (activeReportData.total_balance||1)) * 100).toFixed(2)}%</td>
                                              <td className="p-4 border border-[#eee] text-center font-medium">{(sec.targetP * 100).toFixed(2)}%</td>
                                              <td className="p-4 border border-[#eee] text-right font-black uppercase text-[10px]" style={{ color: sec.statusColor }}>{sec.status}</td>
                                           </tr>
                                        ))}
                                     </tbody>
                                  </table>

                                  {/* 2. RESULTS CONSOLIDATED */}
                                  <h3 className="font-black uppercase mb-4 text-[16px] border-b-2 pb-1" style={{borderColor: '#eee'}}>2. RESULTADOS CONSOLIDADOS</h3>
                                  <p className="text-[10px] font-black text-gray-400 mb-4 uppercase tracking-[0.3em]">Balanço de Performance por Macro-Classe de Ativos</p>
                                  <table className="w-full text-left mb-14 border-collapse" style={{fontSize: '11px'}}>
                                     <thead>
                                        <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '4px solid #000' }}>
                                           <th className="p-4 border border-[#ddd]">CLASSE PATRIMONIAL</th>
                                           <th className="p-4 border border-[#ddd] text-center">RENT. MÊS (%)</th>
                                           <th className="p-4 border border-[#ddd] text-center">RENT. TOTAL (%)</th>
                                           <th className="p-4 border border-[#ddd] text-center">YIELD ESTIMADO</th>
                                           <th className="p-4 border border-[#ddd] text-right">VALOR CONSOLIDADO</th>
                                        </tr>
                                     </thead>
                                     <tbody>
                                        {Object.values(tableA).map((row, idx) => {
                                           const bal = row.label === 'Consolidada' ? activeReportData.total_balance : 
                                                       activePdfAssets.filter(a => {
                                                          const s = liveSectors.find(ls => ls.id === a.sector_id);
                                                          return (s ? s.macro_category : a.category) === row.label;
                                                       }).reduce((s, a) => s + a.current_balance, 0);
                                           
                                           if (row.label !== 'Consolidada' && bal === 0) return null;

                                           return (
                                              <tr key={idx} style={{ backgroundColor: row.label === 'Consolidada' ? '#fafafa' : 'transparent', fontWeight: row.label==='Consolidada'?'900':'normal' }}>
                                                 <td className="p-4 border border-[#eee] font-black">{row.label}</td>
                                                 <td className="p-4 border border-[#eee] text-center">
                                                    <span className="font-black" style={{fontSize: '13px'}}>{row.rentMês}%</span> <span style={{fontSize: '9px', color: '#999', display: 'block'}}>{row.benchMês}</span>
                                                 </td>
                                                 <td className="p-4 border border-[#eee] text-center">
                                                    <span className="font-black" style={{fontSize: '13px'}}>{row.rentInício}%</span>
                                                 </td>
                                                 <td className="p-4 border border-[#eee] text-center font-black">{row.yield}%</td>
                                                 <td className="p-4 border border-[#eee] text-right font-black" style={{fontSize: '12px'}}>{formatCurrency(bal)}</td>
                                              </tr>
                                           );
                                        })}
                                     </tbody>
                                  </table>

                                  {/* 3. EVOLUÇÃO COMPARATIVA */}
                                  {comparisonData && (
                                     <>
                                        <h3 className="font-black uppercase mb-4 text-[16px] border-b-2 pb-1" style={{borderColor: '#eee'}}>3. ANÁLISE COMPARATIVA ({comparisonData.prevMonth})</h3>
                                        <div className="grid grid-cols-3 gap-6 mb-8">
                                           <div className="p-4 bg-[#f9f9f9] border border-[#eee]">
                                              <p style={{fontSize: '9px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase'}}>Variação Patrimonial</p>
                                              <p style={{fontSize: '18px', fontWeight: '900', color: comparisonData.diff >= 0 ? '#000' : '#d00'}}>
                                                 {comparisonData.diff >= 0 ? '+' : ''}{formatCurrency(comparisonData.diff)}
                                              </p>
                                           </div>
                                           <div className="p-4 bg-[#f9f9f9] border border-[#eee]">
                                              <p style={{fontSize: '9px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase'}}>Rentabilidade Líquida</p>
                                              <p style={{fontSize: '18px', fontWeight: '900', color: comparisonData.diff >= 0 ? '#000' : '#d00'}}>
                                                 {comparisonData.percent >= 0 ? '+' : ''}{comparisonData.percent.toFixed(2)}%
                                              </p>
                                           </div>
                                           <div className="p-4 bg-[#f9f9f9] border border-[#eee]">
                                              <p style={{fontSize: '9px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase'}}>Status do Período</p>
                                              <p style={{fontSize: '14px', fontWeight: '900', color: comparisonData.diff >= 0 ? '#10b981' : '#f00', textTransform: 'uppercase'}}>
                                                 {comparisonData.diff >= 0 ? 'Expansão' : 'Retração'}
                                              </p>
                                           </div>
                                        </div>
                                        
                                        <div className="mb-12">
                                           <p className="text-[10px] font-black text-gray-400 mb-3 uppercase tracking-[0.2em]">Benchmarks do Mercado no Período</p>
                                           <div className="flex justify-between p-4 bg-white border border-[#eee]">
                                              {['CDI', 'IBOV', 'S&P500', 'IFIX'].map(idx => (
                                                 <div key={idx} className="text-center px-4 border-r last:border-r-0 border-[#eee]">
                                                    <p style={{fontSize: '9px', fontWeight: 'bold', color: '#888'}}>{idx}</p>
                                                    <p style={{fontSize: '11px', fontWeight: '900'}}>{tableA[idx === 'CDI' ? 'Consolidada' : idx === 'IBOV' ? 'Ações Nacionais' : idx === 'S&P500' ? 'Exterior (ETFs)' : 'Fundo Imobiliário (FII)']?.benchMês || '—'}%</p>
                                                 </div>
                                              ))}
                                           </div>
                                        </div>
                                     </>
                                  )}

                                  {/* 4. PLANNING */}
                                  <h3 className="font-black uppercase mb-4 text-[16px] border-b-2 pb-1" style={{borderColor: '#eee'}}>{comparisonData ? '4' : '3'}. PLANEJAMENTO E RECOMENDAÇÕES</h3>
                                  <table className="w-full text-left mb-14 border-collapse" style={{fontSize: '11px'}}>
                                     <thead>
                                        <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '4px solid #000' }}>
                                           <th className="p-4 border border-[#eee] w-36 uppercase tracking-widest">DIRETRIZ</th>
                                           <th className="p-4 border border-[#eee] w-52">ATIVO OU SETOR</th>
                                           <th className="p-4 border border-[#eee]">RACIONALE DA ANÁLISE</th>
                                        </tr>
                                     </thead>
                                     <tbody>
                                        {planning.map((p, idx) => (
                                           <tr key={idx}>
                                              <td className="p-4 border border-[#eee] font-black uppercase text-[10px]" style={{color: '#000'}}>{p.acao}</td>
                                              <td className="p-4 border border-[#eee] font-black tracking-tighter">{p.ativo}</td>
                                              <td className="p-4 border border-[#eee] italic leading-relaxed text-[#333] font-medium">{p.justificativa}</td>
                                           </tr>
                                        ))}
                                     </tbody>
                                  </table>

                                  {/* 4. FEE FOOTER */}
                                  <div className="mt-24 pt-10 flex justify-between items-end border-t-[3px] border-black">
                                     <div>
                                        <h4 className="font-black uppercase text-[12px] mb-3 tracking-[0.4em]" style={{color: '#999'}}>{comparisonData ? '5' : '4'}. TAXA DE GESTÃO (FEE-BASED)</h4>
                                        <p style={{fontSize: '12px', color: '#555', fontWeight: 'bold'}}>Calculado sobre o Patrimônio Total Consolidado Gerido: {feeRate}%</p>
                                        <p className="text-4xl font-black mt-3 tracking-tighter" style={{color: '#000'}}>{formatCurrency(activeReportData.total_balance * (parseFloat(feeRate.replace(',','.')) / 100))}</p>
                                     </div>
                                     <div className="text-right" style={{fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', color: '#bbb', letterSpacing: '0.2em'}}>
                                        <p>Consultoria Indepentente</p>
                                        <p>Documento Oficial e Confidencial</p>
                                     </div>
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                ) : (
                   <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-20 bg-secondary/5 rounded-[3rem] border-2 border-dashed border-white/5 animate-pulse">
                      <div className="p-8 bg-primary/5 rounded-full mb-8 shadow-inner">
                         <Calculator size={50} className="text-primary opacity-30" />
                      </div>
                      <h3 className="text-2xl font-black text-primary mb-3">Painel de Emissão Técnica</h3>
                      <p className="text-secondary max-w-sm font-black opacity-60">Selecione um fechamento arquivado ou a posição "Live" para editar os parâmetros e exportar o relatório minimalista.</p>
                   </div>
                )}
             </div>
          </div>
       </div>


       <MonthPickerModal 
          isOpen={showEditDateModal} 
          onClose={() => setShowEditDateModal(false)}
          value={newReportMonth}
          onChange={async (val) => {
            if (!reportToEdit) return;
            try {
                const { error } = await supabase.from('consulting_reports').update({ month: val }).eq('id', reportToEdit.id);
                if (error) throw error;
                toast.success("Data atualizada");
                setShowEditDateModal(false);
                fetchClientData(selectedClientId);
            } catch (e) {
                toast.error("Erro ao atualizar data");
            }
          }}
          title="Ajustar Mês de Referência"
       />
    </div>
  );
}
