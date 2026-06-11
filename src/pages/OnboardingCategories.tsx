import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { Plus, Check, ArrowRight, Tags, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Card from '@/components/Card'
import { generateCategoryColor } from '@/utils/categoryColors'
import { getCategoryIcon } from '@/utils/categoryIcons'
import { Category, IncomeCategory } from '@/types'

export default function OnboardingCategories() {
  const navigate = useNavigate()
  const { categories, createCategory } = useCategories()
  const { incomeCategories, createIncomeCategory } = useIncomeCategories()
  const [expenseName, setExpenseName] = useState('')
  const [incomeName, setIncomeName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseName.trim()) return
    setLoading(true)
    const color = generateCategoryColor(expenseName, 'vivid')
    await createCategory({ name: expenseName.trim(), color } as Omit<Category, 'id' | 'created_at'>)
    setExpenseName('')
    setLoading(false)
  }

  const handleCreateIncome = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!incomeName.trim()) return
    setLoading(true)
    const color = generateCategoryColor(incomeName, 'vivid')
    await createIncomeCategory({ name: incomeName.trim(), color } as Omit<IncomeCategory, 'id' | 'created_at'>)
    setIncomeName('')
    setLoading(false)
  }

  const canFinish = categories.length > 0 && incomeCategories.length > 0

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-secondary px-4 py-12 sm:px-6 lg:px-8 animate-page-enter">
      <div className="app-shell-glow" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-xl space-y-8">
        <div>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tertiary">
            <Tags className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-primary">
            Bem-vindo(a) ao Finanças!
          </h2>
          <p className="mt-2 text-center text-sm text-secondary px-4">
            Para começar, precisamos criar suas primeiras categorias. Elas vão ajudar a organizar para onde vai o seu dinheiro e de onde ele vem.
          </p>
        </div>

        <Card className="mt-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Despesas */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-primary">
                <ArrowDownCircle className="text-[var(--color-expense)]" size={20} />
                <h2 className="text-lg font-semibold text-primary">Despesas</h2>
              </div>
              
              <form onSubmit={handleCreateExpense} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    id="expenseName"
                    label=""
                    placeholder="Ex: Alimentação"
                    value={expenseName}
                    onChange={(e) => setExpenseName(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!expenseName.trim() || loading}
                  variant="primary"
                  className="px-3"
                >
                  <Plus size={20} />
                </Button>
              </form>

              <div className="space-y-2 mt-4">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3 bg-secondary rounded-lg p-2.5 border border-primary animate-in slide-in-from-bottom-2">
                    <span 
                      style={{ color: cat.color }}
                      className="flex items-center justify-center flex-shrink-0"
                    >
                      {getCategoryIcon(cat.name, 16, cat.color?.split('|')[1])}
                    </span>
                    <span className="text-sm font-medium text-primary line-clamp-1">{cat.name}</span>
                    <Check size={16} className="ml-auto text-[var(--color-income)]" />
                  </div>
                ))}
                {categories.length === 0 && (
                  <div className="text-sm text-secondary text-center py-4 border border-dashed border-primary rounded-lg bg-tertiary/50">
                    Nenhuma despesa criada
                  </div>
                )}
              </div>
            </div>

            {/* Rendas */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-primary">
                <ArrowUpCircle className="text-[var(--color-income)]" size={20} />
                <h2 className="text-lg font-semibold text-primary">Rendas</h2>
              </div>
              
              <form onSubmit={handleCreateIncome} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    id="incomeName"
                    label=""
                    placeholder="Ex: Salário"
                    value={incomeName}
                    onChange={(e) => setIncomeName(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!incomeName.trim() || loading}
                  variant="primary"
                  className="px-3"
                >
                  <Plus size={20} />
                </Button>
              </form>

              <div className="space-y-2 mt-4">
                {incomeCategories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3 bg-secondary rounded-lg p-2.5 border border-primary animate-in slide-in-from-bottom-2">
                    <span 
                      style={{ color: cat.color }}
                      className="flex items-center justify-center flex-shrink-0"
                    >
                      {getCategoryIcon(cat.name, 16, cat.color?.split('|')[1])}
                    </span>
                    <span className="text-sm font-medium text-primary line-clamp-1">{cat.name}</span>
                    <Check size={16} className="ml-auto text-[var(--color-income)]" />
                  </div>
                ))}
                {incomeCategories.length === 0 && (
                  <div className="text-sm text-secondary text-center py-4 border border-dashed border-primary rounded-lg bg-tertiary/50">
                    Nenhuma renda criada
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-primary flex flex-col items-center gap-4">
            {!canFinish && (
              <p className="text-sm text-secondary animate-pulse text-center">
                Crie pelo menos 1 categoria de despesa e 1 de renda para continuar.
              </p>
            )}
            <Button 
              variant="primary" 
              fullWidth
              disabled={!canFinish}
              onClick={() => navigate('/', { replace: true })}
            >
              <div className="flex items-center justify-center gap-2 py-1">
                <span>Ir para o Dashboard</span>
                <ArrowRight size={20} />
              </div>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
