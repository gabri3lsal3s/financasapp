import { useState, useEffect, useMemo, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { FolderPlus, Edit2, Trash2, Plus, Settings } from 'lucide-react';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Modal from '@/components/Modal';
import ModalActionFooter from '@/components/ModalActionFooter';
import Loader from '@/components/Loader';
import { formatCurrency, parseMoneyInput, formatMoneyInput } from '@/utils/format';

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
  variation_month?: string;
  variation_total?: string;
}

interface Client {
  id: string;
  name: string;
}



interface PortfolioManagementProps {
  clientId: string;
  selectedMonth?: string;
}

export default function PortfolioManagement({ clientId, selectedMonth = 'live' }: PortfolioManagementProps) {
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
     applied_amount: '', custom_rate: '', maturity_date: '', variation_month: '', variation_total: ''
  });

  // Quick Update State
  const [showQuickUpdateModal, setShowQuickUpdateModal] = useState(false);
  const [quickUpdateBalances, setQuickUpdateBalances] = useState<Record<string, string>>({});
  const [quickUpdateSearch, setQuickUpdateSearch] = useState('');

  useEffect(() => {
    if (clientId) fetchPortfolio();
  }, [clientId, selectedMonth]);

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
  const parsedCash = parseMoneyInput(cashBalance);
  const futureTotal = totalInWallet + (Number.isNaN(parsedCash) ? 0 : parsedCash);

  // Modals Openers
  const openSectorModal = (sector?: PortfolioSector) => {
     if (sector) {
        setEditingSector(sector);
        setSectorForm({
           macro_category: sector.macro_category,
           sector_name: sector.sector_name,
           target_percentage: (sector.target_percentage * 100).toFixed(2).replace('.', ',')
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
           current_balance: formatMoneyInput(asset.current_balance),
           applied_amount: asset.applied_amount ? formatMoneyInput(asset.applied_amount) : '',
           custom_rate: asset.custom_rate || '',
           maturity_date: asset.maturity_date || '',
           variation_month: asset.variation_month || '',
           variation_total: asset.variation_total || ''
        });
     } else {
        setEditingAsset(null);
        setAssetForm({
           sector_id: defaultSectorId || '', asset_name: '', current_balance: '',
           applied_amount: '', custom_rate: '', maturity_date: '', variation_month: '', variation_total: ''
        });
     }
     setShowAssetModal(true);
  };

  const openMacroManager = (macro?: PortfolioMacroSector) => {
     if (macro) {
        setEditingMacro(macro);
        setMacroForm({
           name: macro.name,
           target_percentage: (macro.target_percentage * 100).toFixed(2).replace('.', ',')
        });
     } else {
        setEditingMacro(null);
        setMacroForm({ name: '', target_percentage: '' });
     }
  };

  const openQuickUpdate = () => {
    const balances: Record<string, string> = {};
    assets.forEach(a => { balances[a.id] = formatMoneyInput(a.current_balance); });
    setQuickUpdateBalances(balances);
    setShowQuickUpdateModal(true);
  };

  const saveQuickUpdate = async () => {
    setSaving(true);
    try {
      const updates = Object.keys(quickUpdateBalances).map(id => {
         let num = parseMoneyInput(quickUpdateBalances[id]);
         if (Number.isNaN(num)) num = 0;
         return { id, current_balance: num };
      });

      const tableName = selectedMonth === 'live' ? 'portfolio_assets' : 'consulting_report_assets';

      for (const update of updates) {
         await supabase.from(tableName).update({ current_balance: update.current_balance }).eq('id', update.id);
      }

      // For historical months, also update total_balance on the report
      if (selectedMonth !== 'live') {
         const newTotal = updates.reduce((sum, u) => sum + u.current_balance, 0);
         await supabase.from('consulting_reports').update({ total_balance: newTotal }).eq('id', selectedMonth);
      }

      setAssets(assets.map(a => {
         const up = updates.find(u => u.id === a.id);
         return up ? { ...a, current_balance: up.current_balance } : a;
      }));
      setShowQuickUpdateModal(false);
    } catch(e) { 
      alert("Erro na atualização rápida"); 
    } finally { 
      setSaving(false); 
    }
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
        variation_month: assetForm.variation_month,
        variation_total: assetForm.variation_total
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
          const currentAssets = editingAsset 
             ? assets.map(a => a.id === editingAsset.id ? { ...a, current_balance: payload.current_balance } : a)
             : [...assets, { current_balance: payload.current_balance }];
          const newTotal = currentAssets.reduce((sum, a) => sum + (a.current_balance || 0), 0);
          await supabase.from('consulting_reports').update({ total_balance: newTotal }).eq('id', selectedMonth);
       }

       setShowAssetModal(false);
     } catch(err) {
        console.error(err);
        alert("Erro ao salvar ativo");
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
     }
  };


  const getSectorStatus = (diffTargetVsCurrent: number) => {
     if (diffTargetVsCurrent < -0.05) return { label: 'Excesso Crítico', color: 'text-red-500' };
     if (diffTargetVsCurrent < -0.02) return { label: 'Excesso', color: 'text-orange-500' };
     if (diffTargetVsCurrent > 0.05) return { label: 'Prioridade de Aporte', color: 'text-[#10b981]' };
     if (diffTargetVsCurrent > 0.02) return { label: 'Aporte Secundário', color: 'text-blue-500' };
     return { label: 'Enquadrado', color: 'text-gray-400' };
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
         const orphanAssets = assets.filter(a => !a.sector_id);
         
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
    <div>
      <div className="space-y-6 animate-page-enter">
         {/* Top Stats */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <Card className="flex flex-col justify-between p-5 bg-secondary/5 border-white/5 transition-all hover:border-white/10">
                 <span className="text-xs text-secondary mb-2">Patrimônio Gerido</span>
                 <p className="text-2xl font-bold text-primary tracking-tight">{formatCurrency(totalInWallet)}</p>
             </Card>
             <Card className="flex flex-col justify-between p-5 bg-secondary/5 border-white/5 transition-all hover:border-white/10">
                 <span className="text-xs text-secondary mb-2">Aporte em Aberto (Caixa)</span>
                 <div className="flex items-center gap-2">
                    <span className="text-primary font-semibold text-lg">R$</span>
                    <input 
                       value={cashBalance} onChange={e => setCashBalance(e.target.value)}
                       onBlur={() => { const p = parseMoneyInput(cashBalance); if(!Number.isNaN(p)) setCashBalance(formatMoneyInput(p)) }}
                       placeholder="0,00" inputMode="decimal"
                       className="bg-transparent border-none outline-none text-2xl font-bold text-[#10b981] w-full tracking-tight"
                    />
                 </div>
             </Card>
             <Card className="flex flex-col justify-between p-5 bg-secondary/5 border-white/5 transition-all hover:border-white/10">
                 <span className="text-xs text-secondary mb-2">Patrimônio Futuro Total</span>
                 <p className="text-2xl font-bold text-primary tracking-tight">{formatCurrency(futureTotal)}</p>
             </Card>
         </div>

         <div className="flex flex-wrap gap-3">
            <Button onClick={() => openSectorModal()} variant="outline" className="flex items-center gap-2">
               <FolderPlus size={16} /> Novo Grupo/Setor
            </Button>
            <Button onClick={() => { if(sectors.length===0){ alert('Crie um Setor antes!'); return; } openAssetModal() }} variant="outline" className="flex items-center gap-2">
               <Plus size={16} /> Novo Ativo
            </Button>
            <Button onClick={() => setShowMacroManagerModal(true)} variant="outline" className="flex items-center gap-2 border-white/10 hover:bg-white/5">
               <Settings size={16} /> Gerenciar Classes
            </Button>
            
            {selectedMonth === 'live' ? (
               <Button onClick={openQuickUpdate} variant="primary" className="flex items-center gap-2 font-bold ml-auto">
                  <Edit2 size={16} /> Atualização Rápida
               </Button>
            ) : (
               <div className="ml-auto flex items-center gap-2">
                  <div className="flex items-center gap-2 p-2 px-3 rounded-xl bg-orange-500/10 text-orange-500 text-xs font-bold border border-orange-500/20">
                     ⚠️ Histórico
                  </div>
                  <Button onClick={openQuickUpdate} variant="primary" className="flex items-center gap-2 font-bold">
                     <Edit2 size={16} /> Atualização Rápida
                  </Button>
               </div>
            )}
         </div>

         {!isMacroTargetValid && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm font-semibold flex items-center justify-between">
               <span>Aviso: A soma dos alvos das Classes (Macros) é {(macroTargetSum * 100).toFixed(2)}% (deveria ser 100%).</span>
            </div>
         )}

         <div className="bg-secondary/5 rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
               <table className="w-full text-left bg-transparent min-w-[800px]">
                  <thead>
                     <tr className="text-[10px] text-secondary border-b border-white/5 uppercase font-black tracking-widest bg-black/40">
                        <th className="p-4 pl-6">Ativo</th>
                        <th className="p-4 text-center">Setor</th>
                        <th className="p-4 text-center">Alvo(%)</th>
                        <th className="p-4 text-center">Exp. Atual(%)</th>
                        <th className="p-4 text-right">Saldo Atual (R$)</th>
                        <th className="p-4 text-right text-[#10b981]">Sugestão (R$)</th>
                        <th className="p-4 text-center">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {groupedData.map(group => {
                        const { macroKey, macro } = group;
                        const macroTotalBal = group.items.reduce((sum, item) => sum + item.assets.reduce((s, a) => s + a.current_balance, 0), 0);
                        const macroCurrentPercent = totalInWallet > 0 ? (macroTotalBal / totalInWallet) : 0;
                        const macroStatus = macro ? getSectorStatus(macro.target_percentage - macroCurrentPercent) : null;

                        return (
                           <Fragment key={macroKey}>
                              <tr className="bg-white/5 border-b border-white/10">
                                 <td colSpan={7} className="p-3 pl-6">
                                    <div className="flex items-center gap-3">
                                       <h3 className="font-bold text-primary tracking-tight uppercase text-sm">
                                          {macro ? macro.name : (macroKey === 'orphans' ? 'Sem Setor' : macroKey)}
                                       </h3>
                                       {macroStatus && (
                                          <span className={`text-[9px] px-2 py-0.5 rounded-full bg-black/40 border border-white/10 ${macroStatus.color} tracking-widest font-black whitespace-nowrap`}>
                                             {macroStatus.label}
                                          </span>
                                       )}
                                       <span className="text-[10px] text-secondary ml-auto pr-4 font-semibold uppercase tracking-wider">
                                          Total da Classe: <span className="text-primary">{formatCurrency(macroTotalBal)}</span> ({(macroCurrentPercent*100).toFixed(2)}%)
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
                                       <tr key={asset.id} className="hover:bg-white/5 transition-colors group">
                                          <td className="p-4 pl-6">
                                             <div className="font-semibold text-primary">{asset.asset_name}</div>
                                             <div className="text-[10px] text-secondary/40 font-bold uppercase mt-0.5">
                                                {macro?.name === 'Renda Fixa' ? (asset.custom_rate || 'Renda Fixa') : (asset.variation_month || 'Variável')}
                                             </div>
                                          </td>
                                          <td className="p-4 text-center">
                                             <span className="text-xs text-secondary font-medium bg-black/20 px-2 py-1 rounded-md border border-white/5">
                                                {sector.sector_name}
                                             </span>
                                          </td>
                                          <td className="p-4 w-28 text-center">
                                             <div className="flex items-center justify-center gap-1">
                                                <input 
                                                   value={(asset.target_percentage * 100).toFixed(2).replace('.', ',')}
                                                   onChange={(e) => handleUpdateAssetTarget(asset.id, e.target.value)}
                                                   className="w-10 bg-transparent border-none text-right font-bold text-xs text-primary focus:ring-0 p-0"
                                                   inputMode="decimal"
                                                />
                                                <span className="text-[9px] font-bold text-secondary">%</span>
                                             </div>
                                          </td>
                                          <td className="p-4 text-center">
                                             <span className={`text-xs font-bold ${assetStatus.color}`}>{(assetCurrentPercent * 100).toFixed(2)}%</span>
                                          </td>
                                          <td className="p-3 w-48 text-right">
                                             <Input 
                                               value={asset.current_balance.toString().replace('.', ',')}
                                               onChange={(e) => handleUpdateAssetBalance(asset.id, e.target.value)}
                                               className="text-right font-bold h-9 bg-[#111] border-white/5 focus:border-primary/40 text-primary w-full"
                                               inputMode="decimal"
                                             />
                                          </td>
                                          <td className="p-4 text-right">
                                             {allocationSuggestions[asset.id] > 0 ? (
                                                <span className="text-xs font-black text-[#10b981]">{formatCurrency(allocationSuggestions[asset.id])}</span>
                                             ) : (
                                                <span className="text-xs text-secondary/20">--</span>
                                             )}
                                          </td>
                                          <td className="p-3 text-center">
                                             <div className="flex items-center justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openAssetModal(asset)} className="text-secondary hover:text-primary hover:scale-110 p-1" title="Editar Ativo">
                                                   <Edit2 size={16}/>
                                                </button>
                                                <button onClick={() => handleDeleteAsset(asset.id)} className="text-[var(--color-danger)] hover:scale-110 p-1" title="Excluir Ativo">
                                                   <Trash2 size={16}/>
                                                </button>
                                             </div>
                                          </td>
                                       </tr>
                                    );
                                 });
                              })}
                           </Fragment>
                        );
                     })}
                     {assets.length === 0 && (
                        <tr><td colSpan={7} className="p-8 text-center text-secondary text-sm">Nenhum ativo cadastrado neste mês.</td></tr>
                     )}
                  </tbody>
               </table>
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
               <p className="text-xs font-bold text-secondary mb-3 uppercase">Campos Opcionais de Relatório</p>
               <div className="grid grid-cols-2 gap-3">
                  <Input label="Valor Inicial (Aplicado)" inputMode="decimal" placeholder="Opcional" value={assetForm.applied_amount} onChange={e => setAssetForm({...assetForm, applied_amount: e.target.value})} />
                  <Input label="Taxa / Yield" placeholder="Ex: IPCA + 8%" value={assetForm.custom_rate} onChange={e => setAssetForm({...assetForm, custom_rate: e.target.value})} />
                  <Input label="Vencimento" placeholder="Ex: Mar/26" value={assetForm.maturity_date} onChange={e => setAssetForm({...assetForm, maturity_date: e.target.value})} />
                  <Input label="Variação Mês" placeholder="Ex: -5,12%" value={assetForm.variation_month} onChange={e => setAssetForm({...assetForm, variation_month: e.target.value})} />
                  <Input label="Variação Total" placeholder="Ex: +15,0%" value={assetForm.variation_total} onChange={e => setAssetForm({...assetForm, variation_total: e.target.value})} />
               </div>
            </div>

            <ModalActionFooter onCancel={() => setShowAssetModal(false)} submitLabel={editingAsset ? "Atualizar Ativo" : "Salvar Ativo"} submitDisabled={saving} />
         </form>
      </Modal>

      {/* Modal Macro Manager */}
      <Modal isOpen={showMacroManagerModal} onClose={() => setShowMacroManagerModal(false)} title="Gerenciar Macro Classes">
         <div className="space-y-6">
            <div className="bg-secondary/10 p-4 rounded-2xl border border-white/5">
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
                     <div key={m.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 group">
                        <div>
                           <p className="text-sm font-bold text-primary">{m.name}</p>
                           <p className="text-[10px] text-secondary font-black">ALVO: {(m.target_percentage*100).toFixed(2)}%</p>
                        </div>
                        <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => openMacroManager(m)} className="p-2 hover:bg-white/10 rounded-lg text-secondary hover:text-primary transition-colors">
                              <Edit2 size={14} />
                           </button>
                           <button onClick={() => handleDeleteMacro(m.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-secondary hover:text-red-500 transition-colors">
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
               className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-primary outline-none focus:border-primary/50 transition-all placeholder:text-secondary/40"
            />
            <div className="max-h-[55vh] overflow-y-auto custom-scrollbar pr-2">
               <table className="w-full text-left">
                  <thead className="sticky top-0 bg-[#161616] z-10">
                     <tr className="text-[10px] text-secondary border-b border-white/5 uppercase font-black tracking-widest">
                        <th className="p-3">Ativo</th>
                        <th className="p-3">Setor / Classe</th>
                        <th className="p-3 text-right">Saldo Atual (R$)</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {assets
                       .filter(a => !quickUpdateSearch || a.asset_name.toLowerCase().includes(quickUpdateSearch.toLowerCase()))
                       .sort((a,b) => a.asset_name.localeCompare(b.asset_name)).map(asset => {
                        const s = sectors.find(sec => sec.id === asset.sector_id);
                        return (
                           <tr key={asset.id} className="hover:bg-white/5">
                              <td className="p-3 font-bold text-primary">{asset.asset_name}</td>
                              <td className="p-3 text-xs text-secondary">{s?.sector_name || '-'} <span className="opacity-50">({s?.macro_category || '-'})</span></td>
                              <td className="p-3 w-48">
                                 <Input 
                                    value={quickUpdateBalances[asset.id] || ''}
                                    onChange={(e) => setQuickUpdateBalances({...quickUpdateBalances, [asset.id]: e.target.value})}
                                    onBlur={() => {
                                       const p = parseMoneyInput(quickUpdateBalances[asset.id]);
                                       if (!Number.isNaN(p)) setQuickUpdateBalances({...quickUpdateBalances, [asset.id]: formatMoneyInput(p)});
                                    }}
                                    className="text-right font-bold h-9 bg-black/40 border-white/10"
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
    </div>
  );
}

