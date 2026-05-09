import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import ReportCharts from '@/components/ReportCharts';
import PageHeader from '@/components/PageHeader';
import { ChevronLeft, Download, Loader2, BarChart2, Save, Trash2, TrendingUp, Edit2, FileText, Copy } from 'lucide-react';
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
  sector_id?: string; applied_amount?: number; custom_rate?: string; maturity_date?: string;
  monthly_contribution?: number;
  monthly_dividends?: number;
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

interface TableARow {
  label: string;
  rentMês: string;
  benchMês: string; 
  benchName?: string; 
  rentYtd: string;
  rentTotal: string;
  rentInício: string; // legacy field used as Rent Total in some parts
  benchInício?: string;
  yield: string; // Yield on Cost
  yieldCurrent: string; // Current Yield
  balance: number;
}

interface PlanningRow {
  acao: string;
  ativo: string;
  justificativa: string;
}

export default function ConsultingReports({ 
  clientId, 
  selectedMonth, 
  onReportArchived, 
  onMonthChange,
  hideHeader = false 
}: { 
  clientId: string, 
  selectedMonth?: string, 
  onReportArchived?: () => Promise<void> | void, 
  onMonthChange?: (month: string) => void,
  hideHeader?: boolean 
}) {
   const navigate = useNavigate();
   const [clientName, setClientName] = useState<string>('');
  const [liveMacroSectors, setLiveMacroSectors] = useState<PortfolioMacroSector[]>([]);
  const [liveSectors, setLiveSectors] = useState<PortfolioSector[]>([]);
  const [liveAssets, setLiveAssets] = useState<PortfolioAsset[]>([]);
  const [liveTotal, setLiveTotal] = useState(0);

  const [historyReports, setHistoryReports] = useState<ConsultingReport[]>([]);
  const [prevAssets, setPrevAssets] = useState<PortfolioAsset[]>([]);
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
  const [duplicatingReport, setDuplicatingReport] = useState<ConsultingReport | null>(null);
  const [showDuplicationMonthModal, setShowDuplicationMonthModal] = useState(false);
  const [targetDuplicationMonth, setTargetDuplicationMonth] = useState(new Date().toISOString().slice(0, 7));

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (clientId) { 
      fetchClientData(clientId).then(() => {
        if (selectedMonth) {
          loadPdfEngineFor(selectedMonth);
        } else {
          setActiveReportMode('live');
          loadPdfEngineFor('live');
        }
      }); 
    }
    else { setLiveAssets([]); setHistoryReports([]); setLiveSectors([]); }
  }, [clientId, selectedMonth]);

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

      const { data: reportsData } = await supabase.from('consulting_reports').select('*').eq('client_id', clientId).order('month', { ascending: false });
      const history = (reportsData || []) as ConsultingReport[];
      setHistoryReports(history);
      
      if (activeReportMode !== 'none') {
          const sorted = [...history].sort((a, b) => a.month.localeCompare(b.month));
          const currentIdx = activeReportMode === 'live' ? sorted.length : sorted.findIndex(r => r.id === activeReportMode);
          const prevReport = currentIdx > 0 ? sorted[currentIdx - 1] : null;
          if (prevReport) {
             const { data: pa } = await supabase.from('consulting_report_assets').select('*').eq('report_id', prevReport.id);
             setPrevAssets(pa || []);
          } else {
             setPrevAssets([]);
          }
      }

    } catch (err) {} finally { setLoading(false); }
  };

  const calcPerformance = (curr: number, start: number, contrib: number, divs: number, applied: number = 0, assetName: string = '') => {
      let baseStart = start;
      let effectiveContrib = contrib;
      if (start === 0) {
         if (contrib !== 0) baseStart = 0;
         else if (applied > 0) baseStart = applied;
      }
      const isFixedIncome = assetName.toUpperCase().includes('CDB') || 
                          assetName.toUpperCase().includes('TESOURO') || 
                          assetName.toUpperCase().includes('SELIC') || 
                          assetName.toUpperCase().includes('IPCA') || 
                          assetName.toUpperCase().includes('LCI') || 
                          assetName.toUpperCase().includes('LCA') ||
                          assetName.toUpperCase().includes('POUPANÇA') ||
                          assetName.toUpperCase().includes('RENDA FIXA');
      if (baseStart > 0 && contrib === 0) {
         const ratio = curr / baseStart;
         const upThreshold = isFixedIncome ? 1.05 : 1.5;
         if (ratio > upThreshold) effectiveContrib = curr - baseStart;
         const downThreshold = isFixedIncome ? 0.98 : 0.5;
         if (ratio < downThreshold) effectiveContrib = curr - baseStart;
      }
      const profit = curr - baseStart - effectiveContrib + divs;
      let basis = baseStart;
      if (baseStart === 0) basis = Math.abs(effectiveContrib || curr);
      else basis = baseStart + effectiveContrib / 2;
      const safeBasis = Math.max(basis, 0.1);
      const percent = (profit / safeBasis) * 100;
      return { profit, percent, basis: safeBasis };
  };

  const getMacroName = (assetName: string, refAssets: PortfolioAsset[]) => {
    const a = refAssets.find(x => x.asset_name === assetName);
    if (!a) return 'Outros';
    const s = liveSectors.find(ls => ls.id === a.sector_id);
    const m = s ? liveMacroSectors.find(mc => mc.id === s.macro_sector_id) : null;
    return m?.name || s?.macro_category || a.category || 'Outros';
  };

  const computeTopMovers = async (currentAssets: PortfolioAsset[], currentReportId: string) => {
    const currentMonthMovements = currentAssets.map(a => ({
      asset_name: a.asset_name,
      monthly_contribution: a.monthly_contribution,
      monthly_dividends: a.monthly_dividends
    }));
    const currentReport = historyReports.find(r => r.id === currentReportId);
    const sortedHistory = [...historyReports].sort((a, b) => a.month.localeCompare(b.month));
    const currentIdx = sortedHistory.findIndex(r => r.id === currentReportId);
    const prevReport = currentIdx > 0 ? sortedHistory[currentIdx - 1] : null;


    const getMacroMetricsForPeriod = (startAssets: PortfolioAsset[], endAssets: PortfolioAsset[], periodMovements: any[]) => {
      const periodMap: Record<string, { profit: number, basis: number, dividends: number, currBal: number }> = {};
      const allAssetNames = Array.from(new Set([
        ...startAssets.map(a => a.asset_name),
        ...endAssets.map(a => a.asset_name)
      ]));

      allAssetNames.forEach(name => {
        const start = startAssets.find(sa => sa.asset_name === name);
        const end = endAssets.find(ea => ea.asset_name === name);
        const movements = periodMovements.filter(pm => pm.asset_name === name);
        
        const totalContrib = movements.reduce((s, x) => s + (x.monthly_contribution || 0), 0);
        const totalDivs = movements.reduce((s, x) => s + (x.monthly_dividends || 0), 0);
        const endBal = end ? end.current_balance : 0;
        const startBal = start ? start.current_balance : 0;
        
        const { profit, basis } = calcPerformance(endBal, startBal, totalContrib, totalDivs, end?.applied_amount, name);
        
        const key = getMacroName(name, end ? [end] : [start!]);
        if (!periodMap[key]) periodMap[key] = { profit: 0, basis: 0, dividends: 0, currBal: 0 };
        periodMap[key].profit += profit;
        periodMap[key].basis += basis;
        periodMap[key].dividends += totalDivs;
        periodMap[key].currBal += endBal;
      });
      
      return periodMap;
    };

    // 1. Monthly Metrics
    if (prevReport) {
      const { data: prevAssetsData } = await supabase.from('consulting_report_assets').select('*').eq('report_id', prevReport.id);
      const prevAssets = (prevAssetsData || []) as PortfolioAsset[];

      const monthlyMetrics = getMacroMetricsForPeriod(prevAssets, currentAssets, currentAssets.map(a => ({
        asset_name: a.asset_name,
        monthly_contribution: a.monthly_contribution,
        monthly_dividends: a.monthly_dividends
      })));

      setTableA(prevTable => {
        const updated = { ...prevTable };
        Object.entries(monthlyMetrics).forEach(([key, m]) => {
           if (updated[key]) {
              const rent = m.basis > 0 ? (m.profit / m.basis * 100).toFixed(2) : '-';
              const yld = m.basis > 0 ? (m.dividends / m.basis * 100).toFixed(2) : '-';
              const yldCurr = m.currBal > 0 ? (m.dividends / m.currBal * 100).toFixed(2) : '-';
              updated[key] = { ...updated[key], rentMês: rent, yield: yld, yieldCurrent: yldCurr, balance: m.currBal };
           }
        });
        const totalProfit = Object.values(monthlyMetrics).reduce((s, x) => s + x.profit, 0);
        const totalBasis = Object.values(monthlyMetrics).reduce((s, x) => s + x.basis, 0);
        const totalDivs = Object.values(monthlyMetrics).reduce((s, x) => s + x.dividends, 0);
        const totalCurrBal = Object.values(monthlyMetrics).reduce((s, x) => s + x.currBal, 0);
        if (updated['Consolidada']) {
           updated['Consolidada'].rentMês = totalBasis > 10 ? (totalProfit / totalBasis * 100).toFixed(2) : '-';
           updated['Consolidada'].yield = totalBasis > 10 ? (totalDivs / totalBasis * 100).toFixed(2) : '-';
           updated['Consolidada'].yieldCurrent = totalCurrBal > 10 ? (totalDivs / totalCurrBal * 100).toFixed(2) : '-';
           updated['Consolidada'].balance = totalCurrBal;
        }
        return updated;
      });

      // Individual Movers
      const movers: AssetMover[] = currentAssets.map(a => {
        const prev = prevAssets.find(p => p.asset_name === a.asset_name);
        const { profit, percent, basis } = calcPerformance(a.current_balance, prev?.current_balance || 0, a.monthly_contribution || 0, a.monthly_dividends || 0, a.applied_amount);
        
        if (basis <= 10) return null; // Avoid noise for tiny positions
        return { asset_name: a.asset_name, category: a.category, currentBalance: a.current_balance, prevBalance: basis, changePercent: percent, changeValue: profit };
      }).filter(Boolean) as AssetMover[];

      movers.sort((a, b) => b.changePercent - a.changePercent);
      setTopMoversMonth({
         gainers: movers.filter(m => m.changePercent > 0.01).slice(0, 5),
         losers: movers.filter(m => m.changePercent < -0.01).slice(-5).reverse()
      });
    } else {
      setTopMoversMonth({ gainers: [], losers: [] });
    }

    // 2. YTD Metrics
    const currentYear = currentReport?.month?.slice(0, 4) || new Date().getFullYear().toString();
    const janReport = sortedHistory.find(r => r.month.startsWith(`${currentYear}-01`)) || sortedHistory.find(r => r.month.startsWith(currentYear));
    
    if (janReport) {
      const { data: janAssetsData } = await supabase.from('consulting_report_assets').select('*').eq('report_id', janReport.id);
      const janAssets = (janAssetsData || []) as PortfolioAsset[];
      const yearReports = sortedHistory.filter(r => r.month >= janReport.month && r.month <= (currentReport?.month || ''));
      const reportIds = yearReports.map(r => r.id);
      const { data: yearMovements } = await supabase.from('consulting_report_assets').select('asset_name, monthly_contribution, monthly_dividends').in('report_id', reportIds);
      
      // Only add current live movements if we're in live mode. 
      // If we're viewing an archived report, the movements are already in yearMovements.
      const ytdMovements = activeReportMode === 'live' 
        ? [...(yearMovements || []), ...currentMonthMovements]
        : (yearMovements || []);

      // If janReport is the same as current report, YTD performance is the same as Monthly
      // But Monthly is already '-' if it's the first report.
      if (janReport.id !== currentReportId) {
        const ytdMacroMetrics = getMacroMetricsForPeriod(janAssets, currentAssets, ytdMovements);
        setTableA(prev => {
          const u = { ...prev };
          Object.entries(ytdMacroMetrics).forEach(([key, m]) => {
             if (u[key]) u[key].rentYtd = m.basis > 10 ? (m.profit / m.basis * 100).toFixed(2) : '-';
          });
          const totalProfitYtd = Object.values(ytdMacroMetrics).reduce((s, x) => s + x.profit, 0);
          const totalBasisYtd = Object.values(ytdMacroMetrics).reduce((s, x) => s + x.basis, 0);
          if (u['Consolidada']) u['Consolidada'].rentYtd = totalBasisYtd > 10 ? (totalProfitYtd / totalBasisYtd * 100).toFixed(2) : '-';
          return u;
        });
      } else {
        // First month/report: YTD is not applicable
        setTableA(prev => {
          const u = { ...prev };
          Object.keys(u).forEach(k => { u[k].rentYtd = '-'; });
          return u;
        });
      }

      // Individual YTD Movers
      const moversYtd: AssetMover[] = currentAssets.map(a => {
        const jan = janAssets.find(j => j.asset_name === a.asset_name);
        const movements = (yearMovements || []).filter(m => m.asset_name === a.asset_name);
        const totalContrib = movements.reduce((s, x) => s + (x.monthly_contribution || 0), 0);
        const totalDivs = movements.reduce((s, x) => s + (x.monthly_dividends || 0), 0);
        
        const { profit, percent, basis } = calcPerformance(a.current_balance, jan?.current_balance || 0, totalContrib, totalDivs, a.applied_amount, a.asset_name);
        if (basis <= 10) return null;
        return { asset_name: a.asset_name, category: a.category, currentBalance: a.current_balance, prevBalance: basis, changePercent: percent, changeValue: profit };
      }).filter(Boolean) as AssetMover[];

      const soldMovers: AssetMover[] = janAssets.filter(ja => !currentAssets.some(a => a.asset_name === ja.asset_name)).map(ja => {
         const movements = (yearMovements || []).filter(m => m.asset_name === ja.asset_name);
         const totalContrib = movements.reduce((s, x) => s + (x.monthly_contribution || 0), 0);
         const totalDivs = movements.reduce((s, x) => s + (x.monthly_dividends || 0), 0);
         const { profit, percent, basis } = calcPerformance(0, ja.current_balance, totalContrib, totalDivs, 0, ja.asset_name);
         if (basis <= 10) return null;
         return { asset_name: ja.asset_name, category: ja.category, currentBalance: 0, prevBalance: basis, changePercent: percent, changeValue: profit };
      }).filter(Boolean) as AssetMover[];

      const allMoversYtd = [...moversYtd, ...soldMovers].sort((a, b) => b.changePercent - a.changePercent);
      setTopMoversYtd({
        gainers: allMoversYtd.filter(m => m.changePercent > 0.01).slice(0, 5),
        losers: allMoversYtd.filter(m => m.changePercent < -0.01).slice(-5).reverse()
      });
    } else {
      setTopMoversYtd({ gainers: [], losers: [] });
    }

    // 3. Total Metrics (since first closure)
    const firstReport = sortedHistory[0];
    const allMovementsIds = sortedHistory.filter(r => r.month <= (currentReport?.month || '')).map(r => r.id);
    const { data: firstAssetsData } = await supabase.from('consulting_report_assets').select('*').eq('report_id', firstReport.id);
    const firstAssets = (firstAssetsData || []) as PortfolioAsset[];
    const { data: allMovements } = await supabase.from('consulting_report_assets').select('asset_name, monthly_contribution, monthly_dividends').in('report_id', allMovementsIds);
    
    const totalMovements = activeReportMode === 'live'
      ? [...(allMovements || []), ...currentMonthMovements]
      : (allMovements || []);

    if (firstReport.id !== currentReportId) {
      const totalMacroMetrics = getMacroMetricsForPeriod(firstAssets, currentAssets, totalMovements);
      setTableA(prev => {
         const u = { ...prev };
         Object.entries(totalMacroMetrics).forEach(([key, m]) => {
            if (u[key]) u[key].rentTotal = m.basis > 10 ? (m.profit / m.basis * 100).toFixed(2) : '-';
         });
         const totalProfitAll = Object.values(totalMacroMetrics).reduce((s, x) => s + x.profit, 0);
         const totalBasisAll = Object.values(totalMacroMetrics).reduce((s, x) => s + x.basis, 0);
         if (u['Consolidada']) u['Consolidada'].rentTotal = totalBasisAll > 10 ? (totalProfitAll / totalBasisAll * 100).toFixed(2) : '-';
         return u;
      });
    } else {
      // First month/report: Total is not applicable
      setTableA(prev => {
        const u = { ...prev };
        Object.keys(u).forEach(k => { u[k].rentTotal = '-'; });
        return u;
      });
    }
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
      ...Object.fromEntries(Object.entries(prevReport.performance_table!).map(([k, v]) => [k, { ...v, rentMês: '-', rentInício: '-', yield: '-', yieldCurrent: '-' }])),
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
     // Ensure we include all keys that assets actually map to
     const dynamicKeys = [...new Set(assetsArray.map(a => getMacroName(a.asset_name, [a])))];
     const macroNames = liveMacroSectors.length > 0 ? liveMacroSectors.map(m => m.name) : [];
     
     // Merge both: explicit macros + any other keys found in assets
     const macros = [...new Set(['Consolidada', ...macroNames, ...dynamicKeys])];
     
     const newTable: Record<string, TableARow> = {};
     const lastReport = historyReports.length > 0 ? historyReports[historyReports.length - 1] : null;

     macros.forEach(m => {
          const pastRow = lastReport?.performance_table?.[m];
          const curAssets = assetsArray.filter(a => getMacroName(a.asset_name, [a]) === m);
          const curBal = m === 'Consolidada' 
             ? assetsArray.reduce((s, a) => s + a.current_balance, 0)
             : curAssets.reduce((s, a) => s + a.current_balance, 0);

          newTable[m] = {
             label: m,
             rentMês: '-', 
             benchMês: pastRow?.benchMês || '-',
             benchName: pastRow?.benchName || getDefaultBenchName(m),
             rentYtd: '-',
             rentTotal: '-',
             rentInício: '-', 
             benchInício: pastRow?.benchInício || '-',
             yield: '-',
             yieldCurrent: '-',
             balance: curBal
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
            report_id: newReport.id, 
            asset_name: a.asset_name, 
            category: a.category, 
            current_balance: Math.round(a.current_balance * 100) / 100,
            target_percentage: Math.round((a.target_percentage || 0) * 10000) / 10000,
            sector_id: a.sector_id, 
            applied_amount: a.applied_amount ? Math.round(a.applied_amount * 100) / 100 : null, 
            custom_rate: a.custom_rate, 
            maturity_date: a.maturity_date,
            monthly_contribution: Math.round((a.monthly_contribution || 0) * 100) / 100,
            monthly_dividends: Math.round((a.monthly_dividends || 0) * 100) / 100
         }));
        await supabase.from('consulting_report_assets').insert(frozenAssets);
        alert('Mês arquivado com sucesso!');
        if (onReportArchived) await onReportArchived();
        fetchClientData(clientId);
        if (onMonthChange) onMonthChange(newReport.id);
     } catch (err) {
        console.error(err);
        alert('Erro ao arquivar mês');
     } finally { setSavingMonth(false); }
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
         if (onReportArchived) await onReportArchived();
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
          if (activeReportMode === reportId) {
             if (onMonthChange) onMonthChange('live');
          }
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

   const handleDuplicateReport = async (report: ConsultingReport) => {
      setDuplicatingReport(report);
      setTargetDuplicationMonth(report.month);
      setShowDuplicationMonthModal(true);
   };

   const confirmDuplication = async (targetMonth: string) => {
      if (!duplicatingReport || !clientId) return;
      
      const isTargetLive = targetMonth === 'live';

      if (isTargetLive) {
         if (!window.confirm(`Isso irá substituir todos os ativos da Posição Atual (Live) pelos dados do fechamento de ${duplicatingReport.month}. Deseja continuar?`)) return;
      } else if (historyReports.some(r => r.month === targetMonth)) {
         if(!window.confirm(`Já existe um fechamento em ${targetMonth}. Deseja substituí-lo pelos dados de ${duplicatingReport.month}?`)) return;
      } else {
         if(!window.confirm(`Deseja duplicar o fechamento de ${duplicatingReport.month} para ${targetMonth}?`)) return;
      }

      setSavingMonth(true);
      try {
         const { data: assetsToClone } = await supabase.from('consulting_report_assets').select('*').eq('report_id', duplicatingReport.id);
         
         if (isTargetLive) {
            await supabase.from('portfolio_assets').delete().eq('client_id', clientId);
            
            if (assetsToClone && assetsToClone.length > 0) {
               const liveAssets = assetsToClone.map(a => ({
                  client_id: clientId,
                  asset_name: a.asset_name,
                  category: a.category,
                  current_balance: a.current_balance,
                  target_percentage: a.target_percentage || 0,
                  sector_id: a.sector_id,
                  applied_amount: a.applied_amount,
                  custom_rate: a.custom_rate,
                  maturity_date: a.maturity_date,
                  monthly_contribution: a.monthly_contribution || 0,
                  monthly_dividends: a.monthly_dividends || 0
               }));
               await supabase.from('portfolio_assets').insert(liveAssets);
            }
            toast.success('Posição Live atualizada com sucesso!');
         } else {
            const existing = historyReports.find(r => r.month === targetMonth);
            if (existing) {
               await supabase.from('consulting_reports').delete().eq('id', existing.id);
            }

            const { data: newReport, error: repErr } = await supabase.from('consulting_reports').insert([{ 
               client_id: clientId, 
               month: targetMonth, 
               total_balance: duplicatingReport.total_balance, 
               notes: duplicatingReport.notes,
               performance_table: duplicatingReport.performance_table,
               planning_actions: duplicatingReport.planning_actions
            }]).select().single();
            
            if (repErr) throw repErr;

            if (assetsToClone && assetsToClone.length > 0) {
               const frozenAssets = assetsToClone.map(a => ({
                  report_id: newReport.id, 
                  asset_name: a.asset_name, 
                  category: a.category, 
                  current_balance: a.current_balance,
                  target_percentage: a.target_percentage || 0,
                  sector_id: a.sector_id, 
                  applied_amount: a.applied_amount, 
                  custom_rate: a.custom_rate, 
                  maturity_date: a.maturity_date,
                  monthly_contribution: a.monthly_contribution || 0,
                  monthly_dividends: a.monthly_dividends || 0
               }));
               await supabase.from('consulting_report_assets').insert(frozenAssets);
            }
            toast.success('Relatório duplicado com sucesso!');
         }

         if (onReportArchived) await onReportArchived();
         setShowDuplicationMonthModal(false);
         fetchClientData(clientId);
      } catch (err) {
         console.error(err);
         toast.error('Erro na duplicação');
      } finally { setSavingMonth(false); }
   };


  const loadPdfEngineFor = async (mode: 'live' | string) => {
     setActiveReportMode(mode); setNotes(''); setScenarioNotes(''); setNextSteps('');
     setTopMoversMonth({ gainers: [], losers: [] });
     setTopMoversYtd({ gainers: [], losers: [] });
     
     const sorted = [...historyReports].sort((a, b) => a.month.localeCompare(b.month));
     const currentIdx = mode === 'live' ? sorted.length : sorted.findIndex(r => r.id === mode);
     const prevReport = currentIdx > 0 ? sorted[currentIdx - 1] : null;
     if (prevReport) {
        const { data: pa } = await supabase.from('consulting_report_assets').select('*').eq('report_id', prevReport.id);
        setPrevAssets(pa || []);
     } else {
        setPrevAssets([]);
     }

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

           const calculatedTotal = assetsFromSnapshot.reduce((acc, a) => acc + (a.current_balance || 0), 0);
           if (Math.abs(calculatedTotal - rep.total_balance) > 0.1) {
              await supabase.from('consulting_reports').update({ total_balance: calculatedTotal }).eq('id', rep.id);
              setHistoryReports(prev => prev.map(r => r.id === rep.id ? { ...r, total_balance: calculatedTotal } : r));
              setActiveReportData({ ...rep, total_balance: calculatedTotal });
           }
           
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

           computeTopMovers(assetsFromSnapshot, rep.id);
        }
     }
  };


   const comparisonData = useMemo(() => {
     if (!activeReportData) return null;
     
     const sorted = [...historyReports].sort((a, b) => a.month.localeCompare(b.month));
     const currentIndex = sorted.findIndex(r => r.id === activeReportData.id);
     
     const prevReport = currentIndex > 0 ? sorted[currentIndex - 1] : 
                        (activeReportMode === 'live' && sorted.length > 0 ? sorted[sorted.length - 1] : null);
     
     if (!prevReport) return null;
     
     let totalContributions = 0;
     let totalDividends = 0;
     let totalProfit = 0;
     let totalBasis = 0;


      activePdfAssets.forEach(a => {
         const p = prevAssets.find(pa => pa.asset_name === a.asset_name);
         const contrib = a.monthly_contribution || 0;
         const divs = a.monthly_dividends || 0;

         if (p) {
            totalContributions += contrib;
            totalDividends += divs;
            totalProfit += (a.current_balance - p.current_balance - contrib + divs);
            totalBasis += p.current_balance;
         } else {
            const initial = a.applied_amount || a.current_balance;
            totalContributions += (initial + contrib);
            totalDividends += divs;
            totalProfit += (a.current_balance - initial - contrib + divs);
            totalBasis += initial;
         }
      });

      prevAssets.forEach(p => {
         if (!activePdfAssets.some(a => a.asset_name === p.asset_name)) {
            totalContributions -= p.current_balance;
            totalBasis += p.current_balance;
         }
      });

      const currentTotal = activeReportMode === 'live' ? liveTotal : activeReportData.total_balance;
      const nominalChange = currentTotal - prevReport.total_balance;
      const yieldPercent = totalBasis > 0 ? (totalDividends / totalBasis * 100) : 0;
      const rentPercent = totalBasis > 0 ? (totalProfit / totalBasis * 100) : 0;
     
     return {
        prevBalance: prevReport.total_balance,
        diff: totalProfit,
        yieldPercent,
        percent: rentPercent,
        nominalChange,
        totalContributions,
        totalDividends,
        prevMonth: prevReport.month,
        benchmarks: [
           { label: 'CDI', value: '—' },
           { label: 'IBOV', value: '—' },
           { label: 'S&P500', value: '—' },
           { label: 'IFIX', value: '—' }
        ]
     };
   }, [activeReportData, historyReports, activeReportMode, activePdfAssets, prevAssets, liveTotal]);

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

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

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
     const sorted = [...historyReports].sort((a, b) => a.month.localeCompare(b.month));
     let data = sorted.map(r => ({ month: formatMonthShort(r.month), Patrimônio: r.total_balance }));
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


  if (loading && !clientId) return <div className="flex justify-center p-20"><Loader text="Sincronizando dados..." /></div>;

  return (
    <div className="min-h-screen bg-secondary/30">
      {!hideHeader && (
        <PageHeader 
          title="Relatórios de Consultoria"
          subtitle={`Cliente: ${clientName}`}
          action={
            <Button onClick={() => navigate(-1)} variant="ghost" size="sm" className="flex items-center gap-2">
               <ChevronLeft size={16} /> Voltar
            </Button>
          }
        />
      )}
      
      <div className={`${hideHeader ? 'p-0' : 'p-4 lg:p-8'} space-y-6 animate-page-enter`}>
          <Card className="p-6 bg-primary relative overflow-hidden group border-primary shadow-none w-full">
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

          <div className="space-y-4">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
                <h3 className="text-xs font-semibold text-secondary uppercase tracking-widest pl-1 opacity-60 flex items-center gap-2">
                   <FileText size={14} /> Histórico de Fechamentos
                </h3>
                <Button 
                   onClick={handleSaveMonth} 
                   disabled={savingMonth || !clientId} 
                   variant="outline" 
                   size="sm"
                   className="w-full sm:w-auto flex items-center justify-center gap-2 border-primary/20 hover:bg-primary/5 transition-all font-black text-[10px] uppercase tracking-widest px-6 h-10 sm:h-9"
                >
                   {savingMonth ? <Loader2 size={14} className="animate-spin" /> : <Save size={14}/>}
                   <span>Arquivar Mês Atual</span>
                </Button>
             </div>
             
             <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 custom-scrollbar -mx-1">
                  <div 
                     onClick={() => onMonthChange ? onMonthChange('live') : loadPdfEngineFor('live')}
                     className={`flex-shrink-0 w-48 p-4 rounded-xl border transition-all cursor-pointer group relative shadow-none ${activeReportMode === 'live' ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-primary bg-primary hover:bg-tertiary'}`}
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
                        key={r.id} onClick={() => onMonthChange ? onMonthChange(r.id) : loadPdfEngineFor(r.id)}
                        className={`flex-shrink-0 w-48 p-4 rounded-xl border transition-all cursor-pointer group relative shadow-none ${activeReportMode === r.id ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-primary bg-primary hover:bg-tertiary'}`}
                     >
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                           <button 
                              onClick={(e) => { e.stopPropagation(); handleDuplicateReport(r); }}
                              className="p-1 rounded-md bg-primary/50 hover:bg-primary text-secondary hover:text-primary border border-primary/20 transition-all"
                              title="Duplicar fechamento"
                           >
                              <Copy size={10} />
                           </button>
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
                            <h2 className="text-ui-heading">Editor de Relatório</h2>
                            <p className="text-secondary text-fluid-xs font-bold">Configurando emissão para <span className="text-primary font-black">{activeReportData.month}</span></p>
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
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in zoom-in duration-500">
                            <Card className="p-4 bg-primary border-primary shadow-none">
                               <p className="text-fluid-xs font-black text-secondary uppercase tracking-widest mb-1">Evolução Nominal</p>
                               <div className="flex items-center gap-2">
                                  <p className={`text-ui-value ${comparisonData.nominalChange >= 0 ? 'text-primary' : 'text-danger'}`}>
                                     {comparisonData.nominalChange >= 0 ? '+' : ''}{formatCurrency(comparisonData.nominalChange)}
                                  </p>
                               </div>
                               <p className="text-[9px] text-secondary/40 font-bold uppercase mt-1">Saldo Final vs Mês Anterior</p>
                            </Card>
                            
                            <Card className="p-4 bg-primary border-primary shadow-none">
                               <p className="text-fluid-xs font-black text-secondary uppercase tracking-widest mb-1">Movimentação Líquida</p>
                               <p className={`text-ui-value ${comparisonData.totalContributions >= 0 ? 'text-income' : 'text-danger'}`}>
                                  {comparisonData.totalContributions >= 0 ? '+' : ''}{formatCurrency(comparisonData.totalContributions)}
                               </p>
                               <p className="text-[9px] text-secondary/40 font-bold uppercase mt-1">Total Aportes e Vendas</p>
                            </Card>

                            <Card className="p-4 bg-primary border-primary shadow-none">
                               <p className="text-fluid-xs font-black text-secondary uppercase tracking-widest mb-1">Rendimentos</p>
                               <div className="flex items-center gap-2">
                                  <p className="text-ui-value text-income">
                                     +{formatCurrency(comparisonData.totalDividends)}
                                  </p>
                                  <TrendingUp size={16} className="text-income"/>
                               </div>
                               <p className="text-[9px] text-secondary/40 font-bold uppercase mt-1">Proventos do Período</p>
                            </Card>

                            <Card className="p-4 bg-primary border-primary shadow-none">
                               <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Rentabilidade Real (Orgânica)</p>
                               <div className="flex items-center gap-2">
                                  <p className={`text-ui-value ${comparisonData.percent >= 0 ? 'text-income' : 'text-danger'}`}>
                                     {comparisonData.percent >= 0 ? '+' : ''}{formatNumberWithTwoDecimalsBR(comparisonData.percent)}%
                                  </p>
                                  <p className={`text-[10px] font-bold ${comparisonData.diff >= 0 ? 'text-income' : 'text-danger'}`}>
                                     ({comparisonData.diff >= 0 ? '+' : ''}{formatCurrency(comparisonData.diff)})
                                  </p>
                               </div>
                               <p className="text-[9px] text-secondary/40 font-bold uppercase mt-1">Ganhos de Capital + Dividendos</p>
                            </Card>
                         </div>
                      )}

                      <div className="space-y-6">
                         <div className="space-y-4">
                             <Card className="hidden md:block p-0 overflow-hidden bg-primary border-primary shadow-none">
                            <div className="bg-tertiary p-4 border-b border-primary">
                               <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest">Balanço de Performance Consolidado (Tabela A)</h4>
                            </div>
                            <div className="overflow-x-auto custom-scrollbar">
                               <table className="w-full text-left border-collapse min-w-[700px]">
                                  <thead>
                                     <tr className="text-[10px] text-secondary uppercase font-semibold border-b border-primary bg-secondary">
                                        <th className="p-4">Carteira / Classe</th>
                                        <th className="p-4 text-center">Mês de Referência (%)</th>
                                        <th className="p-4 text-center">Year to Date (YTD)</th>
                                        <th className="p-4 text-center">Rentabilidade Total (%)</th>
                                        <th className="p-4 text-center">Índice (Bench)</th>
                                        <th className="p-4 text-center text-income">Yield Cost (%)</th>
                                        <th className="p-4 text-center text-primary">Yield Current (%)</th>
                                     </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--color-border)]">
                                     {sortedTableAData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-tertiary transition-colors group">
                                           <td className="p-4">
                                              <span className={`text-sm font-bold ${row.label === 'Consolidada' ? 'text-primary' : 'text-primary/70'}`}>{row.label}</span>
                                           </td>
                                           <td className="p-4 text-center">
                                              <span className={`text-sm font-black ${parseFloat(row.rentMês) >= 0 ? 'text-income' : 'text-danger'}`}>
                                                 {row.rentMês !== '-' && row.rentMês !== '' ? (parseFloat(row.rentMês) >= 0 ? `+${row.rentMês}%` : `${row.rentMês}%`) : '-'}
                                              </span>
                                           </td>
                                           <td className="p-4 text-center">
                                              <span className={`text-sm font-black ${parseFloat(row.rentYtd) >= 0 ? 'text-income' : 'text-danger'}`}>
                                                 {row.rentYtd !== '-' && row.rentYtd !== '' ? (parseFloat(row.rentYtd) >= 0 ? `+${row.rentYtd}%` : `${row.rentYtd}%`) : '-'}
                                              </span>
                                           </td>
                                           <td className="p-4 text-center">
                                              <span className={`text-sm font-black ${parseFloat(row.rentTotal) >= 0 ? 'text-income' : 'text-danger'}`}>
                                                 {row.rentTotal !== '-' && row.rentTotal !== '' ? (parseFloat(row.rentTotal) >= 0 ? `+${row.rentTotal}%` : `${row.rentTotal}%`) : '-'}
                                              </span>
                                           </td>
                                           <td className="p-4 text-center">
                                              <div className="flex flex-col items-center">
                                                 <span className="text-xs font-bold text-secondary">{row.benchMês !== '-' ? row.benchMês + '%' : '-'}</span>
                                                 <span className="text-[9px] text-secondary/40 font-bold uppercase">{row.benchName}</span>
                                              </div>
                                           </td>
                                           <td className="p-4 text-center">
                                              <span className="text-xs font-black text-income">
                                                 {row.yield !== '-' && row.yield !== '' ? `${row.yield}%` : '-'}
                                              </span>
                                           </td>
                                           <td className="p-4 text-center">
                                              <span className="text-xs font-black text-primary">
                                                 {row.yieldCurrent !== '-' && row.yieldCurrent !== '' ? `${row.yieldCurrent}%` : '-'}
                                              </span>
                                           </td>
                                        </tr>
                                     ))}
                                  </tbody>
                               </table>
                            </div>
                         </Card>

                         <div className="md:hidden space-y-4">
                            <div className="px-1">
                               <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest opacity-60">Balanço de Performance (Tabela A)</h4>
                            </div>
                            {sortedTableAData.map((row, idx) => (
                               <Card key={idx} className="p-4 bg-primary border-primary shadow-none space-y-4">
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
                                        <label className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40">Mês Ref. (%)</label>
                                        <div className={`text-sm font-black ${parseFloat(row.rentMês) >= 0 ? 'text-income' : 'text-danger'}`}>
                                           {row.rentMês !== '-' ? (parseFloat(row.rentMês) >= 0 ? `+${row.rentMês}%` : `${row.rentMês}%`) : '-'}
                                        </div>
                                     </div>
                                     <div className="space-y-1">
                                        <label className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40">YTD (%)</label>
                                        <div className={`text-sm font-black ${parseFloat(row.rentYtd) >= 0 ? 'text-income' : 'text-danger'}`}>
                                           {row.rentYtd !== '-' ? (parseFloat(row.rentYtd) >= 0 ? `+${row.rentYtd}%` : `${row.rentYtd}%`) : '-'}
                                        </div>
                                     </div>
                                     <div className="space-y-1">
                                        <label className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40">Total (%)</label>
                                        <div className={`text-sm font-black ${parseFloat(row.rentTotal) >= 0 ? 'text-income' : 'text-danger'}`}>
                                           {row.rentTotal !== '-' ? (parseFloat(row.rentTotal) >= 0 ? `+${row.rentTotal}%` : `${row.rentTotal}%`) : '-'}
                                        </div>
                                     </div>
                                     <div className="space-y-1">
                                        <label className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40">Bench (%)</label>
                                        <div className="text-xs font-bold text-secondary">
                                           {row.benchMês}% <span className="text-[8px] opacity-40">({row.benchName})</span>
                                        </div>
                                     </div>
                                     <div className="space-y-1">
                                        <div className="text-[10px] text-secondary/40 uppercase font-black">Yield Cost</div>
                                        <div className="text-xs font-black text-income">{row.yield !== '-' ? `${row.yield}%` : '-'}</div>
                                     </div>
                                     <div className="space-y-1">
                                        <div className="text-[10px] text-secondary/40 uppercase font-black">Yield Curr.</div>
                                        <div className="text-xs font-black text-primary">{row.yieldCurrent !== '-' ? `${row.yieldCurrent}%` : '-'}</div>
                                     </div>
                                  </div>
                               </Card>
                            ))}
                         </div>
                      </div>

                         {(topMoversMonth.gainers.length > 0 || topMoversMonth.losers.length > 0) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {([{t:'Top Altas Mês',l:topMoversMonth.gainers,c:'text-emerald-400'},{t:'Top Baixas Mês',l:topMoversMonth.losers,c:'text-red-400'}] as {t:string,l:typeof topMoversMonth.gainers,c:string}[]).map(({t,l,c})=>(
                                  <Card key={t} className="p-4 bg-primary border-primary shadow-none">
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
                         {(topMoversYtd.gainers.length > 0 || topMoversYtd.losers.length > 0) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {([{t:'Top Altas Ano (YTD)',l:topMoversYtd.gainers,c:'text-blue-400'},{t:'Top Baixas Ano (YTD)',l:topMoversYtd.losers,c:'text-orange-400'}] as {t:string,l:typeof topMoversYtd.gainers,c:string}[]).map(({t,l,c})=>(
                                  <Card key={t} className="p-4 bg-primary border-primary shadow-none">
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
                            <Card className="p-6 bg-primary border-primary shadow-none col-span-1 md:col-span-2">
                               <div className="flex justify-between items-center mb-3">
                                  <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest">Sumário Executivo</h4>
                                  <button onClick={() => setNotes(generateAutoSuggestions(activePdfAssets, comparisonData))} className="text-[10px] text-primary border border-primary/20 px-3 py-1 rounded-lg hover:bg-primary/10 transition-all font-bold">✨ Auto-sugerir</button>
                               </div>
                               <textarea className="w-full bg-tertiary border border-primary text-primary rounded-2xl p-4 min-h-[80px] outline-none focus:border-primary transition-all text-sm leading-relaxed scrollbar-hide" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Sumário executivo e análise técnica..." />
                            </Card>
                            <Card className="p-6 bg-primary border-primary shadow-none">
                               <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-3">Cenário Econômico</h4>
                               <textarea className="w-full bg-tertiary border border-primary text-primary rounded-2xl p-4 min-h-[80px] outline-none focus:border-primary transition-all text-sm leading-relaxed scrollbar-hide" value={scenarioNotes} onChange={e=>setScenarioNotes(e.target.value)} placeholder="Análise macro: juros, inflação, câmbio..." />
                            </Card>
                            <Card className="p-6 bg-primary border-primary shadow-none">
                               <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-3">Próximos Passos</h4>
                               <textarea className="w-full bg-tertiary border border-primary text-primary rounded-2xl p-4 min-h-[80px] outline-none focus:border-primary transition-all text-sm leading-relaxed scrollbar-hide" value={nextSteps} onChange={e=>setNextSteps(e.target.value)} placeholder="Diretrizes para o próximo ciclo..." />
                            </Card>
                            <Card className="p-6 bg-primary border-primary shadow-none col-span-1 md:col-span-2">
                               <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-3">Descrição da Composição Alvo</h4>
                               <textarea className="w-full bg-tertiary border border-primary text-primary rounded-2xl p-4 min-h-[80px] outline-none focus:border-primary transition-all text-sm leading-relaxed scrollbar-hide" value={compositionNotes} onChange={e=>setCompositionNotes(e.target.value)} placeholder="Comentários sobre a alocação atual vs alvo..." />
                            </Card>
                         </div>
                         <div className="w-full">
                             <Card className="p-6 bg-primary border-primary shadow-none">
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

                         <Card className="p-6 bg-primary border-primary shadow-none relative overflow-hidden">
                            <div className="flex justify-between items-center mb-6 relative z-10">
                               <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest">Diretriz de Ações Para o Próximo Ciclo</h4>
                               <Button size="sm" variant="ghost" onClick={() => setPlanning([...planning, { acao: '', ativo: '', justificativa: '' }])} className="text-[9px] font-black uppercase text-primary border border-primary/20 hover:bg-primary/20 h-8 px-4">Nova Diretriz</Button>
                            </div>
                            <div className="space-y-3 relative z-10">
                               {planning.map((p, i) => (
                                  <div key={i} className="group flex flex-col md:flex-row gap-4 p-4 bg-primary border-primary shadow-none hover:border-primary transition-all">
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
                                                        <tr key={sidx} style={{ backgroundColor: "var(--color-tertiary)" }}>
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
                                                   <span className="text-black font-black uppercase text-[12px]">{sec.macro}</span><br/>
                                                   <span className="text-slate-600" style={{fontSize: "10px", fontWeight: "bold"}}>{sec.sectorName}</span>
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
                                        <tr style={{ borderBottom: '1px solid #eee', fontSize: '8pt', color: '#666', textTransform: 'uppercase' }}>
                                         <th style={{ padding: '8pt', textAlign: 'left' }}>Carteira / Classe</th>
                                         <th style={{ padding: '8pt', textAlign: 'center' }}>Mês Ref. (%)</th>
                                         <th style={{ padding: '8pt', textAlign: 'center' }}>YTD (%)</th>
                                         <th style={{ padding: '8pt', textAlign: 'center' }}>Total (%)</th>
                                         <th style={{ padding: '8pt', textAlign: 'center' }}>Bench (%)</th>
                                         <th style={{ padding: '8pt', textAlign: 'center' }}>Yield Cost</th>
                                         <th style={{ padding: '8pt', textAlign: 'center' }}>Yield Current</th>
                                         <th style={{ padding: '8pt', textAlign: 'right' }}>Valor Consolidado</th>
                                      </tr>
                                     </thead>
                                     <tbody>
                                        {sortedTableAData.map((row, idx) => {
                                           const bal = row.balance;
                                           if (row.label !== 'Consolidada' && bal === 0) return null;

                                           return (
                                              <tr key={idx} style={{ backgroundColor: row.label === 'Consolidada' ? '#fafafa' : 'transparent', fontWeight: row.label==='Consolidada'?'900':'normal' }}>
                                                 <td style={{ padding: '8pt', fontWeight: 'bold' }}>{row.label}</td>
                                                 <td style={{ padding: '8pt', textAlign: 'center', fontWeight: 'bold', color: parseFloat(row.rentMês) >= 0 ? '#10b981' : '#ef4444' }}>
                                                   {row.rentMês !== '-' ? (parseFloat(row.rentMês) >= 0 ? `+${row.rentMês}%` : `${row.rentMês}%`) : '-'}
                                                </td>
                                                <td style={{ padding: '8pt', textAlign: 'center', fontWeight: 'bold', color: parseFloat(row.rentYtd) >= 0 ? '#10b981' : '#ef4444' }}>
                                                   {row.rentYtd !== '-' ? (parseFloat(row.rentYtd) >= 0 ? `+${row.rentYtd}%` : `${row.rentYtd}%`) : '-'}
                                                </td>
                                                <td style={{ padding: '8pt', textAlign: 'center', fontWeight: 'bold', color: parseFloat(row.rentTotal) >= 0 ? '#10b981' : '#ef4444' }}>
                                                   {row.rentTotal !== '-' ? (parseFloat(row.rentTotal) >= 0 ? `+${row.rentTotal}%` : `${row.rentTotal}%`) : '-'}
                                                </td>
                                                <td style={{ padding: '8pt', textAlign: 'center' }}>
                                                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                      <span style={{ fontWeight: 'bold', color: '#333' }}>{row.benchMês !== '-' ? row.benchMês + '%' : '-'}</span>
                                                      <span style={{ fontSize: '6pt', color: '#999' }}>{row.benchName}</span>
                                                   </div>
                                                </td>
                                                <td style={{ padding: '8pt', textAlign: 'center', fontWeight: 'bold', color: '#10b981' }}>{row.yield !== '-' ? `${row.yield}%` : '-'}</td>
                                                <td style={{ padding: '8pt', textAlign: 'center', fontWeight: 'bold', color: '#2563eb' }}>{row.yieldCurrent !== '-' ? `${row.yieldCurrent}%` : '-'}</td>
                                                 <td style={{ padding: '8pt', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(bal)}</td>
                                              </tr>
                                           );
                                        })}
                                     </tbody>
                                  </table>

                                  {/* 3. MOVIMENTAÇÕES DO MÊS */}
                                  {comparisonData && (
                                     <>
                                        <h3 className="font-black uppercase mb-6 text-[18px] border-b-[3px] pb-2" style={{ borderColor: "#000", color: "#000" }}>3. MOVIMENTAÇÕES DO MÊS ({comparisonData.prevMonth.split('-').reverse().join('/')})</h3>
                                        <div className="grid grid-cols-4 gap-4 mb-6">
                                           <div className="p-4 border border-[#eee]">
                                              <p style={{fontSize: '8px', fontWeight: '900', color: '#888', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px'}}>Rentabilidade Nominal</p>
                                              <p style={{fontSize: '16px', fontWeight: '900', color: comparisonData.diff >= 0 ? '#000' : '#d00'}}>
                                                 {comparisonData.diff >= 0 ? '+' : ''}{formatCurrency(comparisonData.diff)}
                                              </p>
                                              <p style={{fontSize: '8px', color: '#bbb', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase'}}>({comparisonData.percent >= 0 ? '+' : ''}{comparisonData.percent.toFixed(2)}%)</p>
                                           </div>
                                           <div className="p-4 border border-[#eee]">
                                              <p style={{fontSize: '8px', fontWeight: '900', color: '#888', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px'}}>Aporte Líquido</p>
                                              <p style={{fontSize: '16px', fontWeight: '900', color: comparisonData.totalContributions >= 0 ? '#10b981' : '#d00'}}>
                                                 {comparisonData.totalContributions >= 0 ? '+' : ''}{formatCurrency(comparisonData.totalContributions)}
                                              </p>
                                              <p style={{fontSize: '8px', color: '#bbb', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase'}}>Total Aportes - Vendas</p>
                                           </div>
                                           <div className="p-4 border border-[#eee]">
                                              <p style={{fontSize: '8px', fontWeight: '900', color: '#888', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px'}}>Proventos Recebidos</p>
                                              <p style={{fontSize: '16px', fontWeight: '900', color: '#000'}}>
                                                 {formatCurrency(comparisonData.totalDividends)}
                                              </p>
                                              <p style={{fontSize: '8px', color: '#bbb', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase'}}>Dividend Yield: {comparisonData.yieldPercent.toFixed(2)}%</p>
                                           </div>
                                           <div className="p-4 border border-[#eee]">
                                              <p style={{fontSize: '8px', fontWeight: '900', color: '#888', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px'}}>Rentabilidade do Período</p>
                                              <p style={{fontSize: '16px', fontWeight: '900', color: comparisonData.percent >= 0 ? '#000' : '#d00'}}>
                                                 {comparisonData.percent >= 0 ? '+' : ''}{comparisonData.percent.toFixed(2)}%
                                              </p>
                                              <p style={{fontSize: '8px', color: '#bbb', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase'}}>Ganho Real: {formatCurrency(comparisonData.diff)}</p>
                                           </div>
                                        </div>

                                        {activePdfAssets.some(a => (a.monthly_contribution || 0) !== 0 || (a.monthly_dividends || 0) !== 0) && (
                                           <div className="mb-12">
                                              <p style={{fontSize: '9px', fontWeight: '900', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px'}}>Detalhamento por Ativo</p>
                                              <table className="w-full text-left border-collapse" style={{fontSize: '10px'}}>
                                                 <thead>
                                                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                                                       <th className="p-2 border border-[#ddd] font-black uppercase tracking-wider">Ativo</th>
                                                       <th className="p-2 border border-[#ddd] text-center font-black uppercase tracking-wider">Saldo Anterior</th>
                                                       <th className="p-2 border border-[#ddd] text-center font-black uppercase tracking-wider">Aporte / Venda</th>
                                                       <th className="p-2 border border-[#ddd] text-center font-black uppercase tracking-wider">Proventos</th>
                                                       <th className="p-2 border border-[#ddd] text-right font-black uppercase tracking-wider">Saldo Final</th>
                                                    </tr>
                                                 </thead>
                                                 <tbody>
                                                    {activePdfAssets
                                                       .filter(a => (a.monthly_contribution || 0) !== 0 || (a.monthly_dividends || 0) !== 0)
                                                       .map((a, i) => {
                                                          const contr = a.monthly_contribution || 0;
                                                          const div = a.monthly_dividends || 0;
                                                          const prevBal = a.current_balance - contr;
                                                          return (
                                                             <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                                                <td className="p-2 border border-[#eee] font-bold" style={{color: '#222'}}>{a.asset_name}</td>
                                                                <td className="p-2 border border-[#eee] text-center" style={{color: '#555'}}>{formatCurrency(prevBal)}</td>
                                                                <td className="p-2 border border-[#eee] text-center font-bold" style={{color: contr >= 0 ? '#10b981' : '#d00'}}>
                                                                   {contr !== 0 ? `${contr >= 0 ? '+' : ''}${formatCurrency(contr)}` : '—'}
                                                                </td>
                                                                <td className="p-2 border border-[#eee] text-center font-bold" style={{color: '#10b981'}}>
                                                                   {div !== 0 ? `+${formatCurrency(div)}` : '—'}
                                                                </td>
                                                                <td className="p-2 border border-[#eee] text-right font-black" style={{color: '#000'}}>{formatCurrency(a.current_balance)}</td>
                                                             </tr>
                                                          );
                                                       })}
                                                 </tbody>
                                              </table>
                                           </div>
                                        )}
                                        
                                        <div className="grid grid-cols-2 gap-8 mb-4">
                                           {(topMoversMonth.gainers.length > 0 || topMoversMonth.losers.length > 0) && (
                                              <div>
                                                 <p className="text-[10px] font-black text-gray-400 mb-4 uppercase tracking-[0.2em]">Maiores Movimentações do Mês</p>
                                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                  <div style={{marginBottom: '24px'}}>
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
                    null
                )}
             </div>
          </div>
       


       <MonthPickerModal
          isOpen={showDuplicationMonthModal}
          onClose={() => setShowDuplicationMonthModal(false)}
          value={targetDuplicationMonth}
          onChange={(val) => {
             setTargetDuplicationMonth(val);
             confirmDuplication(val);
          }}
          showLiveOption={true}
          title="Duplicar para qual mês?"
       />

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
