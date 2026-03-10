import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export default function NetworkStatusToast() {
    const { isOnline } = useNetworkStatus()
    const [isVisible, setIsVisible] = useState(false)
    // Track hasBeenOnline to avoid showing the "offline" toast on initial load if we start offline,
    // or maybe we DO want to show it on initial load if offline? The user said: "O card não deve mais aparecer ao abrir o app para avisar que o offline está disponível."
    // So not showing "offline is available" (which was PWA). But showing that you ARE offline is fine, but we'll debounce it.

    useEffect(() => {
        let showTimeout: NodeJS.Timeout
        let hideTimeout: NodeJS.Timeout

        if (!isOnline) {
            // Debounce showing the toast to avoid flickering on unstable connections
            showTimeout = setTimeout(() => {
                setIsVisible(true)

                // Auto-dismiss after 5 seconds
                hideTimeout = setTimeout(() => {
                    setIsVisible(false)
                }, 5000)
            }, 2000) // Wait 2s of offline before showing
        } else {
            // If back online, immediately hide and clear timeouts
            setIsVisible(false)
        }

        return () => {
            clearTimeout(showTimeout)
            clearTimeout(hideTimeout)
        }
    }, [isOnline])

    if (!isVisible) return null

    return (
        <div className="fixed bottom-4 right-4 z-[1000] w-[calc(100%-2rem)] max-w-sm rounded-xl border border-orange-600/50 bg-[var(--color-bg-secondary)] shadow-lg p-4 animate-surface-enter flex items-center gap-3">
            <div className="flex-shrink-0 text-orange-500 rounded-full bg-orange-50 dark:bg-orange-500/10 p-2">
                <WifiOff size={20} />
            </div>
            <div>
                <h3 className="text-sm font-semibold text-primary mb-1">
                    Você está offline
                </h3>
                <p className="text-xs text-secondary">
                    Algumas funcionalidades ficarão restritas e os dados podem estar desatualizados.
                </p>
            </div>
        </div>
    )
}
