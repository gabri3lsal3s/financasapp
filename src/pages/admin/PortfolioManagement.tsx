import { useState, useEffect, useMemo, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, FolderPlus, Edit2, Trash2, Plus, Settings, Loader2, Pencil, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Modal from '@/components/Modal';
import ModalActionFooter from '@/components/ModalActionFooter';
import Loader from '@/components/Loader';
import PageHeader from '@/components/PageHeader';
import { formatCurrency, parseMoneyInput, formatMoneyInput, formatNumberWithTwoDecimalsBR } from '@/utils/format';

interface PortfolioMacroSector {
  id: string;
  client_id: string;
  name: string;
  target_percentage: number;
}

interface PortfolioSector {
  id: string;
  client_id: string;
  macro_sector_id: string | null;
  macro_category: string;
  sector_name: string;
  target_percentage: number;
}

interface PortfolioAsset {
  id: string;
  client_id: string;
  sector_id: string | null;
  category: string;
  asset_name: string;
  current_balance: number;
  target_percentage: number; // legacy
  applied_amount?: number;
  custom_rate?: string;
  maturity_date?: string;
  monthly_contribution?: number;
  monthly_dividends?: number;
}

interface Client {
  id: string;
  name: string;
}



interface PortfolioManagementProps {
  clientId: string;
  selectedMonth?: string;
  onReportArchived?: () => Promise<void> | void;
  hideHeader?: boolean;
}

export default function PortfolioManagement({ clientId, selectedMonth = 'live', onReportArchived, hideHeader = false }: PortfolioManagementProps) {
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  
  const [macroSectors, setMacroSectors] = useState<PortfolioMacroSector[]>([]);
  const [sectors, setSectors] = useState<PortfolioSector[]>([]);
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  
  const [cashBalance, setCashBalance] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Visualization States
  // const [collapsedMacros, setCollapsedMacros] = useState<Set<string>>(new Set());
  const [showMacroManagerModal, setShowMacroManagerModal] = useState(false);
  const [editingMacro, setEditingMacro] = useState<PortfolioMacroSector | null>(null);
  const [macroForm, setMacroForm] = useState({ name: '', target_percentage: '' });

  // Sector States
  const [showSectorModal, setShowSectorModal] = useState(false);
  const [editingSector, setEditingSector] = useState<PortfolioSector | null>(null);
  const [sectorForm, setSectorForm] = useState({ macro_category: 'Ações Nacionais', sector_name: '', target_percentage: '' });

  // Asset States
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<PortfolioAsset | null>(null);
  const [assetForm, setAssetForm] = useState({
      sector_id: '', asset_name: '', current_balance: '',
      applied_amount: '', custom_rate: '', maturity_date: '',
      monthly_contribution: '', monthly_dividends: ''
   });

  // Movement States
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [allHistoricalAssets, setAllHistoricalAssets] = useState<any[]>([]);
  const [importSearch, setImportSearch] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [movementForm, setMovementForm] = useState({
     asset_id: '',
     contribution: '',
     dividends: ''
  });

  // Quick Update State
  const [showQuickUpdateModal, setShowQuickUpdateModal] = useState(false);
  const [quickUpdateBalances, setQuickUpdateBalances] = useState<Record<string, string>>({});
  const [quickUpdateContributions, setQuickUpdateContributions] = useState<Record<string, string>>({});
  const [quickUpdateDividends, setQuickUpdateDividends] = useState<Record<string, string>>({});
  const [initialQuickUpdateBalances, setInitialQuickUpdateBalances] = useState<Record<string, number>>({});
  const [modifiedAssetIds, setModifiedAssetIds] = useState<Set<string>>(new Set());
  const [savingRowIds, setSavingRowIds] = useState<Set<string>>(new Set());
  const [dirtyAssetIds, setDirtyAssetIds] = useState<Set<string>>(new Set());
  const [quickUpdateSearch, setQuickUpdateSearch] = useState('');

  useEffect(() => {
    if (clientId) fetchPortfolio();
  }, [clientId, selectedMonth]);

   const openImportModal = async () => {
      setLoadingHistory(true);
      setShowImportModal(true);
      try {
         const { data: reports } = await supabase.from('consulting_reports').select('id, month').eq('client_id', clientId).order('month', { ascending: false });
         if (reports && reports.length > 0) {
            const reportIds = reports.map(r => r.id);
            const { data: histAssets } = await supabase.from('consulting_report_assets').select('*').in('report_id', reportIds);
            const sortedAssets = (histAssets || []).map(a => {
               const r = reports.find(rep => rep.id === a.report_id);
               return { ...a, month: r?.month || '' };
            }).sort((a,b) => b.month.localeCompare(a.month));

            const unique: any[] = [];
            const seen = new Set();
            for (const a of sortedAssets) {
               if (!seen.has(a.asset_name)) {
                  unique.push(a);
                  seen.add(a.asset_name);
               }
            }
            setAllHistoricalAssets(unique);
         }
      } catch (e) {
         console.error(e);
      } finally {
         setLoadingHistory(false);
      }
   };

   const handleImportAsset = (asset: any) => {
      setAssetForm({
         sector_id: asset.sector_id || '',
         asset_name: asset.asset_name,
         current_balance: '0,00',
         applied_amount: asset.applied_amount ? formatMoneyInput(asset.applied_amount) : '',
         custom_rate: asset.custom_rate || '',
         maturity_date: asset.maturity_date || '',
         monthly_contribution: '',
         monthly_dividends: ''
      });
      setShowImportModal(false);
      setShowAssetModal(true);
   };

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const { data: clientData, error: clientErr } = await supabase.from('consulting_clients').select('id, name').eq('id', clientId).single();
      if (clientErr) throw clientErr;
      setClient(clientData);

      const { data: sectorsData, error: secErr } = await supabase.from('portfolio_sectors').select('*').eq('client_id', clientId).order('sector_name');
      if (secErr) throw secErr;
      setSectors(sectorsData || []);

      const { data: macrosData, error: macErr } = await supabase.from('portfolio_macro_sectors').select('*').eq('client_id', clientId).order('name');
      if (macErr) throw macErr;
      setMacroSectors(macrosData || []);

      if (selectedMonth === 'live') {
         const { data: assetsData, error: astErr } = await supabase.from('portfolio_assets').select('*').eq('client_id', clientId).order('asset_name');
         if (astErr) throw astErr;
         setAssets(assetsData || []);
      } else {
         const { data: assetsData, error: astErr } = await supabase.from('consulting_report_assets').select('*').eq('report_id', selectedMonth).order('asset_name');
         if (astErr) throw astErr;
         setAssets(assetsData || []);
      }


    } catch (err) {
      console.error(err);
      alert('Erro ao carregar os dados');
    } finally {
      setLoading(false);
    }
  };

  const totalInWallet = useMemo(() => assets.reduce((acc, curr) => acc + curr.current_balance, 0), [assets]);
  const totalDividends = useMemo(() => assets.reduce((acc, curr) => acc + (curr.monthly_dividends || 0), 0), [assets]);
  const parsedCash = parseMoneyInput(cashBalance);
  const futureTotal = totalInWallet + (Number.isNaN(parsedCash) ? 0 : parsedCash);

  // Modals Openers
  const openSectorModal = (sector?: PortfolioSector) => {
     if (sector) {
        setEditingSector(sector);
        setSectorForm({
           macro_category: sector.macro_category,
           sector_name: sector.sector_name,
           target_percentage: formatNumberWithTwoDecimalsBR(sector.target_percentage * 100)
        });
     } else {
        setEditingSector(null);
        setSectorForm({ macro_category: 'Ações Nacionais', sector_name: '', target_percentage: '' });
     }
     setShowSectorModal(true);
  };

  const openAssetModal = (asset?: PortfolioAsset, defaultSectorId?: string) => {
     if (asset) {
        setEditingAsset(asset);
        setAssetForm({
           sector_id: asset.sector_id || '',
           asset_name: asset.asset_name,
           current_balance: formatNumberWithTwoDecimalsBR(asset.current_balance),
           applied_amount: asset.applied_amount ? formatMoneyInput(asset.applied_amount) : '',
           custom_rate: asset.custom_rate || '',
           maturity_date: asset.maturity_date || '',
            monthly_contribution: asset.monthly_contribution ? formatMoneyInput(asset.monthly_contribution) : '',
            monthly_dividends: asset.monthly_dividends ? formatMoneyInput(asset.monthly_dividends) : ''
         });
     } else {
        setEditingAsset(null);
        setAssetForm({
            sector_id: defaultSectorId || '', asset_name: '', current_balance: '',
            applied_amount: '', custom_rate: '', maturity_date: '',
            monthly_contribution: '', monthly_dividends: ''
         });
     }
     setShowAssetModal(true);
  };

  const openMacroManager = (macro?: PortfolioMacroSector) => {
     if (macro) {
        setEditingMacro(macro);
        setMacroForm({
           name: macro.name,
           target_percentage: formatNumberWithTwoDecimalsBR(macro.target_percentage * 100)
        });
     } else {
        setEditingMacro(null);
        setMacroForm({ name: '', target_percentage: '' });
     }
  };

  const openQuickUpdate = () => {
     const balances: Record<string, string> = {};
     const initialBalances: Record<string, number> = {};
     const contributions: Record<string, string> = {};
     const dividends: Record<string, string> = {};
     assets.forEach(a => { 
       balances[a.id] = formatNumberWithTwoDecimalsBR(a.current_balance);
       initialBalances[a.id] = a.current_balance;
       contributions[a.id] = formatNumberWithTwoDecimalsBR(a.monthly_contribution || 0);
       dividends[a.id] = formatNumberWithTwoDecimalsBR(a.monthly_dividends || 0);
     });
     setQuickUpdateBalances(balances);
     setInitialQuickUpdateBalances(initialBalances);
     setQuickUpdateContributions(contributions);
     setQuickUpdateDividends(dividends);
     setModifiedAssetIds(new Set());
     setSavingRowIds(new Set());
     setDirtyAssetIds(new Set());
     setShowQuickUpdateModal(true);
   };

  const saveQuickUpdateRow = async (id: string) => {
    let bal = parseMoneyInput(quickUpdateBalances[id]);
    let contr = parseMoneyInput(quickUpdateContributions[id]);
    let div = parseMoneyInput(quickUpdateDividends[id]);
    
    if (Number.isNaN(bal)) bal = 0;
    if (Number.isNaN(contr)) contr = 0;
    if (Number.isNaN(div)) div = 0;

    setSavingRowIds(prev => new Set(prev).add(id));

    try {
      const tableName = selectedMonth === 'live' ? 'portfolio_assets' : 'consulting_report_assets';
      
      const { data, error } = await supabase.from(tableName).update({ 
        current_balance: bal,
        monthly_contribution: contr,
        monthly_dividends: div
      }).eq('id', id).select().single();

      if (error) throw error;

      setAssets(prev => prev.map(a => a.id === id ? data : a));
      setDirtyAssetIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setModifiedAssetIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      
      if (selectedMonth !== 'live') {
         const newTotal = assets.reduce((sum, a) => sum + (a.id === id ? bal : a.current_balance), 0);
         await supabase.from('consulting_reports').update({ total_balance: newTotal }).eq('id', selectedMonth);
         if (onReportArchived) onReportArchived();
      }
    } catch(e) {
      console.error(e);
    } finally {
      setSavingRowIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const saveQuickUpdate = async () => {
     setShowQuickUpdateModal(false);
  };


  // Validations
  const macroTargetSum = useMemo(() => macroSectors.reduce((sum, m) => sum + m.target_percentage, 0), [macroSectors]);
  const isMacroTargetValid = Math.abs(macroTargetSum - 1) < 0.001 || macroSectors.length === 0;




  // Handle Sector Save
  const handleSaveSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectorForm.sector_name || !clientId) return;
    setSaving(true);
    
    let target = parseMoneyInput(sectorForm.target_percentage);
    if(Number.isNaN(target)) target = 0;
    const finalTarget = target / 100;

    const selectedMacro = macroSectors.find(m => m.name === sectorForm.macro_category);

    try {
      if (editingSector) {
         const { data, error } = await supabase.from('portfolio_sectors')
            .update({ 
               macro_category: sectorForm.macro_category, 
               macro_sector_id: selectedMacro?.id || null,
               sector_name: sectorForm.sector_name, 
               target_percentage: finalTarget 
            })
            .eq('id', editingSector.id).select();
         if (error) throw error;
         setSectors(sectors.map(s => s.id === editingSector.id ? data[0] : s));
      } else {
         const { data, error } = await supabase.from('portfolio_sectors').insert([{
            client_id: clientId,
            macro_category: sectorForm.macro_category,
            macro_sector_id: selectedMacro?.id || null,
            sector_name: sectorForm.sector_name,
            target_percentage: finalTarget
         }]).select();
         if (error) throw error;
         setSectors([...sectors, data[0]]);
      }
      setShowSectorModal(false);
    } catch (err) {
      alert("Erro ao salvar setor");
    } finally {
      setSaving(false);
    }
  };



  const handleSaveMacro = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!macroForm.name || !clientId) return;
     setSaving(true);
     
     let target = parseMoneyInput(macroForm.target_percentage);
     if(Number.isNaN(target)) target = 0;
     const finalTarget = target / 100;

     try {
       if (editingMacro) {
          const { data, error } = await supabase.from('portfolio_macro_sectors')
             .update({ name: macroForm.name, target_percentage: finalTarget })
             .eq('id', editingMacro.id).select();
          if (error) throw error;
          setMacroSectors(macroSectors.map(m => m.id === editingMacro.id ? data[0] : m));
       } else {
          const { data, error } = await supabase.from('portfolio_macro_sectors').insert([{
             client_id: clientId,
             name: macroForm.name,
             target_percentage: finalTarget
          }]).select();
          if (error) throw error;
          setMacroSectors([...macroSectors, data[0]]);
       }
       setShowMacroManagerModal(false);
     } catch (err) {
       alert("Erro ao salvar classe");
     } finally {
       setSaving(false);
     }
  };

  const handleDeleteMacro = async (id: string) => {
     const hasSectors = sectors.some(s => s.macro_sector_id === id);
     if (hasSectors) {
        alert("Não é possível excluir uma classe que possui setores/grupos vinculados. Remova ou altere os setores primeiro.");
        return;
     }
     if(!window.confirm('Excluir esta classe de ativos?')) return;
     try {
        await supabase.from('portfolio_macro_sectors').delete().eq('id', id);
        setMacroSectors(macroSectors.filter(m => m.id !== id));
     } catch(e) {
        alert("Erro ao excluir classe");
     }
  };

  /*
  const toggleMacroCollapse = (macroKey: string) => {
     const newCollapsed = new Set(collapsedMacros);
     if (newCollapsed.has(macroKey)) {
        newCollapsed.delete(macroKey);
     } else {
        newCollapsed.add(macroKey);
     }
     setCollapsedMacros(newCollapsed);
  };
  */

  // Handle Asset Save
  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetForm.asset_name || !clientId || !assetForm.sector_id) {
       alert("Preencha todos os campos obrigatórios."); return;
    }
    setSaving(true);

    const parentSector = sectors.find(s => s.id === assetForm.sector_id);
    if(!parentSector) return;

    let balance = parseMoneyInput(assetForm.current_balance);
    let applied = parseMoneyInput(assetForm.applied_amount);
    
    const assetPayload = {
        client_id: clientId,
        sector_id: parentSector.id,
        category: parentSector.macro_category,
        asset_name: assetForm.asset_name,
        current_balance: Number.isNaN(balance) ? 0 : balance,
        target_percentage: editingAsset ? editingAsset.target_percentage : 0,
        applied_amount: Number.isNaN(applied) ? null : applied,
        custom_rate: assetForm.custom_rate,
        maturity_date: assetForm.maturity_date,
        monthly_contribution: Number.isNaN(parseMoneyInput(assetForm.monthly_contribution)) ? 0 : parseMoneyInput(assetForm.monthly_contribution),
         monthly_dividends: Number.isNaN(parseMoneyInput(assetForm.monthly_dividends)) ? 0 : parseMoneyInput(assetForm.monthly_dividends)
      };

    try {
       const tableName = selectedMonth === 'live' ? 'portfolio_assets' : 'consulting_report_assets';
       const payload = { ...assetPayload };
       
       if (selectedMonth !== 'live') {
          // @ts-ignore
          payload.report_id = selectedMonth;
          // @ts-ignore
          delete payload.client_id;
       }

       if (editingAsset) {
          const { data, error } = await supabase.from(tableName)
             .update(payload).eq('id', editingAsset.id).select();
          if (error) throw error;
          setAssets(assets.map(a => a.id === editingAsset.id ? data[0] : a));
       } else {
          const { data, error } = await supabase.from(tableName).insert([payload]).select();
          if (error) throw error;
          setAssets(prev => [...prev, { ...data[0], target_percentage: data[0].target_percentage ?? 0 }]);
       }

       if (selectedMonth !== 'live') {
          const newTotal = (editingAsset 
             ? assets.map(a => a.id === editingAsset.id ? { ...a, current_balance: payload.current_balance } : a)
             : [...assets, { current_balance: payload.current_balance }]).reduce((sum, a) => sum + a.current_balance, 0);
          await supabase.from('consulting_reports').update({ total_balance: newTotal }).eq('id', selectedMonth);
          if (onReportArchived) onReportArchived();
       }

       setShowAssetModal(false);
     } catch(err) {
        console.error(err);
        alert("Erro ao salvar ativo");
     } finally {
       setSaving(false);
     }
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!movementForm.asset_id || !clientId) return;
      setSaving(true);
      
      const asset = assets.find(a => a.id === movementForm.asset_id);
      if (!asset) return;

      const contribution = parseMoneyInput(movementForm.contribution) || 0;
      const dividends = parseMoneyInput(movementForm.dividends) || 0;
      
      // Update balance automatically: New = Current + Contribution
      const newBalance = asset.current_balance + contribution;

      try {
         const tableName = selectedMonth === 'live' ? 'portfolio_assets' : 'consulting_report_assets';
         
         const { data, error } = await supabase.from(tableName)
            .update({ 
               current_balance: newBalance,
               monthly_contribution: (asset.monthly_contribution || 0) + contribution,
               monthly_dividends: (asset.monthly_dividends || 0) + dividends
            })
            .eq('id', asset.id)
            .select()
            .single();

         if (error) throw error;

         setAssets(assets.map(a => a.id === asset.id ? data : a));
         
         if (selectedMonth !== 'live') {
            const newTotal = assets.map(a => a.id === asset.id ? { ...a, current_balance: newBalance } : a).reduce((sum, a) => sum + a.current_balance, 0);
            await supabase.from('consulting_reports').update({ total_balance: newTotal }).eq('id', selectedMonth);
            if (onReportArchived) onReportArchived();
         }

         setShowMovementModal(false);
         setMovementForm({ asset_id: '', contribution: '', dividends: '' });
      } catch (err) {
         alert("Erro ao salvar movimentação");
      } finally {
         setSaving(false);
      }
   };

  const handleUpdateAssetBalance = async (id: string, value: string) => {
     let num = parseMoneyInput(value);
     if (Number.isNaN(num)) num = 0;
     setAssets(assets.map(a => a.id === id ? { ...a, current_balance: num } : a));
     try {
        if (selectedMonth === 'live') {
           await supabase.from('portfolio_assets').update({ current_balance: num }).eq('id', id);
        } else {
           await supabase.from('consulting_report_assets').update({ current_balance: num }).eq('id', id);
           const updatedAssets = assets.map(a => a.id === id ? num : a.current_balance);
           const newTotal = updatedAssets.reduce((acc, curr) => acc + curr, 0);
           await supabase.from('consulting_reports').update({ total_balance: newTotal }).eq('id', selectedMonth);
           if (onReportArchived) onReportArchived();
        }
     } catch(e) {}
  };

  /** Saves the asset's target_percentage to DB (called onBlur to allow free typing). */
  const handleUpdateAssetTarget = async (id: string, rawValue: string) => {
     let num = parseMoneyInput(rawValue);
     if (Number.isNaN(num)) num = 0;
     const finalVal = num / 100;
     setAssets(assets.map(a => a.id === id ? { ...a, target_percentage: finalVal } : a));
     const tableName = selectedMonth === 'live' ? 'portfolio_assets' : 'consulting_report_assets';
     await supabase.from(tableName).update({ target_percentage: finalVal }).eq('id', id);
  };

  const handleDeleteAsset = async (id: string) => {
    if (!window.confirm('Excluir ativo?')) return;
    setAssets(assets.filter(a => a.id !== id));
     const tableName = selectedMonth === 'live' ? 'portfolio_assets' : 'consulting_report_assets';
     await supabase.from(tableName).delete().eq('id', id);

     if (selectedMonth !== 'live') {
        const newTotal = assets.filter(a => a.id !== id).reduce((sum, a) => sum + a.current_balance, 0);
        await supabase.from('consulting_reports').update({ total_balance: newTotal }).eq('id', selectedMonth);
        if (onReportArchived) onReportArchived();
     }
     
     setShowAssetModal(false);
  };


  const getSectorStatus = (diffTargetVsCurrent: number) => {
     if (diffTargetVsCurrent < -0.05) return { label: 'Excesso Crítico', color: 'text-expense' };
     if (diffTargetVsCurrent < -0.02) return { label: 'Excesso', color: 'text-warning' };
     if (diffTargetVsCurrent > 0.05) return { label: 'Prioridade de Aporte', color: 'text-income' };
     if (diffTargetVsCurrent > 0.02) return { label: 'Aporte Secundário', color: 'text-balance' };
     return { label: 'Enquadrado', color: 'text-secondary' };
  };

  const allocationSuggestions = useMemo(() => {
        const suggest: Record<string, number> = {};
        const aporte = parseMoneyInput(cashBalance);
        if (Number.isNaN(aporte) || aporte <= 0) return suggest;

        const futureTotal = totalInWallet + aporte;

        // 1. Allocation at Macro Class level
        let totalMacroGaps = 0;
        const macroGaps: Record<string, number> = {};
        
        macroSectors.forEach(m => {
            const macroSectorsList = sectors.filter(s => s.macro_sector_id === m.id);
            const macroAssets = assets.filter(a => macroSectorsList.some(s => s.id === a.sector_id));
            const currentBal = macroAssets.reduce((sum, a) => sum + a.current_balance, 0);
            
            const targetVal = futureTotal * m.target_percentage;
            const gap = Math.max(0, targetVal - currentBal);
            
            if (gap > 0) {
                macroGaps[m.id] = gap;
                totalMacroGaps += gap;
            }
        });

        if (totalMacroGaps > 0) {
            macroSectors.forEach(m => {
                suggest[m.id] = macroGaps[m.id] ? (macroGaps[m.id] / totalMacroGaps) * aporte : 0;
            });
        } else if (macroSectors.length > 0) { // Fallback if no specific positive gap
            const targetSum = macroSectors.reduce((sum, m) => sum + m.target_percentage, 0);
            macroSectors.forEach(m => {
                suggest[m.id] = targetSum > 0 ? (m.target_percentage / targetSum) * aporte : (aporte / macroSectors.length);
            });
        }

        // 2. Distribute from Macro down to its Sectors
        macroSectors.forEach(m => {
            const macroAlloc = suggest[m.id] || 0;
            if (macroAlloc <= 0) return;

            // What the macro CLASS should have in absolute value after aporte
            const macroSectorsList = sectors.filter(s => s.macro_sector_id === m.id);
            const macroAssets = assets.filter(a => macroSectorsList.some(s => s.id === a.sector_id));
            const macroCurrentBal = macroAssets.reduce((sum, a) => sum + a.current_balance, 0);
            // Target absolute balance for this macro class after aporte
            const macroTargetBal = futureTotal * m.target_percentage;

            let totalSectorGaps = 0;
            const sectorGaps: Record<string, number> = {};

            macroSectorsList.forEach(s => {
                const sectorAssets = assets.filter(a => a.sector_id === s.id);
                const currentBal = sectorAssets.reduce((sum, a) => sum + a.current_balance, 0);
                // sector.target_percentage is relative to the macro class
                const targetVal = macroTargetBal * s.target_percentage;
                const gap = Math.max(0, targetVal - currentBal);
                if (gap > 0) {
                    sectorGaps[s.id] = gap;
                    totalSectorGaps += gap;
                }
            });

            macroSectorsList.forEach(s => {
                if (totalSectorGaps > 0 && sectorGaps[s.id]) {
                    suggest[s.id] = (sectorGaps[s.id] / totalSectorGaps) * macroAlloc;
                } else if (totalSectorGaps === 0) {
                    // Fallback: distribute by target % or equally
                    const targetSum = macroSectorsList.reduce((sum, sec) => sum + sec.target_percentage, 0);
                    if (targetSum > 0) {
                        suggest[s.id] = (s.target_percentage / targetSum) * macroAlloc;
                    } else if (macroSectorsList.length > 0) {
                        suggest[s.id] = macroAlloc / macroSectorsList.length;
                    } else {
                        suggest[s.id] = 0;
                    }
                } else {
                    suggest[s.id] = 0;
                }
            });

            // Suppress unused var warning
            void macroCurrentBal;
        });

        // 3. Distribute from Sector down to its Assets
        sectors.forEach(s => {
            const sectorAlloc = suggest[s.id] || 0;
            if (sectorAlloc <= 0) return;

            const sectorAssets = assets.filter(a => a.sector_id === s.id);
            if (sectorAssets.length === 0) return;

            // Find the parent macro to get its target balance
            const parentMacro = macroSectors.find(m => m.id === s.macro_sector_id);
            const macroTargetBal = parentMacro ? futureTotal * parentMacro.target_percentage : 0;

            let totalAssetGaps = 0;
            const assetGaps: Record<string, number> = {};

            sectorAssets.forEach(a => {
                // asset.target_percentage is relative to the macro class
                const targetVal = macroTargetBal > 0 ? macroTargetBal * a.target_percentage : 0;
                const gap = Math.max(0, targetVal - a.current_balance);
                if (gap > 0) {
                    assetGaps[a.id] = gap;
                    totalAssetGaps += gap;
                }
            });

            sectorAssets.forEach(a => {
                if (totalAssetGaps > 0 && assetGaps[a.id]) {
                    suggest[a.id] = (assetGaps[a.id] / totalAssetGaps) * sectorAlloc;
                } else if (totalAssetGaps === 0) {
                    // Distribute equally among assets
                    suggest[a.id] = sectorAlloc / sectorAssets.length;
                } else {
                    suggest[a.id] = 0;
                }
            });
        });

        // Return the composed suggestions object mapping id -> suggested value
        return suggest;
   }, [cashBalance, assets, sectors, macroSectors, totalInWallet]);

  const groupedData = useMemo(() => {
         const mappedMacros = macroSectors.map(macro => {
            const macroSectorsList = sectors.filter(s => s.macro_sector_id === macro.id);
            const macroAssets = assets.filter(a => macroSectorsList.some(s => s.id === a.sector_id));
            const currentBal = macroAssets.reduce((sum, a) => sum + a.current_balance, 0);
            // Macro class gapPercent is relative to TOTAL WALLET (for sorting macros against each other)
            const currentPercent = totalInWallet > 0 ? (currentBal / totalInWallet) : 0;
            const gapPercent = macro.target_percentage - currentPercent;

            const items = macroSectorsList.map(sector => {
               const sectorAssets = assets.filter(a => a.sector_id === sector.id);
               const sCurrentBal = sectorAssets.reduce((sum, a) => sum + a.current_balance, 0);
               // Sector exposure relative to its MACRO CLASS balance
               const sCurrentPercent = currentBal > 0 ? (sCurrentBal / currentBal) : 0;
               const sGapPercent = sector.target_percentage - sCurrentPercent;

               const mappedAssets = sectorAssets.map(asset => {
                  // Asset exposure relative to its MACRO CLASS balance
                  const aCurrentPercent = currentBal > 0 ? (asset.current_balance / currentBal) : 0;
                  const aGapPercent = asset.target_percentage - aCurrentPercent;
                  return { ...asset, gapPercent: aGapPercent };
               }).sort((a, b) => b.gapPercent - a.gapPercent);

               return { sector, gapPercent: sGapPercent, assets: mappedAssets };
            }).sort((a, b) => b.gapPercent - a.gapPercent);

            return { macroKey: macro.id, macro, gapPercent, items };
         });

         const orphanSectors = sectors.filter(s => !s.macro_sector_id);
         const orphanAssets = assets.filter(a => !a.sector_id || !sectors.some(s => s.id === a.sector_id));
         
         type GroupItem = { macroKey: string; macro: PortfolioMacroSector | null; gapPercent: number; items: { sector: PortfolioSector; gapPercent: number; assets: (PortfolioAsset & { gapPercent: number })[] }[] };

         const sortedMacros: GroupItem[] = mappedMacros.sort((a, b) => b.gapPercent - a.gapPercent);

         if (orphanSectors.length > 0 || orphanAssets.length > 0) {
             const orphanItems = orphanSectors.map(sector => {
               const sectorAssets = assets.filter(a => a.sector_id === sector.id);
               const sCurrentBal = sectorAssets.reduce((sum, a) => sum + a.current_balance, 0);
               const sCurrentPercent = totalInWallet > 0 ? (sCurrentBal / totalInWallet) : 0;
               const sGapPercent = sector.target_percentage - sCurrentPercent;

               const mappedAssets = sectorAssets.map(asset => {
                  const aCurrentPercent = totalInWallet > 0 ? (asset.current_balance / totalInWallet) : 0;
                  const aGapPercent = asset.target_percentage - aCurrentPercent;
                  return { ...asset, gapPercent: aGapPercent };
               }).sort((a, b) => b.gapPercent - a.gapPercent);

               return { sector, gapPercent: sGapPercent, assets: mappedAssets };
            });

            if (orphanAssets.length > 0) {
                const mappedOrphans = orphanAssets.map(asset => {
                   const aCurrentPercent = totalInWallet > 0 ? (asset.current_balance / totalInWallet) : 0;
                   const aGapPercent = asset.target_percentage - aCurrentPercent;
                   return { ...asset, gapPercent: aGapPercent };
                }).sort((a, b) => b.gapPercent - a.gapPercent);

                orphanItems.push({
                   sector: { id: 'orphan', client_id: '', macro_sector_id: null, macro_category: 'Sem Setor', sector_name: 'Antigos Ativos', target_percentage: 0 } as PortfolioSector,
                   gapPercent: -999,
                   assets: mappedOrphans
                });
            }
            
            orphanItems.sort((a, b) => b.gapPercent - a.gapPercent);

            sortedMacros.push({
                macroKey: 'orphans',
                macro: null,
                gapPercent: -999, 
                items: orphanItems
            });
         }
         
         return sortedMacros;
      }, [sectors, assets, macroSectors, totalInWallet]);


  if (loading) return <div className="flex justify-center py-20"><Loader text="Carregando..." /></div>;
  if (!client) return <div>Cliente não encontrado</div>;

  return (
    <div className="min-h-screen bg-secondary/30">
      {!hideHeader && (
        <PageHeader 
          title="Gestão de Carteira"
          subtitle={`Cliente: ${client?.name || '...'}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => navigate(-1)} variant="ghost" size="sm" className="flex items-center gap-2">
                 <ChevronLeft size={16} /> Voltar
              </Button>
              <Button onClick={() => openSectorModal()} variant="outline" size="sm" className="flex items-center gap-2">
                 <FolderPlus size={16} /> <span className="hidden sm:inline">Novo Grupo</span>
              </Button>
              <Button onClick={() => { if(sectors.length===0){ alert('Crie um Setor antes!'); return; } openAssetModal() }} variant="outline" size="sm" className="flex items-center gap-2">
                 <Plus size={16} /> <span className="hidden sm:inline">Novo Ativo</span>
              </Button>
              <Button onClick={() => setShowMacroManagerModal(true)} variant="outline" size="sm" className="flex items-center gap-2 border-primary/30">
                 <Settings size={16} /> <span className="hidden sm:inline">Classes</span>
              </Button>
              
              {selectedMonth === 'live' ? (
                  <div className="flex items-center gap-2 ml-2">
                     <Button onClick={openImportModal} variant="outline" size="sm" className="flex items-center gap-2 border-primary/30">
                        <Search size={16} /> <span className="hidden sm:inline">Importar</span>
                     </Button>
                     <Button onClick={() => setShowMovementModal(true)} variant="outline" size="sm" className="flex items-center gap-2 border-primary/30">
                        <Plus size={16} /> Movimentação
                     </Button>
                     <Button onClick={openQuickUpdate} variant="primary" size="sm" className="flex items-center gap-2 font-bold shadow-lg shadow-primary/20">
                        <Edit2 size={16} /> Atualização Rápida
                     </Button>
                  </div>
               ) : (
                  <div className="flex items-center gap-2 ml-2">
                     <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-warning/10 text-warning text-[10px] font-black border border-warning/20 uppercase tracking-widest">
                        ⚠️ Histórico
                     </div>
                     <Button onClick={openImportModal} variant="outline" size="sm" className="flex items-center gap-2 border-primary/30">
                        <Search size={16} /> <span className="hidden sm:inline">Importar</span>
                     </Button>
                     <Button onClick={() => setShowMovementModal(true)} variant="outline" size="sm" className="flex items-center gap-2 border-primary/30">
                        <Plus size={16} /> Movimentação
                     </Button>
                     <Button onClick={openQuickUpdate} variant="primary" size="sm" className="flex items-center gap-2 font-bold shadow-lg shadow-primary/20">
                        <Edit2 size={16} /> Atualização Rápida
                     </Button>
                  </div>
               )}
            </div>
          }
        />
      )}

      <div className={`${hideHeader ? 'p-0' : 'p-4 lg:p-8'} space-y-6 animate-page-enter`}>
         {/* Top Actions when header is hidden */}
         {hideHeader && (
           <div className="flex items-center justify-between gap-2 mb-2 w-full">
              <div className="flex items-center gap-2">
                <Button onClick={() => openSectorModal()} variant="outline" size="sm" className="h-9 px-3 flex items-center gap-2" title="Novo Grupo">
                   <FolderPlus size={16} />
                   <span className="hidden sm:inline text-[10px] uppercase font-black tracking-widest">Grupo</span>
                </Button>
                <Button onClick={() => { if(sectors.length===0){ alert('Crie um Setor antes!'); return; } openAssetModal() }} variant="outline" size="sm" className="h-9 px-3 flex items-center gap-2" title="Novo Ativo">
                   <Plus size={16} />
                   <span className="hidden sm:inline text-[10px] uppercase font-black tracking-widest">Ativo</span>
                </Button>
                <Button onClick={() => setShowMacroManagerModal(true)} variant="outline" size="sm" className="h-9 px-3 flex items-center gap-2 border-primary/30" title="Classes">
                   <Settings size={16} />
                   <span className="hidden sm:inline text-[10px] uppercase font-black tracking-widest">Classes</span>
                </Button>
                <Button onClick={openImportModal} variant="outline" size="sm" className="h-9 px-3 flex items-center gap-2 border-primary/30" title="Importar do Histórico">
                   <Search size={16} />
                   <span className="hidden sm:inline text-[10px] uppercase font-black tracking-widest">Importar</span>
                </Button>
                <Button onClick={() => setShowMovementModal(true)} variant="outline" size="sm" className="h-9 px-3 flex items-center gap-2 border-primary/30" title="Movimentação / Proventos">
                  <Plus size={16} />
                  <span className="hidden sm:inline text-[10px] uppercase font-black tracking-widest">Movim.</span>
               </Button>
              </div>
               <Button onClick={openQuickUpdate} variant="primary" size="sm" className="h-9 px-3 flex items-center gap-2 font-bold shadow-lg shadow-primary/20" title="Atualização Rápida">
                  <Edit2 size={16} />
                  <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest whitespace-nowrap">Atualiz. Rápida</span>
               </Button>
           </div>
         )}

         {/* Top Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <Card className="flex flex-col justify-between p-4 md:p-5 bg-primary border-primary shadow-none col-span-2 lg:col-span-1">
                  <span className="text-ui-label mb-2">Patrimônio Gerido</span>
                  <p className="text-ui-heading tracking-tighter">{formatCurrency(totalInWallet)}</p>
              </Card>
              <Card className="flex flex-col justify-between p-4 md:p-5 bg-primary border-primary shadow-none col-span-1 lg:col-span-1">
                  <span className="text-ui-label mb-2">Aporte em Aberto</span>
                  <div className="flex items-center gap-1 md:gap-2">
                     <span className="text-primary font-black text-xs md:text-lg">R$</span>
                     <input 
                        value={cashBalance} onChange={e => setCashBalance(e.target.value)}
                        onBlur={() => { const p = parseMoneyInput(cashBalance); if(!Number.isNaN(p)) setCashBalance(formatMoneyInput(p)) }}
                        placeholder="0,00" inputMode="decimal"
                        className="bg-transparent border-none p-0 text-ui-heading w-full focus:ring-0 placeholder:opacity-20"
                     />
                  </div>
              </Card>
              <Card className="flex flex-col justify-between p-4 md:p-5 bg-primary border-primary shadow-none col-span-1 lg:col-span-1">
                  <span className="text-ui-label mb-2">Proventos do Mês</span>
                  <p className="text-ui-heading tracking-tighter text-income">{formatCurrency(totalDividends)}</p>
              </Card>
              <Card className="flex flex-col justify-between p-4 md:p-5 bg-primary border-primary shadow-none col-span-2 lg:col-span-1">
                  <span className="text-ui-label mb-2">Patrimônio Futuro</span>
                  <p className="text-ui-heading tracking-tighter">{formatCurrency(futureTotal)}</p>
              </Card>
          </div>

         {!isMacroTargetValid && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm font-semibold flex items-center justify-between">
               <span>Aviso: A soma dos alvos das Classes (Macros) é {formatNumberWithTwoDecimalsBR(macroTargetSum * 100)}% (deveria ser 100%).</span>
            </div>
         )}

         <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block bg-primary rounded-2xl border border-primary overflow-hidden shadow-lg">
               <div className="overflow-x-auto">
               <table className="w-full text-left bg-transparent min-w-[800px]">
                  <thead>
                     <tr className="text-ui-label border-b border-primary bg-secondary/50">
                        <th className="p-4 pl-6">Ativo</th>
                        <th className="p-4 text-center">Setor</th>
                        <th className="p-4 text-center">Alvo(%)</th>
                        <th className="p-4 text-center">Exp. Atual(%)</th>
                        <th className="p-4 text-right">Saldo Atual (R$)</th>
                        <th className="p-4 text-right text-income">Sugestão (R$)</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/10">
                     {groupedData.map(group => {
                        const { macroKey, macro } = group;
                        const macroTotalBal = group.items.reduce((sum, item) => sum + item.assets.reduce((s, a) => s + a.current_balance, 0), 0);
                        const macroCurrentPercent = totalInWallet > 0 ? (macroTotalBal / totalInWallet) : 0;
                        const macroStatus = macro ? getSectorStatus(macro.target_percentage - macroCurrentPercent) : null;

                        return (
                           <Fragment key={macroKey}>
                              <tr className="bg-secondary/20 border-b border-primary">
                                 <td colSpan={6} className="p-3 pl-6">
                                    <div className="flex items-center gap-3">
                                       <h3 className="font-bold text-primary tracking-tight uppercase text-sm">
                                          {macro ? macro.name : (macroKey === 'orphans' ? 'Sem Setor' : macroKey)}
                                       </h3>
                                       {macroStatus && (
                                          <span className={`text-[9px] px-2 py-0.5 rounded-full bg-tertiary border border-primary ${macroStatus.color} tracking-widest font-black whitespace-nowrap`}>
                                             {macroStatus.label}
                                          </span>
                                       )}
                                       <span className="text-[10px] text-secondary ml-auto pr-4 font-semibold uppercase tracking-wider">
                                          Total da Classe: <span className="text-primary">{formatCurrency(macroTotalBal)}</span> ({formatNumberWithTwoDecimalsBR(macroCurrentPercent*100)}%)
                                       </span>
                                    </div>
                                 </td>
                              </tr>
                              
                              {group.items.map(({sector, assets: sectorAssets}) => {
                                 
                                 return sectorAssets.map(asset => {
                                    const assetCurrentPercent = macroTotalBal > 0 ? (asset.current_balance / macroTotalBal) : 0;
                                    const assetGap = asset.target_percentage - assetCurrentPercent;
                                    const assetStatus = getSectorStatus(assetGap);
                                    
                                    return (
                                       <tr 
                                          key={asset.id} 
                                          onClick={() => openAssetModal(asset)}
                                          className="hover:bg-tertiary transition-colors group cursor-pointer"
                                       >
                                          <td className="p-4 pl-6 group/name">
                                             <div className="font-semibold text-primary group-hover/name:text-primary transition-colors">{asset.asset_name}</div>
                                             <div className="text-[10px] text-secondary/40 font-bold uppercase mt-0.5 group-hover/name:text-secondary/60">
                                                {asset.custom_rate || 'Variável'} {asset.maturity_date ? `| Venc: ${asset.maturity_date}` : ''}
                                             </div>
                                          </td>
                                          <td className="p-4 text-center">
                                             <span className="text-xs text-secondary font-medium bg-tertiary px-2 py-1 rounded-md border border-primary">
                                                {sector.sector_name}
                                             </span>
                                          </td>
                                          <td className="p-4 w-28 text-center">
                                             <div className="flex items-center justify-center gap-1">
                                                <input 
                                                   value={formatNumberWithTwoDecimalsBR(asset.target_percentage * 100)}
                                                   onClick={e => e.stopPropagation()}
                                                   onChange={(e) => handleUpdateAssetTarget(asset.id, e.target.value)}
                                                   className="w-10 bg-transparent border-none text-right font-bold text-xs text-primary focus:ring-0 p-0"
                                                   inputMode="decimal"
                                                />
                                                <span className="text-[9px] font-bold text-secondary">%</span>
                                             </div>
                                          </td>
                                          <td className="p-4 text-center">
                                             <span className={`text-xs font-bold ${assetStatus.color}`}>{formatNumberWithTwoDecimalsBR(assetCurrentPercent * 100)}%</span>
                                          </td>
                                          <td className="p-3 w-48 text-right" onClick={e => e.stopPropagation()}>
                                             <Input 
                                               value={formatNumberWithTwoDecimalsBR(asset.current_balance)}
                                               onChange={(e) => handleUpdateAssetBalance(asset.id, e.target.value)}
                                               className="text-right font-bold h-9 bg-tertiary border-primary focus:border-primary text-primary w-full"
                                               inputMode="decimal"
                                             />
                                          </td>
                                          <td className="p-4 text-right">
                                             {allocationSuggestions[asset.id] > 0 ? (
                                                <span className="text-xs font-black text-income">{formatCurrency(allocationSuggestions[asset.id])}</span>
                                             ) : (
                                                <span className="text-xs text-secondary/20">--</span>
                                             )}
                                          </td>
                                       </tr>
                                    );
                                 });
                              })}
                           </Fragment>
                        );
                     })}
                     {assets.length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-secondary text-sm">Nenhum ativo cadastrado neste mês.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Mobile Card View */}
            <div className="md:hidden space-y-6">
               {groupedData.map(group => {
                  const { macroKey, macro } = group;
                  const macroTotalBal = group.items.reduce((sum, item) => sum + item.assets.reduce((s, a) => s + a.current_balance, 0), 0);
                  const macroCurrentPercent = totalInWallet > 0 ? (macroTotalBal / totalInWallet) : 0;
                  const macroStatus = macro ? getSectorStatus(macro.target_percentage - macroCurrentPercent) : null;

                  return (
                     <div key={macroKey} className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                           <div className="flex items-center gap-2">
                              <h3 className="font-bold text-primary uppercase text-xs tracking-tight">
                                 {macro ? macro.name : (macroKey === 'orphans' ? 'Sem Setor' : macroKey)}
                              </h3>
                              {macroStatus && (
                                 <span className={`text-[8px] px-1.5 py-0.5 rounded-full bg-tertiary border border-primary ${macroStatus.color} font-black`}>
                                    {macroStatus.label}
                                 </span>
                              )}
                           </div>
                           <span className="text-[10px] text-secondary font-bold">
                              {formatCurrency(macroTotalBal)}
                           </span>
                        </div>

                        <div className="space-y-3">
                           {group.items.map(({sector, assets: sectorAssets}) => (
                              <div key={sector.id} className="space-y-2">
                                 <div className="pl-1">
                                    <span className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40">{sector.sector_name}</span>
                                 </div>
                                 <div className="space-y-3">
                                    {sectorAssets.map(asset => {
                                       const assetCurrentPercent = macroTotalBal > 0 ? (asset.current_balance / macroTotalBal) : 0;
                                       const assetGap = asset.target_percentage - assetCurrentPercent;
                                       const assetStatus = getSectorStatus(assetGap);
                                       
                                       return (
                                          <Card key={asset.id} onClick={() => openAssetModal(asset)} className="p-3 bg-primary border-primary shadow-none active:scale-[0.98] transition-transform cursor-pointer hover:border-primary/40">
                                             <div className="flex justify-between items-start gap-2">
                                                <div className="min-w-0 flex-1">
                                                   <div className="font-bold text-primary text-sm truncate leading-tight">{asset.asset_name}</div>
                                                   <div className="text-[9px] text-secondary/60 font-black uppercase tracking-wider mt-0.5">
                                                      {asset.custom_rate || 'Variável'} {asset.maturity_date ? `| Venc: ${asset.maturity_date}` : ''}
                                                   </div>
                                                </div>
                                             </div>

                                             <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-primary/5">
                                                <div>
                                                   <p className="text-[8px] font-black text-secondary uppercase tracking-widest opacity-40 mb-0.5">Saldo</p>
                                                   <p className="text-xs font-black text-primary">{formatCurrency(asset.current_balance)}</p>
                                                </div>
                                                <div className="text-right">
                                                   <p className="text-[8px] font-black text-secondary uppercase tracking-widest opacity-40 mb-0.5">Sugestão</p>
                                                   <p className="text-xs font-black text-income">
                                                      {allocationSuggestions[asset.id] > 0 ? formatCurrency(allocationSuggestions[asset.id]) : '--'}
                                                   </p>
                                                </div>
                                             </div>

                                             <div className="flex items-center justify-between mt-2 px-2 py-1.5 bg-secondary/30 rounded-lg">
                                                <div className="flex items-center gap-1.5">
                                                   <span className="text-[8px] text-secondary font-black uppercase tracking-widest">Alvo</span>
                                                   <span className="text-[10px] font-black text-primary">{formatNumberWithTwoDecimalsBR(asset.target_percentage * 100)}%</span>
                                                </div>
                                                <div className="w-px h-3 bg-primary/10"></div>
                                                <div className="flex items-center gap-1.5">
                                                   <span className="text-[8px] text-secondary font-black uppercase tracking-widest">Atual</span>
                                                   <span className={`text-[10px] font-black ${assetStatus.color}`}>{formatNumberWithTwoDecimalsBR(assetCurrentPercent * 100)}%</span>
                                                </div>
                                             </div>
                                          </Card>
                                       );
                                    })}
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  );
               })}
               {assets.length === 0 && (
                  <Card className="p-8 text-center bg-secondary border-dashed border-2 border-primary">
                     <p className="text-secondary text-sm">Nenhum ativo cadastrado.</p>
                  </Card>
               )}
            </div>
         </div>
             
            {groupedData.length === 0 && (
               <div className="text-center py-10 opacity-60">
                  <FolderPlus className="mx-auto h-12 w-12 mb-3"/>
                  <p>Inicie adicionando seus primeiros Setores e Ativos.</p>
               </div>
            )}
         </div>
      {/* Modal Sector */}
      <Modal isOpen={showSectorModal} onClose={() => setShowSectorModal(false)} title={editingSector ? "Editar Grupo/Setor" : "Criar Grupo/Setor"}>
         <form onSubmit={handleSaveSector} className="space-y-4">
             <Select
                label="Macro Classe"
                value={sectorForm.macro_category}
                onChange={e => setSectorForm({...sectorForm, macro_category: e.target.value})}
                options={macroSectors.map(m => ({ value: m.name, label: m.name }))}
             />
            <Input
               label="Nome do Setor (Ex: Bancos, Logística)"
               autoFocus
               value={sectorForm.sector_name}
               onChange={e => setSectorForm({...sectorForm, sector_name: e.target.value})}
               required
            />
            <Input
               label="Limite Alvo (%) do Setor na Carteira"
               inputMode="decimal" placeholder="Ex: 5,50"
               value={sectorForm.target_percentage}
               onChange={e => setSectorForm({...sectorForm, target_percentage: e.target.value})}
            />
            <ModalActionFooter onCancel={() => setShowSectorModal(false)} submitLabel={editingSector ? "Atualizar" : "Salvar"} submitDisabled={saving} />
         </form>
      </Modal>

      {/* Modal Asset */}
      <Modal isOpen={showAssetModal} onClose={() => setShowAssetModal(false)} title={editingAsset ? "Editar Ativo" : "Adicionar Ativo"}>
         <form onSubmit={handleSaveAsset} className="space-y-4">
            <Select
               label="Selecione o Setor" required
               value={assetForm.sector_id}
               onChange={e => setAssetForm({...assetForm, sector_id: e.target.value})}
               options={[ {value: '', label:'-- Escolha --'}, ...sectors.map(s => ({ value: s.id, label: `${s.macro_category} > ${s.sector_name}` }))]}
            />
            <Input
               label="Título ou Ticker" required autoFocus placeholder="Ex: BBAS3, Tesouro Selic..."
               value={assetForm.asset_name} onChange={e => setAssetForm({...assetForm, asset_name: e.target.value})}
            />
            <Input
               label="Saldo Bruto Atual (R$)" inputMode="decimal" placeholder="0,00"
               value={assetForm.current_balance} onChange={e => setAssetForm({...assetForm, current_balance: e.target.value})}
               onBlur={() => {
                  const p = parseMoneyInput(assetForm.current_balance);
                  if(!Number.isNaN(p)) setAssetForm({...assetForm, current_balance: formatMoneyInput(p)});
               }}
            />
            
            <div className="border-t border-[var(--color-border)] pt-3 mt-4">
               <p className="text-xs font-bold text-secondary mb-3 uppercase">Informações Complementares</p>
               <div className="grid grid-cols-2 gap-3">
                  <Input label="Valor Inicial (Aplicado)" inputMode="decimal" placeholder="Opcional" value={assetForm.applied_amount} onChange={e => setAssetForm({...assetForm, applied_amount: e.target.value})} />
                  <Input label="Taxa / Yield" placeholder="Ex: IPCA + 8%" value={assetForm.custom_rate} onChange={e => setAssetForm({...assetForm, custom_rate: e.target.value})} />
                  <Input label="Vencimento" placeholder="Ex: Mar/26" value={assetForm.maturity_date} onChange={e => setAssetForm({...assetForm, maturity_date: e.target.value})} />
               </div>
            </div>

            <ModalActionFooter 
                onCancel={() => setShowAssetModal(false)} 
                submitLabel={editingAsset ? "Atualizar Ativo" : "Salvar Ativo"} 
                submitDisabled={saving}
                onDelete={editingAsset ? () => handleDeleteAsset(editingAsset.id) : undefined}
                deleteLabel="Excluir Ativo"
             />
         </form>
      </Modal>

      {/* Modal Macro Manager */}
      <Modal isOpen={showMacroManagerModal} onClose={() => setShowMacroManagerModal(false)} title="Gerenciar Macro Classes">
         <div className="space-y-6">
            <div className="bg-primary p-4 rounded-2xl border border-primary shadow-none">
               <h4 className="text-xs font-black text-secondary uppercase tracking-widest mb-4">{editingMacro ? 'Editar Classe' : 'Nova Classe de Ativo'}</h4>
               <form onSubmit={handleSaveMacro} className="space-y-4">
                  <Input label="Nome da Classe" value={macroForm.name} onChange={e => setMacroForm({...macroForm, name: e.target.value})} required placeholder="Ex: Renda Fixa, Ações..." />
                  <Input label="Alvo Inicial (%)" value={macroForm.target_percentage} onChange={e => setMacroForm({...macroForm, target_percentage: e.target.value})} inputMode="decimal" placeholder="0,00" />
                  <div className="flex gap-2">
                     <Button type="submit" variant="primary" size="sm" className="flex-1" disabled={saving}>
                        {editingMacro ? 'Atualizar' : 'Adicionar'}
                     </Button>
                     {editingMacro && (
                        <Button type="button" variant="outline" size="sm" onClick={() => openMacroManager()}>
                           Cancelar
                        </Button>
                     )}
                  </div>
               </form>
            </div>

            <div className="space-y-2">
               <h4 className="text-xs font-black text-secondary uppercase tracking-widest pl-1">Classes Cadastradas</h4>
               <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {macroSectors.map(m => (
                     <div key={m.id} className="flex justify-between items-center p-3 bg-primary rounded-xl border border-primary shadow-none group">
                        <div>
                           <p className="text-sm font-bold text-primary">{m.name}</p>
                           <p className="text-[10px] text-secondary font-black uppercase">Alvo: {formatNumberWithTwoDecimalsBR(m.target_percentage*100)}%</p>
                        </div>
                        <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => openMacroManager(m)} className="p-2 hover:bg-tertiary rounded-lg text-secondary hover:text-primary transition-colors">
                              <Edit2 size={14} />
                           </button>
                           <button onClick={() => handleDeleteMacro(m.id)} className="p-2 hover:bg-danger/10 rounded-lg text-secondary hover:text-danger transition-colors">
                              <Trash2 size={14} />
                           </button>
                        </div>
                     </div>
                  ))}
                  {macroSectors.length === 0 && <p className="text-center py-6 text-xs text-secondary italic">Nenhuma classe personalizada.</p>}
               </div>
            </div>
            <ModalActionFooter onCancel={() => setShowMacroManagerModal(false)} />
         </div>
      </Modal>

      {/* Modal Quick Update */}
      <Modal isOpen={showQuickUpdateModal} onClose={() => { setShowQuickUpdateModal(false); setQuickUpdateSearch(''); }} title="Atualização Rápida de Saldos" maxWidth="max-w-4xl">
         <div className="space-y-4">
            <p className="text-sm text-secondary">Atualize rapidamente o saldo de todos os ativos para o fechamento do mês.</p>
            {/* Search field */}
            <input
               autoFocus
               type="text"
               placeholder="🔍 Pesquisar ativo..."
               value={quickUpdateSearch}
               onChange={e => setQuickUpdateSearch(e.target.value)}
               className="w-full bg-primary border border-primary rounded-xl px-4 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/40 shadow-none"
            />
            <div className="max-h-[55vh] overflow-y-auto custom-scrollbar pr-2 bg-primary/30 rounded-xl border border-primary/10 p-1">
               <table className="w-full text-left">
                  <thead className="sticky top-0 bg-primary z-10 shadow-none">
                     <tr className="text-[10px] text-secondary border-b border-primary uppercase font-black tracking-widest bg-secondary/50">
                        <th className="p-3">Ativo / Setor</th>
                        <th className="p-3 text-right">Saldo Base (R$)</th>
                        <th className="p-3 text-right">Aporte/Venda (R$)</th>
                        <th className="p-3 text-right">Proventos (R$)</th>
                        <th className="p-3 text-right">Saldo Final (R$)</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/10">
                     {assets
                       .filter(a => !quickUpdateSearch || a.asset_name.toLowerCase().includes(quickUpdateSearch.toLowerCase()))
                       .sort((a,b) => { const aMod = modifiedAssetIds.has(a.id); const bMod = modifiedAssetIds.has(b.id); if (aMod && !bMod) return -1; if (!aMod && bMod) return 1; return a.asset_name.localeCompare(b.asset_name); }).map(asset => {
                        const s = sectors.find(sec => sec.id === asset.sector_id);
                        return (
                           <tr key={asset.id} className={`transition-all ${modifiedAssetIds.has(asset.id) ? 'bg-income/5' : 'hover:bg-tertiary'} ${savingRowIds.has(asset.id) ? 'opacity-50 grayscale' : ''}`}>
                               <td className="p-3">
                                  <div className="font-bold text-primary flex items-center gap-2">
                                     <span className="truncate max-w-[120px]">{asset.asset_name}</span>
                                     {savingRowIds.has(asset.id) ? (
                                        <Loader2 size={10} className="animate-spin text-primary opacity-40" />
                                     ) : dirtyAssetIds.has(asset.id) ? (
                                        <Pencil size={10} className="text-warning animate-pulse" />
                                     ) : (
                                        modifiedAssetIds.has(asset.id) && <span className="w-1.5 h-1.5 rounded-full bg-income shadow-sm"></span>
                                     )}
                                  </div>
                                  <div className="flex flex-col">
                                     <span className="text-[9px] text-secondary opacity-40 font-black uppercase leading-tight">{s?.sector_name}</span>
                                     {(asset.custom_rate || asset.maturity_date) && (
                                        <span className="text-[8px] text-secondary opacity-60 font-medium italic leading-tight mt-0.5">
                                           {asset.custom_rate} {asset.maturity_date && `• ${asset.maturity_date}`}
                                        </span>
                                     )}
                                  </div>
                               </td>
                               <td className="p-3 text-right font-black text-xs text-secondary/40">
                                  {formatCurrency(initialQuickUpdateBalances[asset.id] || 0)}
                               </td>
                               <td className="p-3">
                                  <Input 
                                     value={quickUpdateContributions[asset.id] || ''}
                                     onChange={(e) => {
                                        setQuickUpdateContributions({...quickUpdateContributions, [asset.id]: e.target.value});
                                        setDirtyAssetIds(prev => new Set(prev).add(asset.id));
                                     }}
                                     onBlur={() => saveQuickUpdateRow(asset.id)}
                                     className="text-right font-bold h-8 bg-primary border-primary text-[11px] shadow-none"
                                     inputMode="decimal"
                                  />
                               </td>
                               <td className="p-3">
                                  <Input 
                                     value={quickUpdateDividends[asset.id] || ''}
                                     onChange={(e) => {
                                        setQuickUpdateDividends({...quickUpdateDividends, [asset.id]: e.target.value});
                                        setDirtyAssetIds(prev => new Set(prev).add(asset.id));
                                     }}
                                     onBlur={() => saveQuickUpdateRow(asset.id)}
                                     className="text-right font-bold h-8 bg-primary border-primary text-[11px] shadow-none"
                                     inputMode="decimal"
                                  />
                               </td>
                               <td className="p-3 w-40">
                                  <Input 
                                     value={quickUpdateBalances[asset.id] || ''}
                                     onChange={(e) => {
                                        setQuickUpdateBalances({...quickUpdateBalances, [asset.id]: e.target.value});
                                        setDirtyAssetIds(prev => new Set(prev).add(asset.id));
                                     }}
                                     onBlur={() => saveQuickUpdateRow(asset.id)}
                                     className="text-right font-black h-8 bg-primary border-primary text-[11px] shadow-none ring-primary/20"
                                     inputMode="decimal"
                                  />
                               </td>
                            </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
            <ModalActionFooter onCancel={() => setShowQuickUpdateModal(false)} submitLabel="Salvar Atualizações" onSubmit={saveQuickUpdate} submitDisabled={saving} />
         </div>
      </Modal>

      {/* Modal Movement & Dividends */}
      <Modal isOpen={showMovementModal} onClose={() => setShowMovementModal(false)} title="Registrar Movimentação / Proventos">
         <form onSubmit={handleSaveMovement} className="space-y-4">
            <Select
               label="Selecione o Ativo" required
               value={movementForm.asset_id}
               onChange={e => setMovementForm({...movementForm, asset_id: e.target.value})}
               options={[ {value: '', label:'-- Escolha --'}, ...assets.sort((a,b) => { const aMod = modifiedAssetIds.has(a.id); const bMod = modifiedAssetIds.has(b.id); if (aMod && !bMod) return -1; if (!aMod && bMod) return 1; return a.asset_name.localeCompare(b.asset_name); }).map(a => ({ value: a.id, label: a.asset_name }))]}
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <Input 
                  label="Aporte (+) ou Venda (-)" 
                  inputMode="decimal" 
                  placeholder="0,00"
                  value={movementForm.contribution} 
                  onChange={e => setMovementForm({...movementForm, contribution: e.target.value})}
                  onBlur={() => {
                     const p = parseMoneyInput(movementForm.contribution);
                     if(!Number.isNaN(p)) setMovementForm({...movementForm, contribution: formatMoneyInput(p)});
                  }}
                  helperText="O saldo do ativo será atualizado automaticamente com base neste valor."
               />
               <Input 
                  label="Proventos / Rendimentos" 
                  inputMode="decimal" 
                  placeholder="0,00"
                  value={movementForm.dividends} 
                  onChange={e => setMovementForm({...movementForm, dividends: e.target.value})}
                  onBlur={() => {
                     const p = parseMoneyInput(movementForm.dividends);
                     if(!Number.isNaN(p)) setMovementForm({...movementForm, dividends: formatMoneyInput(p)});
                  }}
               />
            </div>

            <div className="p-3 bg-secondary/50 rounded-xl border border-primary/10 text-[10px] text-secondary/60 italic leading-relaxed">
               Nota: Esta ação atualiza o saldo atual do ativo somando o aporte. Proventos não alteram o saldo, mas são contabilizados na rentabilidade do relatório.
            </div>

            <ModalActionFooter onCancel={() => setShowMovementModal(false)} submitLabel="Salvar Movimentação" submitDisabled={saving} />
         </form>
      </Modal>

      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Importar Ativo do Histórico">
         <div className="space-y-4">
            <p className="text-sm text-secondary">Selecione um ativo que já foi cadastrado em meses anteriores para adicioná-lo ao mês atual.</p>
            <input
               autoFocus
               type="text"
               placeholder="🔍 Pesquisar no histórico..."
               value={importSearch}
               onChange={e => setImportSearch(e.target.value)}
               className="w-full bg-primary border border-primary rounded-xl px-4 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/40 shadow-none"
            />
            
            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 space-y-2">
               {loadingHistory ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
               ) : allHistoricalAssets.filter(a => !importSearch || a.asset_name.toLowerCase().includes(importSearch.toLowerCase())).map(a => (
                  <div 
                     key={a.id} 
                     onClick={() => handleImportAsset(a)}
                     className="p-3 bg-secondary/20 hover:bg-tertiary rounded-xl border border-primary/10 cursor-pointer transition-all group flex justify-between items-center"
                  >
                     <div>
                        <div className="font-bold text-primary group-hover:text-primary">{a.asset_name}</div>
                        <div className="text-[10px] text-secondary/40 font-black uppercase tracking-widest">
                           Última vez visto em {a.month.split('-').reverse().join('/')}
                        </div>
                     </div>
                     <Plus size={16} className="text-secondary group-hover:text-primary" />
                  </div>
               ))}
               {!loadingHistory && allHistoricalAssets.length === 0 && (
                  <p className="text-center py-10 text-secondary text-sm italic">Nenhum histórico encontrado.</p>
               )}
            </div>
            <div className="pt-2 flex justify-end">
               <Button onClick={() => setShowImportModal(false)} variant="outline" size="sm">Fechar</Button>
            </div>
         </div>
      </Modal>
   </div>
  );
}

