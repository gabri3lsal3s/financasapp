import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import Button from '@/components/Button'

export default function PwaUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const updateServiceWorkerRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    updateServiceWorkerRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onOfflineReady() {
        setOfflineReady(true)
      },
    })
  }, [])

  const close = () => {
    setNeedRefresh(false)
    setOfflineReady(false)
  }

  const updateNow = async () => {
    if (!updateServiceWorkerRef.current) return
    await updateServiceWorkerRef.current(true)
  }

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="fixed bottom-4 right-4 z-[1000] w-[calc(100%-2rem)] max-w-sm rounded-xl border border-primary bg-primary shadow-lg p-4 animate-surface-enter">
      <h3 className="text-sm font-semibold text-primary mb-1">
        {needRefresh ? 'Nova versão disponível' : 'Modo offline pronto'}
      </h3>
      <p className="text-xs text-secondary mb-3">
        {needRefresh
          ? 'Atualize para usar a versão mais recente do aplicativo.'
          : 'Você pode continuar usando o app mesmo sem conexão.'}
      </p>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={close}>
          Depois
        </Button>
        {needRefresh && (
          <Button type="button" size="sm" onClick={updateNow}>
            Atualizar
          </Button>
        )}
      </div>
    </div>
  )
}
