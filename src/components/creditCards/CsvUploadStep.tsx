import { useRef } from 'react'
import Button from '@/components/Button'

interface CsvUploadStepProps {
  fileName: string
  onFileSelected: (file: File) => void
}

export default function CsvUploadStep({ fileName, onFileSelected }: CsvUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="modal-panel-glass p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Importação Automática</p>
          <p className="text-xs text-secondary mt-1">
            Importa o CSV da fatura e sugere categorias com base no seu histórico de conciliações.
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFileSelected(file)
        }}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => fileInputRef.current?.click()}
        >
          Escolher arquivo CSV
        </Button>
        {fileName && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-tertiary border border-glass max-w-full overflow-hidden">
            <p className="text-xs text-secondary truncate">{fileName}</p>
          </div>
        )}
      </div>
    </div>
  )
}
