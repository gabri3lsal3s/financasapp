import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Trash2, FolderPlus, Edit2 } from 'lucide-react';
import Button from '@/components/Button';
import Loader from '@/components/Loader';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Modal from '@/components/Modal';
import ModalActionFooter from '@/components/ModalActionFooter';
import Select from '@/components/Select';
import { formatCurrency, formatMoneyInput, parseMoneyInput } from '@/utils/format';

interface PortfolioSector {
  id: string;
  client_id: string;
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

const MACRO_CATEGORIES = ['Renda Fixa', 'Ações Nacionais', 'Fundo Imobiliário (FII)', 'Exterior (ETFs)', 'Criptoativos', 'Outros'];

export default function PortfolioManagement() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  
  const [sectors, setSectors] = useState<PortfolioSector[]>([]);
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  
  const [cashBalance, setCashBalance] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (clientId) fetchPortfolio();
  }, [clientId]);

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const { data: clientData, error: clientErr } = await supabase.from('consulting_clients').select('id, name').eq('id', clientId).single();
      if (clientErr) throw clientErr;
      setClient(clientData);

      const { data: sectorsData, error: secErr } = await supabase.from('portfolio_sectors').select('*').eq('client_id', clientId).order('macro_category').order('sector_name');
      if (secErr) throw secErr;
      setSectors(sectorsData || []);

      const { data: assetsData, error: astErr } = await supabase.from('portfolio_assets').select('*').eq('client_id', clientId).order('asset_name');
      if (astErr) throw astErr;
      setAssets(assetsData || []);
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
  const totalTargetAllocation = useMemo(() => sectors.reduce((acc, s) => acc + s.target_percentage, 0), [sectors]);

  // Modals Openers
  const openSectorModal = (sector?: PortfolioSector) => {
     if (sector) {
        setEditingSector(sector);
        setSectorForm({
           macro_category: sector.macro_category,
           sector_name: sector.sector_name,
           target_percentage: (sector.target_percentage * 100).toString().replace('.', ',')
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

  // Handle Sector Save
  const handleSaveSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectorForm.sector_name || !clientId) return;
    setSaving(true);
    
    let target = parseMoneyInput(sectorForm.target_percentage);
    if(Number.isNaN(target)) target = 0;
    const finalTarget = target / 100;

    try {
      if (editingSector) {
         const { data, error } = await supabase.from('portfolio_sectors')
            .update({ macro_category: sectorForm.macro_category, sector_name: sectorForm.sector_name, target_percentage: finalTarget })
            .eq('id', editingSector.id).select();
         if (error) throw error;
         setSectors(sectors.map(s => s.id === editingSector.id ? data[0] : s));
      } else {
         const { data, error } = await supabase.from('portfolio_sectors').insert([{
            client_id: clientId,
            macro_category: sectorForm.macro_category,
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

  const handleDeleteSector = async (id: string) => {
     if(!window.confirm('Excluir este setor apagará os ativos dentro dele!')) return;
     setSectors(sectors.filter(s => s.id !== id));
     setAssets(assets.filter(a => a.sector_id !== id));
     await supabase.from('portfolio_sectors').delete().eq('id', id);
  };

  const handleUpdateSectorTarget = async (id: string, value: string) => {
     let num = parseMoneyInput(value);
     if (Number.isNaN(num)) num = 0;
     const finalVal = num / 100;
     setSectors(sectors.map(s => s.id === id ? { ...s, target_percentage: finalVal } : s));
     try {
        await supabase.from('portfolio_sectors').update({ target_percentage: finalVal }).eq('id', id);
     } catch (e) {}
  };

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
       applied_amount: Number.isNaN(applied) ? null : applied,
       custom_rate: assetForm.custom_rate,
       maturity_date: assetForm.maturity_date,
       variation_month: assetForm.variation_month,
       variation_total: assetForm.variation_total
    };

    try {
      if (editingAsset) {
         const { data, error } = await supabase.from('portfolio_assets')
            .update(assetPayload).eq('id', editingAsset.id).select();
         if (error) throw error;
         setAssets(assets.map(a => a.id === editingAsset.id ? data[0] : a));
      } else {
         const { data, error } = await supabase.from('portfolio_assets').insert([assetPayload]).select();
         if (error) throw error;
         setAssets([...assets, data[0]]);
      }
      setShowAssetModal(false);
    } catch(err) {
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
        await supabase.from('portfolio_assets').update({ current_balance: num }).eq('id', id);
     } catch(e) {}
  };
  
  const handleDeleteAsset = async (id: string) => {
    if (!window.confirm('Excluir ativo?')) return;
    setAssets(assets.filter(a => a.id !== id));
    await supabase.from('portfolio_assets').delete().eq('id', id);
  };

  const getSectorStatus = (diffTargetVsCurrent: number) => {
     if (diffTargetVsCurrent < -0.05) return { label: 'Excesso Crítico', color: 'text-red-500' };
     if (diffTargetVsCurrent < -0.02) return { label: 'Excesso', color: 'text-orange-500' };
     if (diffTargetVsCurrent > 0.05) return { label: 'Prioridade de Aporte', color: 'text-[#10b981]' };
     if (diffTargetVsCurrent > 0.02) return { label: 'Aporte Secundário', color: 'text-blue-500' };
     return { label: 'Enquadrado', color: 'text-gray-400' };
  };

  const groupedData = useMemo(() => {
     const grouped: Record<string, { sector: PortfolioSector, assets: PortfolioAsset[] }[]> = {};
     sectors.forEach(sec => {
        if (!grouped[sec.macro_category]) grouped[sec.macro_category] = [];
        grouped[sec.macro_category].push({
           sector: sec,
           assets: assets.filter(a => a.sector_id === sec.id)
        });
     });
     const orphans = assets.filter(a => !a.sector_id);
     if (orphans.length > 0) {
        grouped['Sem Setor (Legado)'] = [{ 
           sector: { id: 'orphan', client_id: '', macro_category: 'Sem Setor', sector_name: 'Antigos Ativos', target_percentage: 0 }, 
           assets: orphans 
        }];
     }
     return grouped;
  }, [sectors, assets]);


  if (loading) return <div className="flex justify-center py-20"><Loader text="Carregando..." /></div>;
  if (!client) return <div>Cliente não encontrado</div>;

  return (
    <div>
       <PageHeader 
        title={client.name}
        subtitle="Gestor do Método Cerrado (Alocação Setorial)"
        action={
          <Button size="sm" variant="outline" onClick={() => navigate('/admin/consulting')} className="flex items-center gap-2">
            <ArrowLeft size={16} /> Voltar
          </Button>
        }
      />

      <div className="p-4 lg:p-6 space-y-6 animate-page-enter">
         {/* Top Stats */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
             <Card className="flex flex-col justify-between p-5 bg-secondary/5 border-white/5 transition-all hover:border-white/10">
                 <span className="text-xs text-secondary mb-2">Alocação Alvo Total</span>
                 <p className={`text-2xl font-bold tracking-tight ${Math.abs(totalTargetAllocation - 1) > 0.01 ? 'text-red-500' : 'text-primary'}`}>
                    {(totalTargetAllocation*100).toFixed(1)}%
                 </p>
             </Card>
         </div>

         <div className="flex flex-wrap gap-3">
            <Button onClick={() => openSectorModal()} variant="primary" className="flex items-center gap-2">
               <FolderPlus size={16} /> Novo Grupo/Setor
            </Button>
            <Button onClick={() => { if(sectors.length===0){ alert('Crie um Setor antes!'); return; } openAssetModal() }} variant="outline" className="flex items-center gap-2">
               <Plus size={16} /> Novo Ativo
            </Button>
         </div>

         {/* Sector Groups rendering */}
         <div className="space-y-8">
            {Object.keys(groupedData).map(macroGroup => (
               <div key={macroGroup} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <h2 className="text-sm font-semibold text-secondary mb-4 ml-1 uppercase tracking-widest opacity-60">{macroGroup}</h2>
                  
                  <div className="grid grid-cols-1 gap-6">
                     {groupedData[macroGroup].map(({sector, assets: sectorAssets}, index) => {
                        const sectorTotalBal = sectorAssets.reduce((sum, a) => sum + a.current_balance, 0);
                        const sectorCurrentPercent = totalInWallet > 0 ? (sectorTotalBal / totalInWallet) : 0;
                        const statusObj = getSectorStatus(sector.target_percentage - sectorCurrentPercent);
                        
                        const staggerClasses = ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250']
                        const staggerClass = index < 5 ? staggerClasses[index] : ''

                        return (
                           <div key={sector.id} className={`animate-stagger-item ${staggerClass}`}>
                              <Card className="p-0 overflow-hidden border-white/5 bg-secondary/5 group/card h-full">
                              {/* Sector Header */}
                              <div className="bg-white/5 backdrop-blur-md p-5 flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-white/5">
                                 <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                       <h3 className="text-lg font-semibold text-primary tracking-tight">
                                          {sector.sector_name}
                                       </h3>
                                       {sector.id !== 'orphan' && (
                                          <div className="flex items-center gap-1 opacity-20 group-hover/card:opacity-100 transition-opacity">
                                            <button onClick={() => openSectorModal(sector)} className="text-secondary hover:text-primary transition-colors p-1" title="Editar Setor">
                                               <Edit2 size={14}/>
                                            </button>
                                            <button onClick={() => handleDeleteSector(sector.id)} className="text-[var(--color-danger)] hover:scale-110 transition-transform p-1" title="Excluir Setor">
                                               <Trash2 size={14}/>
                                            </button>
                                          </div>
                                       )}
                                    </div>
                                    <div className="flex flex-wrap gap-y-1 gap-x-4 mt-2">
                                       <span className="text-xs text-secondary">Saldo: <span className="text-primary font-bold">{formatCurrency(sectorTotalBal)}</span></span>
                                       <span className="text-xs text-secondary">Exposição: <span className="text-primary font-bold">{(sectorCurrentPercent*100).toFixed(2)}%</span></span>
                                    </div>
                                 </div>
                                 
                                 <div className="flex items-center gap-6 self-end md:self-center">
                                    {sector.id !== 'orphan' && (
                                       <div className="text-right">
                                          <div className="flex items-center gap-2 bg-black/40 p-1.5 px-3 rounded-xl border border-white/5">
                                             <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Alvo</span>
                                             <input 
                                                value={(sector.target_percentage * 100).toString().replace('.', ',')}
                                                onChange={(e) => handleUpdateSectorTarget(sector.id, e.target.value)}
                                                className="w-12 bg-transparent border-none text-right font-bold text-base text-primary focus:ring-0 p-0 tracking-tight"
                                                inputMode="decimal"
                                             />
                                             <span className="text-[10px] font-semibold text-secondary">%</span>
                                          </div>
                                          <p className={`text-[10px] mt-1.5 font-bold uppercase tracking-wider ${statusObj.color}`}>{statusObj.label}</p>
                                       </div>
                                    )}
                                 </div>
                              </div>

                              {/* Sector Assets */}
                              <div className="p-0 overflow-x-auto">
                                 <table className="w-full text-left bg-transparent min-w-[600px]">
                                    <thead>
                                       <tr className="text-xs text-secondary border-b border-white/5 uppercase font-semibold tracking-wider bg-white/5">
                                          <th className="p-4">Ticker / Título</th>
                                          {macroGroup === 'Renda Fixa' && <th className="p-4 hidden md:table-cell">Taxa</th>}
                                          {macroGroup === 'Renda Fixa' && <th className="p-4 hidden md:table-cell">Vencimento</th>}
                                          {macroGroup !== 'Renda Fixa' && <th className="p-4 hidden md:table-cell">Var. Mês</th>}
                                          <th className="p-4 text-right">Saldo Atual (R$)</th>
                                          <th className="p-4 text-center w-24">Ações</th>
                                       </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                       {sectorAssets.map(asset => (
                                          <tr key={asset.id} className="hover:bg-white/5 transition-colors group">
                                             <td className="p-4">
                                                <div className="font-semibold text-primary tracking-tight">{asset.asset_name}</div>
                                             </td>
                                             {macroGroup === 'Renda Fixa' && <td className="p-4 font-medium text-secondary/60 hidden md:table-cell text-sm">{asset.custom_rate || '—'}</td>}
                                             {macroGroup === 'Renda Fixa' && <td className="p-4 font-medium text-secondary/60 hidden md:table-cell text-sm">{asset.maturity_date || '—'}</td>}
                                             {macroGroup !== 'Renda Fixa' && <td className="p-4 font-medium text-secondary/60 hidden md:table-cell text-sm">{asset.variation_month || '—'}</td>}
                                             
                                             <td className="p-4 w-44">
                                                <Input 
                                                  value={asset.current_balance.toString().replace('.', ',')}
                                                  onChange={(e) => handleUpdateAssetBalance(asset.id, e.target.value)}
                                                  className="text-right font-bold h-9 bg-secondary border-white/5 focus:border-primary/40 text-primary"
                                                  inputMode="decimal"
                                                />
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
                                       ))}
                                       {sectorAssets.length === 0 && (
                                          <tr><td colSpan={6} className="p-4 text-center text-secondary text-sm">Nenhum ativo. Adicione!</td></tr>
                                       )}
                                    </tbody>
                                 </table>
                              </div>
                           </Card>
                         </div>
                        )
                     })}
                  </div>
               </div>
            ))}
            
            {Object.keys(groupedData).length === 0 && (
               <div className="text-center py-10 opacity-60">
                  <FolderPlus className="mx-auto h-12 w-12 mb-3"/>
                  <p>Inicie adicionando seus primeiros Setores e Ativos.</p>
               </div>
            )}
         </div>
      </div>

      {/* Modal Sector */}
      <Modal isOpen={showSectorModal} onClose={() => setShowSectorModal(false)} title={editingSector ? "Editar Grupo/Setor" : "Criar Grupo/Setor"}>
         <form onSubmit={handleSaveSector} className="space-y-4">
            <Select
               label="Macro Classe"
               value={sectorForm.macro_category}
               onChange={e => setSectorForm({...sectorForm, macro_category: e.target.value})}
               options={MACRO_CATEGORIES.map(c => ({ value: c, label: c }))}
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
    </div>
  );
}
