import { cn } from '@/lib/utils'
import { Upload, Check, AlertCircle } from 'lucide-react'
import type { RefObject } from 'react'

interface StepUploadProps {
  fileName: string
  positionFileName: string
  parseStatus: string
  positionParseStatus: string
  dragActive: boolean
  positionDragActive: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onDrag: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onPositionDragStart: (e: React.DragEvent) => void
  onPositionDragEnd: (e: React.DragEvent) => void
  onPositionDrop: (e: React.DragEvent) => void
  onPositionFileClick: () => void
}

export default function StepUpload({
  fileName,
  positionFileName,
  parseStatus,
  positionParseStatus,
  dragActive,
  positionDragActive,
  fileInputRef,
  onDrag,
  onDrop,
  onPositionDragStart,
  onPositionDragEnd,
  onPositionDrop,
  onPositionFileClick,
}: StepUploadProps) {
  return (
    <div className="modal-form-stack w-full text-left animate-page-enter">
      <div className="flex items-center gap-3">
        <div className="modal-panel-glass flex h-10 w-10 shrink-0 items-center justify-center text-balance">
          <Upload size={20} className="animate-pulse" />
        </div>
        <div>
          <h4 className="text-sm font-black text-primary uppercase tracking-tight">
            Centro de Auditoria e Custódia B3
          </h4>
          <p className="text-[11px] text-secondary">
            Envie os relatórios oficiais da B3 para iniciar a auditoria eletrônica.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card A: Movimentações */}
        <div
          onDragEnter={onDrag}
          onDragOver={onDrag}
          onDragLeave={onDrag}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'modal-upload-zone group',
            dragActive && 'modal-upload-zone--active',
            !dragActive && fileName && 'modal-upload-zone--ready',
          )}
        >
          <div
            className={cn(
              'modal-upload-zone__icon',
              fileName && 'modal-upload-zone__icon--ready',
            )}
          >
            <Upload size={24} className={dragActive ? 'animate-bounce' : ''} />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-black text-primary uppercase tracking-wider">
              {fileName ? (
                <span className="text-primary font-mono text-[11px] block truncate max-w-[200px]" title={fileName}>
                  {fileName}
                </span>
              ) : (
                '1. Extrato de Movimentações'
              )}
            </p>
            <p className="text-[10px] text-secondary leading-relaxed px-4">
              {fileName
                ? 'Movimentações carregadas com sucesso!'
                : 'Obrigatório. Arquivo movimentacao-*.xlsx contendo aportes, retiradas e proventos.'}
            </p>
          </div>

          {fileName ? (
            <span className="modal-chip modal-chip--success">
              <Check size={10} aria-hidden /> Pronto
            </span>
          ) : (
            <span className="modal-chip">Padrão oficial B3 (.xlsx)</span>
          )}
        </div>

        {/* Card B: Posição */}
        <div
          onDragEnter={onPositionDragStart}
          onDragOver={onPositionDragStart}
          onDragLeave={onPositionDragEnd}
          onDrop={onPositionDrop}
          onClick={onPositionFileClick}
          className={cn(
            'modal-upload-zone group',
            positionDragActive && 'modal-upload-zone--active',
            !positionDragActive && positionFileName && 'modal-upload-zone--ready',
          )}
        >
          <div
            className={cn(
              'modal-upload-zone__icon',
              positionFileName && 'modal-upload-zone__icon--ready',
            )}
          >
            <Upload size={24} className={positionDragActive ? 'animate-bounce' : ''} />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-black text-primary uppercase tracking-wider">
              {positionFileName ? (
                <span className="text-primary font-mono text-[11px] block truncate max-w-[200px]" title={positionFileName}>
                  {positionFileName}
                </span>
              ) : (
                '2. Posição de Custódia'
              )}
            </p>
            <p className="text-[10px] text-secondary leading-relaxed px-4">
              {positionFileName
                ? 'Posições de custódia carregadas com sucesso!'
                : 'Recomendado. Arquivo posicao-*.xlsx para cruzar cotas finais e ajustar delta.'}
            </p>
          </div>

          {positionFileName ? (
            <span className="modal-chip modal-chip--success">
              <Check size={10} aria-hidden /> Pronto
            </span>
          ) : (
            <span className="modal-chip">Opcional (.xlsx)</span>
          )}
        </div>
      </div>

      {/* Parsing error message */}
      {(parseStatus || positionParseStatus) && (
        <div className="modal-panel-glass flex items-start gap-2.5 p-3 text-[11px] text-warning">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div className="space-y-1">
            {parseStatus && <p>{parseStatus}</p>}
            {positionParseStatus && <p>{positionParseStatus}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
