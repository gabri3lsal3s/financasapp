import { useState } from 'react'
import { format } from 'date-fns'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import IconButton from '@/components/IconButton'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import { useInvestments } from '@/hooks/useInvestments'
import { Investment } from '@/types'
import { formatCurrency, formatMonth } from '@/utils/format'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import AnimatedListItem from '@/components/AnimatedListItem'

export default function Investments() {
  const { investments, loading, createInvestment, updateInvestment, deleteInvestment } = useInvestments()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null)
  const [formData, setFormData] = useState({
    amount: '',
    month: format(new Date(), 'yyyy-MM'),
    description: '',
  })

  const handleOpenModal = (investment?: Investment) => {
    if (investment) {
      setEditingInvestment(investment)
      setFormData({
        amount: investment.amount.toString(),
        month: investment.month,
        description: investment.description || '',
      })
    } else {
      setEditingInvestment(null)
      setFormData({
        amount: '',
        month: format(new Date(), 'yyyy-MM'),
        description: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingInvestment(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.amount) return

    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const investmentData: Omit<Investment, 'id' | 'created_at'> = {
      amount,
      month: formData.month,
      description: formData.description || undefined,
    }

    if (editingInvestment) {
      const { error } = await updateInvestment(editingInvestment.id, investmentData)
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao atualizar investimento: ' + error)
      }
    } else {
      const { error } = await createInvestment(investmentData)
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao criar investimento: ' + error)
      }
    }
  }

  const [removingIds, setRemovingIds] = useState<string[]>([])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este investimento?')) return

    setRemovingIds((s) => [...s, id])

    setTimeout(async () => {
      const { error } = await deleteInvestment(id)
      if (error) {
        alert('Erro ao deletar investimento: ' + error)
      }
      setRemovingIds((s) => s.filter((x) => x !== id))
    }, 260)
  }

  return (
    <div>
      <PageHeader
        title="Investimentos"
        subtitle="Valor reservado para investimentos ou poupança"
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            Novo
          </Button>
        }
      />

      <div className="p-4 lg:p-6">
        {loading ? (
          <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Carregando...</div>
        ) : investments.length === 0 ? (
          <Card className="text-center py-8">
            <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>Nenhum investimento cadastrado</p>
            <Button onClick={() => handleOpenModal()}>Adicionar primeiro investimento</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {investments
              .sort((a, b) => b.month.localeCompare(a.month))
              .map((investment) => (
                <AnimatedListItem key={investment.id} isRemoving={removingIds.includes(investment.id)}>
                  <Card key={investment.id}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-1 h-6 rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor: 'var(--color-balance)',
                          }}
                        />
                        <p className="font-medium text-primary truncate">
                          {investment.description || 'Investimento'}
                        </p>
                      </div>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {formatMonth(investment.month)}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <IconButton
                          icon={<Edit2 size={16} />}
                          variant="neutral"
                          size="sm"
                          label="Editar investimento"
                          onClick={() => handleOpenModal(investment)}
                        />
                        <IconButton
                          icon={<Trash2 size={16} />}
                          variant="danger"
                          size="sm"
                          label="Deletar investimento"
                          onClick={() => handleDelete(investment.id)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <p className="text-lg font-semibold text-primary">
                        {formatCurrency(investment.amount)}
                      </p>
                    </div>
                  </div>
                  </Card>
                </AnimatedListItem>
              ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingInvestment ? 'Editar Investimento' : 'Novo Investimento'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Valor"
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder="0,00"
            required
          />

          <Input
            label="Mês"
            type="month"
            value={formData.month}
            onChange={(e) => setFormData({ ...formData, month: e.target.value })}
            required
          />

          <Input
            label="Descrição (opcional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ex: Reserva de emergência, Ações..."
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={handleCloseModal}
            >
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              {editingInvestment ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

