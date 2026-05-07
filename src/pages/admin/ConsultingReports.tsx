import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import ReportCharts from '@/components/ReportCharts';
import PageHeader from '@/components/PageHeader';
import { ChevronLeft, Download, Loader2, BarChart2, Save, Calculator, Trash2, ArrowRight, TrendingUp, Edit2, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button';
import { Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Loader from '@/components/Loader';
import MonthPickerModal from '@/components/MonthPickerModal';
import { formatCurrency, formatMonthShort, formatNumberWithTwoDecimalsBR } from '@/utils/format';
import { toast } from 'react-hot-toast';

interface PortfolioMacroSector {
  id: string; client_id: string; name: string; target_percentage: number;
}

interface PortfolioSector {
  id: string; client_id: string; macro_sector_id: string | null; macro_category: string; sector_name: string; target_percentage: number;
}

interface PortfolioAsset {
  id?: string; category: string; asset_name: string; current_balance: number;
  target_percentage?: number;
  sector_id?: string; applied_amount?: number; custom_rate?: string; maturity_date?: string; variation_month?: string; variation_total?: string;
}

interface AssetMover {
  asset_name: string;
  category: string;
  currentBalance: number;
  prevBalance: number;
  changePercent: number;
  changeValue: number;
}

interface ConsultingReport { 
  id: string; 
  month: string; 
  total_balance: number; 
  notes: string; 
  created_at: string; 
  performance_table?: Record<string, TableARow>;
  planning_actions?: PlanningRow[];
}

// Constants moved or no longer needed in this scope


interface TableARow {
  label: string;
  rentMês: string;
  benchMês: string; // This will now store the percentage value
  benchName?: string; // This will store the index name (CDI, IBOV...)
  rentInício: string;
  benchInício: string;
  yield: string;
}

interface PlanningRow {
  acao: string;
  ativo: string;
  justificativa: string;
}

export default function ConsultingReports({ clientId, selectedMonth: _selectedMonth, onReportArchived: _onReportArchived }: { clientId: string, selectedMonth?: string, onReportArchived?: () => Promise<void> }) {
   const navigate = useNavigate();
   const [clientName, setClientName] = useState<string>('');
  const [liveMacroSectors, setLiveMacroSectors] = useState<PortfolioMacroSector[]>([]);
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
  const [scenarioNotes, setScenarioNotes] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [compositionNotes, setCompositionNotes] = useState('');

  // Top Movers State
  const [topMoversMonth, setTopMoversMonth] = useState<{ gainers: AssetMover[]; losers: AssetMover[] }>({ gainers: [], losers: [] });
  const [topMoversYtd, setTopMoversYtd] = useState<{ gainers: AssetMover[]; losers: AssetMover[] }>({ gainers: [], losers: [] });

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

  useEffect(() => {
    if (clientId) { fetchClientData(clientId); setActiveReportMode(null); }
    else { setLiveAssets([]); setHistoryReports([]); setLiveSectors([]); }
  }, [clientId]);

  const fetchClientData = async (id: string) => {
    setLoading(true);
    try {
      const { data: cData } = await supabase.from('consulting_clients').select('name').eq('id', id).single();
      if (cData) setClientName(cData.name);

      const { data: macData } = await supabase.from('portfolio_macro_sectors').select('*').eq('client_id', id);
      setLiveMacroSectors(macData || []);

      const { data: secData } = await supabase.from('portfolio_sectors').select('*').eq('client_id', clientId);
      setLiveSectors(secData || []);

      const { data: assetsData } = await supabase.from('portfolio_assets').select('*').eq('client_id', clientId);
      const live = assetsData || [];
      setLiveAssets(live);
      setLiveTotal(live.reduce((acc, a) => acc + a.current_balance, 0));

      const { data: reportsData } = await supabase.from('consulting_reports').select('*').eq('client_id', clientId).order('month', { ascending: true });
      const history = (reportsData || []) as ConsultingReport[];
      setHistoryReports(history);
      

    } catch (err) {} finally { setLoading(false); }
  };

  // ─── Top Movers helpers ───────────────────────────────────────────────────
  const computeTopMovers = async (currentAssets: PortfolioAsset[], currentReportId: string) => {
    // Month-over-month: get prev report assets
    const currentReport = historyReports.find(r => r.id === currentReportId);
    const sortedHistory = [...historyReports].sort((a, b) => a.month.localeCompare(b.month));
    const currentIdx = sortedHistory.findIndex(r => r.id === currentReportId);
    const prevReport = currentIdx > 0 ? sortedHistory[currentIdx - 1] : null;

    let monthMovers = { gainers: [] as AssetMover[], losers: [] as AssetMover[] };
    if (prevReport) {
      const { data: prevAssets } = await supabase.from('consulting_report_assets').select('*').eq('report_id', prevReport.id);
      const prev = (prevAssets || []) as PortfolioAsset[];
      const movers: AssetMover[] = currentAssets.map(a => {
        const p = prev.find(pa => pa.asset_name === a.asset_name);
        if (!p || p.current_balance === 0) return null;
        const changeValue = a.current_balance - p.current_balance;
        const changePercent = (changeValue / p.current_balance) * 100;
        return { asset_name: a.asset_name, category: a.category, currentBalance: a.current_balance, prevBalance: p.current_balance, changePercent, changeValue };
      }).filter(Boolean) as AssetMover[];
      movers.sort((a, b) => b.changePercent - a.changePercent);
      monthMovers = { gainers: movers.filter(m => m.changePercent > 0).slice(0, 5), losers: movers.filter(m => m.changePercent < 0).slice(-5).reverse() };
    }
    setTopMoversMonth(monthMovers);

    // YTD: find Jan of current year
    const currentYear = currentReport?.month?.slice(0, 4) || new Date().getFullYear().toString();
    const janReport = sortedHistory.find(r => r.month.startsWith(`${currentYear}-01`) || r.month.startsWith(`${currentYear}-02`)) ||
                      sortedHistory.find(r => r.month.startsWith(currentYear));
    let ytdMovers = { gainers: [] as AssetMover[], losers: [] as AssetMover[] };
    if (janReport && janReport.id !== currentReportId) {
      const { data: janAssets } = await supabase.from('consulting_report_assets').select('*').eq('report_id', janReport.id);
      const jan = (janAssets || []) as PortfolioAsset[];
      const movers: AssetMover[] = currentAssets.map(a => {
        const j = jan.find(ja => ja.asset_name === a.asset_name);
        if (!j || j.current_balance === 0) return null;
        const changeValue = a.current_balance - j.current_balance;
        const changePercent = (changeValue / j.current_balance) * 100;
        return { asset_name: a.asset_name, category: a.category, currentBalance: a.current_balance, prevBalance: j.current_balance, changePercent, changeValue };
      }).filter(Boolean) as AssetMover[];
      movers.sort((a, b) => b.changePercent - a.changePercent);
      ytdMovers = { gainers: movers.filter(m => m.changePercent > 0).slice(0, 5), losers: movers.filter(m => m.changePercent < 0).slice(-5).reverse() };
    }
    setTopMoversYtd(ytdMovers);
  };

  const generateAutoSuggestions = (assets: PortfolioAsset[], compData: typeof comparisonData) => {
    const suggestions: string[] = [];
    if (compData) {
      if (compData.percent >= 1) suggestions.push(`A carteira apresentou expansão patrimonial de ${compData.percent.toFixed(2)}% no período, superando a variação do mês anterior.`);
      else if (compData.percent < 0) suggestions.push(`A carteira registrou retração de ${Math.abs(compData.percent).toFixed(2)}% no período. Recomenda-se revisão do posicionamento defensivo.`);
      else suggestions.push(`A carteira manteve estabilidade patrimonial no período, com variação de ${compData.percent.toFixed(2)}%.`);
    }
    const rfAssets = assets.filter(a => a.category?.toLowerCase().includes('renda fixa'));
    const rvAssets = assets.filter(a => a.category?.toLowerCase().includes('ações') || a.category?.toLowerCase().includes('renda variável'));
    const rfTotal = rfAssets.reduce((s, a) => s + a.current_balance, 0);
    const rvTotal = rvAssets.reduce((s, a) => s + a.current_balance, 0);
    const total = assets.reduce((s, a) => s + a.current_balance, 0);
    if (total > 0) {
      const rfPct = (rfTotal / total * 100).toFixed(0);
      const rvPct = (rvTotal / total * 100).toFixed(0);
      suggestions.push(`A alocação consolidada está distribuída em aproximadamente ${rfPct}% em Renda Fixa e ${rvPct}% em Renda Variável, refletindo o perfil de risco definido no mandato.`);
    }
    return suggestions.join(' ');
  };

  const handleCopyFromPrevious = () => {
    if (!activeReportData) return;
    const sortedHistory = [...historyReports].sort((a, b) => a.month.localeCompare(b.month));
    const currentIdx = sortedHistory.findIndex(r => r.id === activeReportData.id);
    const isLive = activeReportMode === 'live';
    const prevReport = isLive
      ? (sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1] : null)
      : (currentIdx > 0 ? sortedHistory[currentIdx - 1] : null);
    if (!prevReport) { toast('Não há relatório anterior para copiar.'); return; }
    if (prevReport.notes) setNotes(prevReport.notes);
    if (prevReport.performance_table) setTableA(prev => ({
      ...Object.fromEntries(Object.entries(prevReport.performance_table!).map(([k, v]) => [k, { ...v, rentMês: '-' }])),
      ...Object.fromEntries(Object.keys(prev).filter(k => !prevReport.performance_table![k]).map(k => [k, prev[k]]))
    }));
    if (prevReport.planning_actions?.length) setPlanning(prevReport.planning_actions);
    toast.success('Dados copiados do mês anterior!');
  };



  const getDefaultBenchName = (macroName: string) => {
      const mn = macroName.toLowerCase();
      if (mn.includes('consolidada')) return 'Poupança';
      if (mn.includes('ações nacionais') || mn === 'ações') return 'IBOV';
      if (mn.includes('renda fixa')) return 'CDI';
      if (mn.includes('fundo imobiliário') || mn.includes('fii')) return 'IFIX';
      if (mn.includes('exterior') || mn.includes('mercado internacional')) return 'S&P500';
      return 'Bench';
   };

  const initTableA = (assetsArray: PortfolioAsset[]) => {
     const macroNames = liveMacroSectors.length > 0 ? liveMacroSectors.map(m => m.name) : [...new Set(assetsArray.map(a => {
        const s = liveSectors.find(ls => ls.id === a.sector_id);
        return s ? s.macro_category : a.category;
     }))];
     
     const macros = ['Consolidada', ...macroNames];
     
     const newTable: Record<string, TableARow> = {};
     const lastReport = historyReports.length > 0 ? historyReports[historyReports.length - 1] : null;

     macros.forEach(m => {
          const pastRow = lastReport?.performance_table?.[m];
          newTable[m] = {
             label: m,
             rentMês: '-', // Rentabilidade do mês atual deve ser preenchida
             benchMês: pastRow?.benchMês || '-',
             benchName: pastRow?.benchName || getDefaultBenchName(m),
             rentInício: pastRow?.rentInício || '-', // Carrega o acumulado
             benchInício: pastRow?.benchInício || '-',
             yield: pastRow?.yield || '-'
          }
       });
       setTableA(newTable);
    };

  const handleSaveMonth = async () => {
     if (!clientId) return;
     if (liveAssets.length === 0) return alert("Não há ativos.");
     const monthStr = new Date().toISOString().slice(0, 7);
     if (historyReports.some(r => r.month === monthStr)) {
         if(!window.confirm(`Deseja substituir os dados de ${monthStr}?`)) return;
     }

     setSavingMonth(true);
     try {
        const { data: newReport } = await supabase.from('consulting_reports').insert([{ 
           client_id: clientId, 
           month: monthStr, 
           total_balance: liveTotal, 
           notes: notes,
            scenario_notes: scenarioNotes,
            next_steps: nextSteps,
            composition_notes: compositionNotes,
            performance_table: tableA,
           planning_actions: planning
        }]).select().single();
        const frozenAssets = liveAssets.map(a => ({
           report_id: newReport.id, asset_name: a.asset_name, category: a.category, current_balance: a.current_balance,
           target_percentage: a.target_percentage || 0,
           sector_id: a.sector_id, applied_amount: a.applied_amount, custom_rate: a.custom_rate, maturity_date: a.maturity_date, variation_month: a.variation_month, variation_total: a.variation_total
        }));
        await supabase.from('consulting_report_assets').insert(frozenAssets);
        alert('Mês arquivado com sucesso!');
        fetchClientData(clientId);
     } catch (err) {} finally { setSavingMonth(false); }
  };

   const handleUpdateHistoricalReport = async () => {
      if (!activeReportData || activeReportMode === 'live') return;
      setSavingMonth(true);
      try {
         await supabase.from('consulting_reports').update({ 
            notes: notes,
            scenario_notes: scenarioNotes,
            next_steps: nextSteps,
            composition_notes: compositionNotes,
            performance_table: tableA,
            planning_actions: planning
         }).eq('id', activeReportData.id);
 
         toast.success("Histórico atualizado com sucesso");
         fetchClientData(clientId);
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
          fetchClientData(clientId);
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
     setActiveReportMode(mode); setNotes(''); setScenarioNotes(''); setNextSteps('');
     setTopMoversMonth({ gainers: [], losers: [] });
     setTopMoversYtd({ gainers: [], losers: [] });
     if (mode === 'live') {
        const data = { id: 'live', month: new Date().toISOString().slice(0,7), total_balance: liveTotal, notes: '', created_at: new Date().toISOString() };
        setActiveReportData(data);
        setActivePdfAssets(liveAssets);
        initTableA(liveAssets);
     } else {
        const rep = historyReports.find(r => r.id === mode);
        if (rep) {
           setActiveReportData(rep); 
           setNotes(rep.notes || '');
           setScenarioNotes((rep as any).scenario_notes || '');
           setNextSteps((rep as any).next_steps || '');
           setCompositionNotes((rep as any).composition_notes || '');
           const { data } = await supabase.from('consulting_report_assets').select('*').eq('report_id', rep.id);
           const assetsFromSnapshot = (data || []) as PortfolioAsset[];
           setActivePdfAssets(assetsFromSnapshot);
           
           if (rep.performance_table && Object.keys(rep.performance_table).length > 0) {
              const backfilled = { ...rep.performance_table };
              Object.keys(backfilled).forEach(k => {
                 if (!backfilled[k].benchName || backfilled[k].benchName === '-') {
                    backfilled[k].benchName = getDefaultBenchName(backfilled[k].label);
                 }
              });
              setTableA(backfilled);
           } else {
              initTableA(assetsFromSnapshot);
           }

           if (rep.planning_actions && rep.planning_actions.length > 0) {
              setPlanning(rep.planning_actions);
           } else {
              setPlanning([
                 { acao: 'Aportar', ativo: 'FIIs / Exterior', justificativa: 'Ativos sub-alocados em relação ao alvo.' },
                 { acao: 'Aguardar', ativo: 'Ações Nacionais', justificativa: 'Exposição acima do limite; aguardar diluição.' }
              ]);
           }

           // Trigger top movers computation asynchronously
           computeTopMovers(assetsFromSnapshot, rep.id);
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
           const mObj = sObj ? liveMacroSectors.find(m => m.id === sObj.macro_sector_id) : null;
           res[secId] = {
              sectorName: sObj ? sObj.sector_name : 'Sem Setor Atribuído',
              macro: mObj ? mObj.name : (sObj ? sObj.macro_category : a.category),
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
  }, [activePdfAssets, liveSectors, liveMacroSectors]);

  const generatePDF = async () => {
    if (!reportRef.current) return;
    setGeneratingPDF(true);
    try {
      await new Promise(r => setTimeout(r, 600));
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; 
      const pageHeight = 297; 
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add subsequent pages if content exceeds A4 height
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Relatorio_${clientName}_${activeReportData?.month}.pdf`);
    } catch (err) { alert("Erro ao gerar PDF"); } finally { setGeneratingPDF(false); }
  };

  const evolutionData = useMemo(() => {
     let data = historyReports.map(r => ({ month: formatMonthShort(r.month), Patrimônio: r.total_balance }));
     data.push({ month: 'Atual', Patrimônio: liveTotal });
     return data;
  }, [historyReports, liveTotal]);

   const sortedTableAData = useMemo(() => {
      const data = Object.values(tableA).map(row => {
         const balance = row.label === 'Consolidada' ? (activeReportData?.total_balance || 0) : 
                        activePdfAssets.filter(a => {
                           const s = liveSectors.find(ls => ls.id === a.sector_id);
                           const macroName = s ? liveMacroSectors.find(m => m.id === s.macro_sector_id)?.name : null;
                           return (macroName || (s ? s.macro_category : a.category)) === row.label;
                        }).reduce((s, a) => s + a.current_balance, 0);
         return { ...row, balance };
      });

      return data.sort((a, b) => {
         if (a.label === 'Consolidada') return -1;
         if (b.label === 'Consolidada') return 1;
         return b.balance - a.balance;
      });
   }, [tableA, activeReportData, activePdfAssets, liveSectors, liveMacroSectors]);

  const updateTableA = (label: string, field: keyof TableARow, value: string) => {
     setTableA(prev => ({
        ...prev,
        [label]: { ...prev[label], [field]: value }
     }));
  };

  if (loading && !clientId) return <div className="flex justify-center p-20"><Loader text="Sincronizando dados..." /></div>;

  return (
    <div className="min-h-screen bg-secondary/30">
      <PageHeader 
        title="Relatórios de Consultoria"
        subtitle={`Cliente: ${clientName}`}
        action={
          <Button onClick={() => navigate(-1)} variant="ghost" size="sm" className="flex items-center gap-2">
             <ChevronLeft size={16} /> Voltar
          </Button>
        }
      />
      
      <div className="p-4 lg:p-8 space-y-6 animate-page-enter">
          {/* Evolution Chart - Full Width */}
          <Card className="p-6 bg-primary relative overflow-hidden group border-primary shadow-sm w-full">
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

          {/* History Management - Full Width & Compact */}
          <div className="space-y-4">
             <div className="flex justify-between items-end px-1">
                <h3 className="text-xs font-semibold text-secondary uppercase tracking-widest pl-1 opacity-60 flex items-center gap-2">
                   <FileText size={14} /> Histórico de Fechamentos
                </h3>
                <Button 
                   onClick={handleSaveMonth} 
                   disabled={savingMonth || !clientId} 
                   variant="outline" 
                   size="sm"
                   className="flex items-center gap-2 border-primary/20 hover:bg-primary/5 transition-all font-black text-[10px] uppercase tracking-widest px-4"
                >
                   {savingMonth ? <Loader2 size={14} className="animate-spin" /> : <Save size={14}/>}
                   Arquivar Mês Atual
                </Button>
             </div>
             
             <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 custom-scrollbar -mx-1">
                  <div 
                     onClick={() => loadPdfEngineFor('live')}
                     className={`flex-shrink-0 w-48 p-4 rounded-xl border transition-all cursor-pointer group relative shadow-sm ${activeReportMode === 'live' ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-primary bg-primary hover:bg-tertiary'}`}
                  >
                     <div className="flex justify-between items-center mb-1">
                        <span className={`text-[9px] font-black uppercase tracking-wider ${activeReportMode === 'live' ? 'text-primary' : 'text-secondary opacity-40'}`}>Atual</span>
                        <div className="flex items-center gap-1">
                           <div className="w-1 h-1 rounded-full bg-[#10b981] animate-pulse"></div>
                           <span className="text-[8px] font-black text-[#10b981] uppercase">Live</span>
                        </div>
                     </div>
                     <p className={`font-bold text-sm tracking-tight transition-colors ${activeReportMode === 'live' ? 'text-primary' : 'text-secondary'}`}>Posição em Aberto</p>
                     <p className="mt-2 text-xs font-black text-primary/70">{formatCurrency(liveTotal)}</p>
                  </div>

                  {historyReports.map(r => (
                     <div 
                        key={r.id} onClick={() => loadPdfEngineFor(r.id)}
                        className={`flex-shrink-0 w-48 p-4 rounded-xl border transition-all cursor-pointer group relative shadow-sm ${activeReportMode === r.id ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-primary bg-primary hover:bg-tertiary'}`}
                     >
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                           <button 
                              onClick={(e) => { e.stopPropagation(); handleOpenEditModal(r); }}
                              className="p-1 rounded-md bg-primary/50 hover:bg-primary text-secondary hover:text-primary border border-primary/20 transition-all"
                              title="Editar data"
                           >
                              <Edit2 size={10} />
                           </button>
                           <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteReport(r.id); }}
                              className="p-1 rounded-md bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 transition-all"
                              title="Excluir"
                           >
                              <Trash2 size={10} />
                           </button>
                        </div>
                        <div className="mb-1">
                           <span className={`text-[9px] font-black uppercase tracking-wider ${activeReportMode === r.id ? 'text-primary' : 'text-secondary opacity-40'}`}>
                              {r.month.split('-').reverse().join('/')}
                           </span>
                        </div>
                        <p className={`font-bold text-sm tracking-tight transition-colors truncate ${activeReportMode === r.id ? 'text-primary' : 'text-secondary'}`}>
                           Fechamento Mensal
                        </p>
                        <p className="mt-2 text-xs font-black text-primary/70">{formatCurrency(r.total_balance)}</p>
                     </div>
                  ))}

                  {historyReports.length === 0 && (
                     <div className="flex-1 text-center py-6 border border-dashed border-primary rounded-xl opacity-40">
                        <p className="text-xs font-black text-secondary uppercase italic">Nenhum registro anterior</p>
                     </div>
                  )}
             </div>
          </div>

          <div className="w-full">
                {activeReportMode && activeReportData ? (
                   <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                         <div>
                            <h2 className="text-2xl font-bold text-primary tracking-tight">Editor de Relatório</h2>
                            <p className="text-secondary text-sm">Configurando emissão para <span className="text-primary font-semibold">{activeReportData.month}</span></p>
                         </div>
                         <div className="flex gap-3 flex-wrap">
                            <button onClick={handleCopyFromPrevious} className="text-xs px-3 py-2 rounded-lg border border-white/10 text-secondary hover:text-primary hover:bg-white/5 transition-all">Copiar Mês Anterior</button>
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

                      {comparisonData && (
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in zoom-in duration-500">
                            <Card className="p-4 bg-primary border-primary shadow-sm">
                               <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Patrimônio Anterior ({comparisonData.prevMonth})</p>
                               <p className="text-lg font-black text-primary/80">{formatCurrency(comparisonData.prevBalance)}</p>
                            </Card>
                            <Card className="p-4 bg-primary border-primary shadow-sm">
                               <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Variação Nominal</p>
                               <div className="flex items-center gap-2">
                                  <p className={`text-lg font-black ${comparisonData.diff >= 0 ? 'text-income' : 'text-danger'}`}>
                                     {comparisonData.diff >= 0 ? '+' : ''}{formatCurrency(comparisonData.diff)}
                                  </p>
                                  {comparisonData.diff >= 0 ? <TrendingUp size={16} className="text-income"/> : <TrendingUp size={16} className="text-danger rotate-180"/>}
                               </div>
                            </Card>
                            <Card className="p-4 bg-primary border-primary shadow-sm">
                               <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Rentabilidade Estimada</p>
                               <p className={`text-lg font-black ${comparisonData.percent >= 0 ? 'text-income' : 'text-danger'}`}>
                                  {comparisonData.percent >= 0 ? '+' : ''}{formatNumberWithTwoDecimalsBR(comparisonData.percent)}%
                               </p>
                            </Card>
                         </div>
                      )}

                      <div className="space-y-6">
                         <div className="space-y-4">
                             {/* Desktop Table View */}
                             <Card className="hidden md:block p-0 overflow-hidden bg-primary border-primary shadow-sm">
                            <div className="bg-tertiary p-4 border-b border-primary">
                               <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest">Balanço de Performance Consolidado (Tabela A)</h4>
                            </div>
                            <div className="overflow-x-auto custom-scrollbar">
                               <table className="w-full text-left border-collapse min-w-[700px]">
                                  <thead>
                                     <tr className="text-[10px] text-secondary uppercase font-semibold border-b border-primary bg-secondary">
                                        <th className="p-4">Carteira / Classe</th>
                                        <th className="p-4 text-center">Referência (%)</th>
                                        <th className="p-4 text-center">Índice (Bench)</th>
                                        <th className="p-4 text-center">Rentabilidade Total (%)</th>
                                        <th className="p-4 text-center">Yield Esperado (%)</th>
                                     </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--color-border)]">
                                     {sortedTableAData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-tertiary transition-colors group">
                                           <td className="p-4">
                                              <span className={`text-sm font-bold tracking-tight ${row.label === 'Consolidada' ? 'text-primary underline decoration-primary/30' : 'text-secondary group-hover:text-primary transition-colors'}`}>
                                                 {row.label}
                                              </span>
                                           </td>
                                           <td className="p-4">
                                              <input className="w-full bg-secondary border border-primary rounded-lg px-2 py-1.5 text-center text-primary font-medium outline-none focus:border-primary transition-all text-xs" value={row.rentMês} onChange={e => updateTableA(row.label, 'rentMês', e.target.value)} />
                                           </td>
                                           <td className="p-4">
                                              <div className="flex flex-col items-center gap-1">
                                                 <input className="w-full bg-secondary border border-primary rounded-lg px-2 py-1.5 text-center text-primary font-medium outline-none focus:border-primary transition-all text-xs" value={row.benchMês} onChange={e => updateTableA(row.label, 'benchMês', e.target.value)} placeholder="0,00" />
                                                 {row.benchName && <span className="text-[9px] text-secondary font-black uppercase opacity-60">{row.benchName}</span>}
                                              </div>
                                           </td>
                                           <td className="p-4">
                                              <input className="w-full bg-secondary border border-primary rounded-lg px-2 py-1.5 text-center text-primary font-medium outline-none focus:border-primary transition-all text-xs" value={row.rentInício} onChange={e => updateTableA(row.label, 'rentInício', e.target.value)} />
                                           </td>
                                           <td className="p-4">
                                              <input className="w-full bg-secondary border border-primary rounded-lg px-2 py-1.5 text-center text-primary font-medium outline-none focus:border-primary transition-all text-xs" value={row.yield} onChange={e => updateTableA(row.label, 'yield', e.target.value)} />
                                           </td>
                                        </tr>
                                     ))}
                                  </tbody>
                               </table>
                            </div>
                         </Card>

                         {/* Mobile Card View */}
                         <div className="md:hidden space-y-4">
                            <div className="px-1">
                               <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest opacity-60">Balanço de Performance (Tabela A)</h4>
                            </div>
                            {sortedTableAData.map((row, idx) => (
                               <Card key={idx} className="p-4 bg-primary border-primary shadow-sm space-y-4">
                                  <div className="flex justify-between items-center border-b border-primary/10 pb-2">
                                     <span className={`text-sm font-black tracking-tight ${row.label === 'Consolidada' ? 'text-primary' : 'text-secondary'}`}>
                                        {row.label}
                                     </span>
                                     <span className="text-[10px] font-black text-secondary/40 uppercase tracking-widest">
                                        {formatCurrency(row.balance)}
                                     </span>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                     <div className="space-y-1">
                                        <label className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40">Rent. Mês (%)</label>
                                        <input className="w-full bg-tertiary border border-primary rounded-lg px-2 py-2 text-center text-primary font-bold outline-none focus:border-primary transition-all text-xs" value={row.rentMês} onChange={e => updateTableA(row.label, 'rentMês', e.target.value)} />
                                     </div>
                                     <div className="space-y-1">
                                        <label className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40">Rent. Total (%)</label>
                                        <input className="w-full bg-tertiary border border-primary rounded-lg px-2 py-2 text-center text-primary font-bold outline-none focus:border-primary transition-all text-xs" value={row.rentInício} onChange={e => updateTableA(row.label, 'rentInício', e.target.value)} />
                                     </div>
                                     <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                           <label className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40">Bench. Mês (%)</label>
                                           {row.benchName && <span className="text-[8px] text-secondary font-black uppercase opacity-60">{row.benchName}</span>}
                                        </div>
                                        <input className="w-full bg-tertiary border border-primary rounded-lg px-2 py-2 text-center text-primary font-bold outline-none focus:border-primary transition-all text-xs" value={row.benchMês} onChange={e => updateTableA(row.label, 'benchMês', e.target.value)} placeholder="0,00" />
                                     </div>
                                     <div className="space-y-1">
                                        <label className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40">Yield (%)</label>
                                        <input className="w-full bg-tertiary border border-primary rounded-lg px-2 py-2 text-center text-primary font-bold outline-none focus:border-primary transition-all text-xs" value={row.yield} onChange={e => updateTableA(row.label, 'yield', e.target.value)} />
                                     </div>
                                  </div>
                               </Card>
                            ))}
                         </div>
                      </div>

                         {/* Top Movers - Mês */}
                         {(topMoversMonth.gainers.length > 0 || topMoversMonth.losers.length > 0) && (
                            <div className="grid grid-cols-2 gap-4">
                               {([{t:'Top Altas M\u00eas',l:topMoversMonth.gainers,c:'text-emerald-400'},{t:'Top Baixas M\u00eas',l:topMoversMonth.losers,c:'text-red-400'}] as {t:string,l:typeof topMoversMonth.gainers,c:string}[]).map(({t,l,c})=>(
                                  <Card key={t} className="p-4 bg-primary border-primary shadow-sm">
                                     <h4 className={'text-[10px] font-black uppercase tracking-widest mb-2 ' + c}>{t}</h4>
                                     {l.map((m,i)=>(
                                        <div key={i} className="flex justify-between text-xs py-0.5">
                                           <span className="text-secondary truncate max-w-[55%]">{m.asset_name}</span>
                                           <span className={'font-black ' + c}>{m.changePercent>0?'+':''}{formatNumberWithTwoDecimalsBR(m.changePercent)}%</span>
                                        </div>
                                     ))}
                                  </Card>
                               ))}
                            </div>
                         )}
                         {/* Top Movers - YTD */}
                         {(topMoversYtd.gainers.length > 0 || topMoversYtd.losers.length > 0) && (
                            <div className="grid grid-cols-2 gap-4">
                               {([{t:'Top Altas Ano (YTD)',l:topMoversYtd.gainers,c:'text-blue-400'},{t:'Top Baixas Ano (YTD)',l:topMoversYtd.losers,c:'text-orange-400'}] as {t:string,l:typeof topMoversYtd.gainers,c:string}[]).map(({t,l,c})=>(
                                  <Card key={t} className="p-4 bg-primary border-primary shadow-sm">
                                     <h4 className={'text-[10px] font-black uppercase tracking-widest mb-2 ' + c}>{t}</h4>
                                     {l.map((m,i)=>(
                                        <div key={i} className="flex justify-between text-xs py-0.5">
                                           <span className="text-secondary truncate max-w-[55%]">{m.asset_name}</span>
                                           <span className={'font-black ' + c}>{m.changePercent>0?'+':''}{formatNumberWithTwoDecimalsBR(m.changePercent)}%</span>
                                        </div>
                                     ))}
                                  </Card>
                               ))}
                            </div>
                         )}

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6 bg-primary border-primary shadow-sm col-span-2">
                               <div className="flex justify-between items-center mb-3">
                                  <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest">Sumário Executivo</h4>
                                  <button onClick={() => setNotes(generateAutoSuggestions(activePdfAssets, comparisonData))} className="text-[10px] text-primary border border-primary/20 px-3 py-1 rounded-lg hover:bg-primary/10 transition-all font-bold">✨ Auto-sugerir</button>
                               </div>
                               <textarea className="w-full bg-tertiary border border-primary text-primary rounded-2xl p-4 min-h-[80px] outline-none focus:border-primary transition-all text-sm leading-relaxed scrollbar-hide" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Sumário executivo e análise técnica..." />
                            </Card>
                            <Card className="p-6 bg-primary border-primary shadow-sm">
                               <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-3">Cenário Econômico</h4>
                               <textarea className="w-full bg-tertiary border border-primary text-primary rounded-2xl p-4 min-h-[80px] outline-none focus:border-primary transition-all text-sm leading-relaxed scrollbar-hide" value={scenarioNotes} onChange={e=>setScenarioNotes(e.target.value)} placeholder="Análise macro: juros, inflação, câmbio..." />
                            </Card>
                            <Card className="p-6 bg-primary border-primary shadow-sm">
                               <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-3">Próximos Passos</h4>
                               <textarea className="w-full bg-tertiary border border-primary text-primary rounded-2xl p-4 min-h-[80px] outline-none focus:border-primary transition-all text-sm leading-relaxed scrollbar-hide" value={nextSteps} onChange={e=>setNextSteps(e.target.value)} placeholder="Diretrizes para o próximo ciclo..." />
                            </Card>
                            <Card className="p-6 bg-primary border-primary shadow-sm col-span-2">
                               <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-3">Descrição da Composição Alvo</h4>
                               <textarea className="w-full bg-tertiary border border-primary text-primary rounded-2xl p-4 min-h-[80px] outline-none focus:border-primary transition-all text-sm leading-relaxed scrollbar-hide" value={compositionNotes} onChange={e=>setCompositionNotes(e.target.value)} placeholder="Comentários sobre a alocação atual vs alvo..." />
                            </Card>
                         </div>
                         <div className="w-full">
                             <Card className="p-6 bg-primary border-primary shadow-sm">
                                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                                   <div className="flex-1 w-full">
                                      <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-4">Cálculo de Fee Baseado em Patrimônio</h4>
                                      <Input label="Comissão Mensal (%)" value={feeRate} onChange={e=>setFeeRate(e.target.value)} />
                                   </div>
                                   <div className="p-6 bg-tertiary border border-primary shadow-inner rounded-2xl text-center min-w-[280px] w-full md:w-auto">
                                      <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1 opacity-60">Valor Estimado do Fee</p>
                                      <p className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(activeReportData.total_balance * (parseFloat(feeRate.replace(',','.')) / 100))}</p>
                                   </div>
                                </div>
                             </Card>
                          </div>

                         <Card className="p-6 bg-primary border-primary shadow-sm relative overflow-hidden">
                            <div className="flex justify-between items-center mb-6 relative z-10">
                               <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest">Diretriz de Ações Para o Próximo Ciclo</h4>
                               <Button size="sm" variant="ghost" onClick={() => setPlanning([...planning, { acao: '', ativo: '', justificativa: '' }])} className="text-[9px] font-black uppercase text-primary border border-primary/20 hover:bg-primary/20 h-8 px-4">Nova Diretriz</Button>
                            </div>
                            <div className="space-y-3 relative z-10">
                               {planning.map((p, i) => (
                                  <div key={i} className="group flex flex-col md:flex-row gap-4 p-4 bg-primary border-primary shadow-sm hover:border-primary transition-all">
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

                         <div className="flex items-center gap-6 py-10 opacity-20">
                            <div className="h-px flex-1 bg-secondary"></div>
                            <FileText size={24} className="text-secondary"/>
                            <div className="h-px flex-1 bg-secondary"></div>
                         </div>

                         <div className="bg-secondary p-4 md:p-12 overflow-x-auto rounded-3xl border-4 border-primary">
                            <div className="bg-white shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] mx-auto rounded-sm overflow-hidden" style={{ width: '840px', minWidth: '840px' }}>
                               <div ref={reportRef} className="p-20 text-[12px]" style={{ backgroundColor: '#fff', color: '#111', fontFamily: 'Arial, Helvetica, sans-serif', lineHeight: '1.6' }}>
                                  
                                  <div className="border-b-[6px] mb-12 pb-8 flex justify-between items-end" style={{ borderBottomColor: '#000' }}>
                                     <div>
                                       <h1 className="text-5xl font-black tracking-tighter" style={{ color: '#000', marginBottom: '8px' }}>RELATÓRIO MENSAL</h1>
                                       <p className="text-[14px] font-black tracking-[0.4em]" style={{ color: '#888' }}>GESTAO DE ALOCAÇÃO PATRIMONIAL</p>
                                     </div>
                                     <div className="text-right">
                                        <p className="text-2xl font-black tracking-tighter" style={{ color: '#000', textTransform: 'uppercase' }}>{clientName}</p>
                                        <p style={{color: '#888', fontSize: '12px', fontWeight: '900', letterSpacing: '0.1em'}}>{activeReportData.month.split('-').reverse().join(' / ')}</p>
                                     </div>
                                  </div>

                                  <h3 className="font-black uppercase mb-6 text-[18px] border-b-[3px] pb-2" style={{ borderColor: "#000", color: "#000" }}>1. SUMÁRIO EXECUTIVO</h3>
                                  <div className="mb-12" style={{ overflow: "hidden", wordWrap: "break-word" }}>
                                     <p className="font-medium text-[14px] leading-relaxed" style={{color: '#222', textAlign: 'justify'}}>
                                        {notes || "Apresentação consolidada da carteira sob custódia, estruturada através do Método Cerrado para fins de rebalanceamento e otimização de rentabilidade histórica."}
                                     </p>
                                  </div>

                                  {(scenarioNotes || nextSteps) && (
                                     <div className="grid grid-cols-2 gap-6 mb-12">
                                        {scenarioNotes && (
                                           <div style={{ overflow: 'hidden', wordWrap: 'break-word' }}>
                                              <p style={{fontSize: '9px', fontWeight: 'bold', color: '#999', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '6px'}}>CENÁRIO ECONÔMICO</p>
                                              <p style={{ fontSize: '11px', color: '#333', lineHeight: '1.6', textAlign: 'justify' }}>{scenarioNotes}</p>
                                           </div>
                                        )}
                                        {nextSteps && (
                                           <div style={{ overflow: 'hidden', wordWrap: 'break-word' }}>
                                              <p style={{fontSize: '9px', fontWeight: 'bold', color: '#999', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '6px'}}>PRÓXIMOS PASSOS</p>
                                              <p style={{ fontSize: '11px', color: '#333', lineHeight: '1.6', textAlign: 'justify' }}>{nextSteps}</p>
                                           </div>
                                        )}
                                     </div>
                                  )}

                                  <h4 className="font-black uppercase mb-4 text-[13px] tracking-[0.2em]" style={{ color: "#000" }}>1.1 TABELA DE REBALANCEAMENTO ESTRUTURAL</h4>
                                  <table className="w-full text-left mb-12 border-collapse" style={{fontSize: '11px'}}>
                                     <thead>
                                        <tr style={{ backgroundColor: '#000', color: '#fff' }}>
                                           <th className="p-4 border border-black uppercase tracking-widest">SETOR / CLASSIFICAÇÃO</th>
                                           <th className="p-4 border border-black text-center">EXPOSIÇÃO (%)</th>
                                           <th className="p-4 border border-black text-center">LIMITE ALVO (%)</th>
                                           <th className="p-4 border border-black text-right">DIRETRIZ DE APORTE</th>
                                        </tr>
                                     </thead>
                                     <tbody>
                                          {(() => {
                                            const activeTotal = activeReportData.total_balance || 1;
                                            const misalignedMacros = liveMacroSectors.map(macro => {
                                               const macroSectorsInGroup = Object.values(pdfRebalanceData).filter(s => s.macro === macro.name);
                                               const macroTotalBal = macroSectorsInGroup.reduce((sum, s) => sum + s.currentBal, 0);
                                               const macroCurrentP = (macroTotalBal / activeTotal) * 100;
                                               const macroDiff = macroCurrentP - (macro.target_percentage * 100);
                                               
                                               if (Math.abs(macroDiff) <= 2) return null;
                                               
                                               const misalignedSectors = macroSectorsInGroup.filter(sec => sec.status !== "Enquadrado");
                                               return { macro, macroCurrentP, macroDiff, misalignedSectors };
                                            }).filter(Boolean);

                                            if (misalignedMacros.length === 0) {
                                              return (
                                                <tr><td colSpan={4} style={{ textAlign: "center", padding: "20px", fontSize: "11px", color: "#888", fontStyle: "italic" }}>
                                                  Todos os setores estão enquadrados. ✓
                                                </td></tr>
                                              );
                                            }

                                            return misalignedMacros.map(row => {
                                               if (!row) return null;
                                               const { macro, macroCurrentP, macroDiff, misalignedSectors } = row;
                                               return (
                                                  <Fragment key={macro.id}>
                                                     <tr style={{ backgroundColor: "#f0f0f0", fontWeight: "bold" }}>
                                                        <td className="p-4 border border-[#eee]">
                                                           <span className="font-black uppercase text-[12px]" style={{color: "#000"}}>{macro.name}</span>
                                                        </td>
                                                        <td className="p-4 border border-[#eee] text-center font-black">{macroCurrentP.toFixed(2)}%</td>
                                                        <td className="p-4 border border-[#eee] text-center font-medium">{(macro.target_percentage * 100).toFixed(2)}%</td>
                                                        <td className="p-4 border border-[#eee] text-right font-black uppercase text-[10px]" style={{ color: macroDiff > 5 ? "#c00" : macroDiff < -5 ? "#060" : "#333" }}>
                                                           {macroDiff > 2 ? "EXCESSO" : "APORTE NECESSÁRIO"}
                                                        </td>
                                                     </tr>
                                                     {misalignedSectors.sort((a,b) => b.currentBal - a.currentBal).map((sec, sidx) => (
                                                        <tr key={sidx} style={{ backgroundColor: "#fff" }}>
                                                           <td className="p-4 border border-[#eee] pl-8">
                                                              <span style={{fontSize: "10px", color: "#555", fontWeight: "bold"}}>{sec.sectorName}</span>
                                                           </td>
                                                           <td className="p-4 border border-[#eee] text-center" style={{fontSize: "10px"}}>{((sec.currentBal / activeTotal) * 100).toFixed(2)}%</td>
                                                           <td className="p-4 border border-[#eee] text-center" style={{fontSize: "10px"}}>{(sec.targetP * 100).toFixed(2)}%</td>
                                                           <td className="p-4 border border-[#eee] text-right uppercase text-[9px]" style={{ color: sec.statusColor }}>{sec.status}</td>
                                                        </tr>
                                                     ))}
                                                  </Fragment>
                                               );
                                            });
                                         })()}
                                          {liveMacroSectors.length === 0 && Object.values(pdfRebalanceData)
                                            .filter(sec => sec.status !== "Enquadrado")
                                            .sort((a,b) => b.currentBal - a.currentBal).map((sec, idx) => (
                                             <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                                                <td className="p-4 border border-[#eee]">
                                                   <span className="font-black uppercase text-[12px]" style={{color: "#000"}}>{sec.macro}</span><br/>
                                                   <span style={{fontSize: "10px", color: "#666", fontWeight: "bold"}}>{sec.sectorName}</span>
                                                </td>
                                                <td className="p-4 border border-[#eee] text-center font-black">{((sec.currentBal / (activeReportData.total_balance||1)) * 100).toFixed(2)}%</td>
                                                <td className="p-4 border border-[#eee] text-center font-medium">{(sec.targetP * 100).toFixed(2)}%</td>
                                                <td className="p-4 border border-[#eee] text-right font-black uppercase text-[10px]" style={{ color: sec.statusColor }}>{sec.status}</td>
                                             </tr>
                                          ))}
                                      </tbody>
                                  </table>

                                  <h3 className="font-black uppercase mb-6 text-[18px] border-b-[3px] pb-2" style={{ borderColor: "#000", color: "#000" }}>2. RESULTADOS CONSOLIDADOS</h3>
                                  
                                  <table className="w-full text-left mb-12 border-collapse" style={{fontSize: '11px'}}>
                                     <thead>
                                        <tr style={{ backgroundColor: '#000', color: '#fff' }}>
                                           <th className="p-4 border border-[#eee]">CLASSE PATRIMONIAL</th>
                                           <th className="p-4 border border-[#eee] text-center">RENT. MÊS (%)</th>
                                           <th className="p-4 border border-[#eee] text-center">RENT. TOTAL (%)</th>
                                           <th className="p-4 border border-[#eee] text-center">YIELD ESTIMADO</th>
                                           <th className="p-4 border border-[#eee] text-right">VALOR CONSOLIDADO</th>
                                        </tr>
                                     </thead>
                                     <tbody>
                                        {sortedTableAData.map((row, idx) => {
                                           const bal = row.balance;
                                           if (row.label !== 'Consolidada' && bal === 0) return null;

                                           return (
                                              <tr key={idx} style={{ backgroundColor: row.label === 'Consolidada' ? '#fafafa' : 'transparent', fontWeight: row.label==='Consolidada'?'900':'normal' }}>
                                                 <td className="p-4 border border-[#eee] font-black">{row.label}</td>
                                                 <td className="p-4 border border-[#eee] text-center">
                                                    <div className="flex flex-col items-center">
                                                       <span className="font-black" style={{fontSize: '13px'}}>{row.rentMês}%</span>
                                                       <span style={{fontSize: '9px', color: '#999', fontWeight: 'bold'}}>{row.benchName || getDefaultBenchName(row.label)}: {row.benchMês}%</span>
                                                    </div>
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
                                        <h3 className="font-black uppercase mb-6 text-[18px] border-b-[3px] pb-2" style={{ borderColor: "#000", color: "#000" }}>3. ANÁLISE COMPARATIVA ({comparisonData.prevMonth})</h3>
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
                                                 {comparisonData.percent >= 0 ? '+' : ''}{formatNumberWithTwoDecimalsBR(comparisonData.percent)}%
                                              </p>
                                           </div>
                                           <div className="p-4 bg-[#f9f9f9] border border-[#eee]">
                                              <p style={{fontSize: '9px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase'}}>Status do Período</p>
                                              <p style={{fontSize: '14px', fontWeight: '900', color: comparisonData.diff >= 0 ? '#10b981' : '#f00', textTransform: 'uppercase'}}>
                                                 {comparisonData.diff >= 0 ? 'Expansão' : 'Retração'}
                                              </p>
                                           </div>
                                        </div>
                                        {/* TOP MOVERS SECTION IN PDF */}
                                        <div className="grid grid-cols-2 gap-8 mb-12">
                                           {(topMoversMonth.gainers.length > 0 || topMoversMonth.losers.length > 0) && (
                                              <div>
                                                 <p className="text-[10px] font-black text-gray-400 mb-4 uppercase tracking-[0.2em]">Maiores Movimentações do Mês</p>
                                                 <div className="grid grid-cols-2 gap-4">
                                                    {topMoversMonth.gainers.length > 0 && (
                                                       <div className="p-4 bg-[#fcfcfc] border border-[#eee]">
                                                          <p className="text-[8px] font-black text-emerald-600 uppercase mb-2">Top Altas</p>
                                                          {topMoversMonth.gainers.map((m, i) => (
                                                             <div key={i} className="flex justify-between items-center py-1 border-b border-[#eee] last:border-0">
                                                                <span className="text-[9px] font-bold text-[#333] truncate pr-2">{m.asset_name}</span>
                                                                <span className="text-[9px] font-black text-emerald-600">+{m.changePercent.toFixed(2)}%</span>
                                                             </div>
                                                          ))}
                                                       </div>
                                                    )}
                                                    {topMoversMonth.losers.length > 0 && (
                                                       <div className="p-4 bg-[#fcfcfc] border border-[#eee]">
                                                          <p className="text-[8px] font-black text-red-600 uppercase mb-2">Top Baixas</p>
                                                          {topMoversMonth.losers.map((m, i) => (
                                                             <div key={i} className="flex justify-between items-center py-1 border-b border-[#eee] last:border-0">
                                                                <span className="text-[9px] font-bold text-[#333] truncate pr-2">{m.asset_name}</span>
                                                                <span className="text-[9px] font-black text-red-600">{m.changePercent.toFixed(2)}%</span>
                                                             </div>
                                                          ))}
                                                       </div>
                                                    )}
                                                 </div>
                                              </div>
                                           )}
                                           
                                           {(topMoversYtd.gainers.length > 0 || topMoversYtd.losers.length > 0) && (
                                              <div>
                                                 <p className="text-[10px] font-black text-gray-400 mb-4 uppercase tracking-[0.2em]">Maiores Movimentações do Ano (YTD)</p>
                                                 <div className="grid grid-cols-2 gap-4">
                                                    {topMoversYtd.gainers.length > 0 && (
                                                       <div className="p-4 bg-[#fcfcfc] border border-[#eee]">
                                                          <p className="text-[8px] font-black text-blue-600 uppercase mb-2">Top Altas</p>
                                                          {topMoversYtd.gainers.map((m, i) => (
                                                             <div key={i} className="flex justify-between items-center py-1 border-b border-[#eee] last:border-0">
                                                                <span className="text-[9px] font-bold text-[#333] truncate pr-2">{m.asset_name}</span>
                                                                <span className="text-[9px] font-black text-blue-600">+{m.changePercent.toFixed(2)}%</span>
                                                             </div>
                                                          ))}
                                                       </div>
                                                    )}
                                                    {topMoversYtd.losers.length > 0 && (
                                                       <div className="p-4 bg-[#fcfcfc] border border-[#eee]">
                                                          <p className="text-[8px] font-black text-orange-600 uppercase mb-2">Top Baixas</p>
                                                          {topMoversYtd.losers.map((m, i) => (
                                                             <div key={i} className="flex justify-between items-center py-1 border-b border-[#eee] last:border-0">
                                                                <span className="text-[9px] font-bold text-[#333] truncate pr-2">{m.asset_name}</span>
                                                                <span className="text-[9px] font-black text-orange-600">{m.changePercent.toFixed(2)}%</span>
                                                             </div>
                                                          ))}
                                                       </div>
                                                    )}
                                                 </div>
                                              </div>
                                           )}
                                        </div>
</>
                                  )}

                                  {/* CHARTS SECTION */}
                                  <h3 className="font-black uppercase mb-6 text-[18px] border-b-[3px] pb-2" style={{ borderColor: "#000", color: "#000" }}>{comparisonData ? "4" : "3"}. ANÁLISE GRÁFICA DA CARTEIRA</h3>
                                  <div style={{marginBottom: '48px'}}>
                                     <ReportCharts
                                        assets={activePdfAssets}
                                        macroSectors={liveMacroSectors}
                                        sectors={liveSectors}
                                       historyReports={historyReports}
                                        totalBalance={activeReportData.total_balance || 1}
                                        compositionDescription={compositionNotes}
                                     />
                                  </div>

                                  {/* 4. PLANNING */}
                                  {planning.length > 0 && (
                                     <>
                                        <h3 className="font-black uppercase mb-6 text-[18px] border-b-[3px] pb-2" style={{ borderColor: "#000", color: "#000" }}>{comparisonData ? '5' : '4'}. PLANEJAMENTO E RECOMENDAÇÕES</h3>
                                        <table className="w-full text-left mb-12 border-collapse" style={{fontSize: '11px'}}>
                                           <thead>
                                              <tr style={{ backgroundColor: '#000', color: '#fff' }}>
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
                                     </>
                                  )}

                                  {/* 4. FEE FOOTER */}
                                  <div className="mt-24">
                                      <h3 className="font-black uppercase mb-6 text-[18px] border-b-[3px] pb-2" style={{ borderColor: "#000", color: "#000" }}>{(comparisonData ? (planning.length > 0 ? 6 : 5) : (planning.length > 0 ? 5 : 4))}. TAXA DE GESTÃO (FEE-BASED)</h3>
                                      <div className="flex justify-between items-end">
                                         <div>
                                            <p className="text-4xl font-black mt-4 tracking-tighter" style={{color: '#000'}}>{formatCurrency(activeReportData.total_balance * (parseFloat(feeRate.replace(',','.')) / 100))}</p>
                                            <p style={{fontSize: '11px', color: '#888', fontWeight: 'bold', marginTop: '4px'}}>Calculado sobre o Patrimônio Total Consolidado Gerido: {feeRate}%</p>
                                         </div>
                                         <div className="text-right" style={{fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', color: '#bbb', letterSpacing: '0.2em'}}>
                                            <p></p>
                                         </div>
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
                fetchClientData(clientId);
            } catch (e) {
                toast.error("Erro ao atualizar data");
            }
          }}
          title="Ajustar Mês de Referência"
       />
    </div>
  );
}
