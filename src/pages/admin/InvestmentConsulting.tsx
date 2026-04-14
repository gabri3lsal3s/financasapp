import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight, UserPlus, FileText, Settings } from 'lucide-react';
import Button from '@/components/Button';
import Loader from '@/components/Loader';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import ModalActionFooter from '@/components/ModalActionFooter';

interface ConsultingClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
}

export default function InvestmentConsulting() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ConsultingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [editingClient, setEditingClient] = useState<ConsultingClient | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('consulting_clients')
        .select('*')
        .order('name'); // Ordem alfabética para facilitar busca

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (client?: ConsultingClient) => {
    if (client) {
      setEditingClient(client);
      setNewClientName(client.name);
      setNewClientEmail(client.email || '');
    } else {
      setEditingClient(null);
      setNewClientName('');
      setNewClientEmail('');
    }
    setShowAddModal(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    try {
      if (editingClient) {
        const { error } = await supabase
          .from('consulting_clients')
          .update({ name: newClientName, email: newClientEmail })
          .eq('id', editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('consulting_clients')
          .insert([{ name: newClientName, email: newClientEmail }]);
        if (error) throw error;
      }

      setNewClientName('');
      setNewClientEmail('');
      setShowAddModal(false);
      setEditingClient(null);
      fetchClients();
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Erro ao salvar cliente');
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o cliente ${name}? Isso apagará todo o histórico de carteira e relatórios!`)) return;
    try {
      const { error } = await supabase.from('consulting_clients').delete().eq('id', id);
      if (error) throw error;
      setShowAddModal(false);
      setEditingClient(null);
      fetchClients();
    } catch (e) {
      alert("Erro ao excluir cliente");
    }
  };

  return (
    <div>
      <PageHeader
        title="Consultoria de Investimentos"
        subtitle="Gerencie a carteira de seus clientes"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => navigate('/admin/consulting/reports')} variant="ghost" className="flex items-center gap-2">
              <FileText size={16} />
              <span className="hidden sm:inline">Relatórios</span>
            </Button>
            <Button size="sm" onClick={() => handleOpenModal()} variant="outline" className="flex items-center gap-2">
              <UserPlus size={16} />
              <span className="hidden sm:inline">Novo Cliente</span>
            </Button>
          </div>
        }
      />

      <div className="p-4 lg:p-6 space-y-6 animate-page-enter">
        {loading ? (
           <Loader text="Carregando lista de clientes..." className="py-12" />
        ) : clients.length === 0 ? (
          <Card className="text-center py-16 space-y-4 bg-secondary/20 border-dashed border-2">
             <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto">
                <Users className="h-10 w-10 text-primary opacity-60" />
             </div>
             <div className="space-y-1">
                <p className="text-xl font-black text-primary">Nenhum cliente cadastrado</p>
                <p className="text-secondary text-sm max-w-xs mx-auto">Comece adicionando seu primeiro cliente para iniciar a gestão de carteira detalhada.</p>
             </div>
             <div className="pt-4">
               <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-primary/20">Adicionar Cliente Agora</Button>
             </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client, index) => {
              const staggerClasses = ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250']
              const staggerClass = index < 5 ? staggerClasses[index] : ''
              
              return (
                <div key={client.id} className={`animate-stagger-item ${staggerClass}`}>
                  <Card 
                    className="group relative overflow-hidden p-0 hover:border-primary/40 transition-all duration-500 cursor-pointer shadow-lg hover:shadow-primary/5 bg-secondary/10 border-white/5 h-full"
                    onClick={() => navigate(`/admin/consulting/${client.id}`)}
                  >
                    {/* Accent bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-all duration-500" />
                    
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="bg-primary/5 p-3 rounded-2xl group-hover:bg-primary/20 transition-colors">
                            <Users className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/5">
                              <div className={`w-2 h-2 rounded-full animate-pulse ${client.status === 'active' ? 'bg-[#10b981]' : 'bg-gray-500'}`} />
                              <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
                                {client.status === 'active' ? 'Ativo' : 'Inativo'}
                              </span>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleOpenModal(client); }} 
                              className="p-1.5 rounded-lg bg-white/5 md:bg-white/5 hover:bg-white/10 text-secondary hover:text-primary transition-all opacity-100 md:opacity-0 group-hover:opacity-100"
                            >
                               <Settings size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <h3 className="text-2xl font-black text-primary tracking-tighter transition-colors duration-300">
                            {client.name}
                          </h3>
                          {client.email ? (
                            <p className="text-sm text-secondary font-black truncate opacity-40">{client.email}</p>
                          ) : (
                            <p className="text-xs text-secondary/30 font-black italic">Sem e-mail cadastrado</p>
                          )}
                        </div>
                        
                        <div className="mt-8 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100 transition-opacity">
                            Gestão de Carteira
                          </div>
                          <div className="flex items-center gap-2 text-primary font-black text-sm">
                            <div className="p-1 text-secondary/40 md:text-primary/40 group-hover:text-primary transition-all duration-300">
                              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </div>
                    </div>

                    {/* Hover Glow */}
                    <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-primary/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </Card>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={editingClient ? "Editar dados do cliente" : "Adicionar novo cliente"}>
         <form onSubmit={handleSaveClient} className="w-full max-w-md mx-auto space-y-4">
            <Input
              label="Nome Completo"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="Ex: João da Silva"
              required
            />
            <Input
              label="E-mail de Integração"
              type="email"
              value={newClientEmail}
              onChange={(e) => setNewClientEmail(e.target.value)}
              placeholder="joao@exemplo.com"
              description="Este e-mail será usado para sincronizar os dados com o usuário final."
            />
            <ModalActionFooter
               onCancel={() => setShowAddModal(false)}
               submitLabel={editingClient ? "Atualizar" : "Salvar"}
               deleteLabel={editingClient ? "Excluir Cliente" : undefined}
               onDelete={editingClient ? () => handleDeleteClient(editingClient.id, editingClient.name) : undefined}
            />
         </form>
      </Modal>
    </div>
  );
}
