import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import Button from '@/components/Button'

export default function PwaUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateServiceWorkerRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    updateServiceWorkerRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
    })
  }, [])

  const close = () => {
    setNeedRefresh(false)
  }

  const updateNow = async () => {
    if (!updateServiceWorkerRef.current) return
    await updateServiceWorkerRef.current(true)
  }

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 right-4 z-[1000] w-[calc(100%-2rem)] max-w-sm rounded-xl border border-primary bg-primary shadow-lg p-4 animate-surface-enter">
      <h3 className="text-sm font-semibold text-primary mb-1">
        Nova versão disponível
      </h3>
      <p className="text-xs text-secondary mb-3">
        Atualize para usar a versão mais recente do aplicativo.
      </p>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={close}>
          Depois
        </Button>
        <Button type="button" size="sm" onClick={updateNow}>
          Atualizar
        </Button>
      </div>
    </div>
  )
}
