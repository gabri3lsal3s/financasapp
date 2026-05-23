import React from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { ShieldCheck } from 'lucide-react'

interface AdvisorNotesProps {
  clientNotes: string
  setClientNotes: (notes: string) => void
  onSaveNotes: (e: React.FormEvent) => void
  savingSettings: boolean
}

export default function AdvisorNotes({
  clientNotes,
  setClientNotes,
  onSaveNotes,
  savingSettings,
}: AdvisorNotesProps) {
  return (
    <Card className="p-5 lg:p-6 text-left relative overflow-hidden border border-border/40 shadow-sm">
      <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <h3 className="font-bold text-base text-primary flex items-center gap-2 mb-3">
        <ShieldCheck size={18} className="text-indigo-500" />
        Notas da Assessoria
      </h3>
      <p className="text-[11px] text-secondary mb-4 font-sans">Anote as metas de vida, reuniões e recomendações específicas do cliente</p>

      <form onSubmit={onSaveNotes} className="space-y-4">
        <div>
          <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block mb-1">Diagnóstico &amp; Notas da Conta</label>
          <textarea
            value={clientNotes}
            onChange={e => setClientNotes(e.target.value)}
            placeholder="Escreva anotações sobre a carteira do cliente, metas de vida, reuniões ou recomendações específicas..."
            rows={6}
            className="w-full bg-primary text-primary text-sm rounded-xl border border-primary p-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] font-sans"
          />
        </div>

        <Button
          type="submit"
          disabled={savingSettings}
          variant="primary"
          fullWidth
          className="text-xs py-2 font-bold shadow-md shadow-indigo-500/10"
        >
          {savingSettings ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </form>
    </Card>
  )
}
