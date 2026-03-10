import { useEffect, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { readConflictQueue, removeConflict, type ConflictItem, enqueueOfflineOperation, flushOfflineQueue } from '@/utils/offlineQueue'
import Card from './Card'

export function ConflictResolutionModal() {
    const [conflicts, setConflicts] = useState<ConflictItem[]>([])

    const loadConflicts = () => {
        setConflicts(readConflictQueue())
    }

    useEffect(() => {
        loadConflicts()
        window.addEventListener('offline-conflict-detected', loadConflicts)
        return () => window.removeEventListener('offline-conflict-detected', loadConflicts)
    }, [])

    if (conflicts.length === 0) return null

    const currentConflict = conflicts[0]
    if (!currentConflict) return null

    const handleKeepServer = () => {
        removeConflict(currentConflict.id)
        loadConflicts()
        // By keeping server, we just drop the offline operation.
        // However, to update the UI (which currently shows the optimistic offline state), 
        // the user might need to hit refresh, or we can trigger a global refresh event.
        window.dispatchEvent(new CustomEvent('offline-queue-processed'))
    }

    const handleForceLocal = async () => {
        removeConflict(currentConflict.id)
        loadConflicts()
        // Re-enqueue the operation but with a newer createdAt to bypass the conflict check next time
        enqueueOfflineOperation({
            entity: currentConflict.queueItem.entity,
            action: currentConflict.queueItem.action,
            payload: currentConflict.queueItem.payload,
            recordId: currentConflict.queueItem.recordId,
            idempotencyKey: currentConflict.queueItem.idempotencyKey,
        })
        await flushOfflineQueue()
    }

    return (
        <Modal
            isOpen={true}
            onClose={() => { }}
            title="Conflito de Sincronização"
        >
            <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Detectamos que uma alteração que você fez offline em '{currentConflict.queueItem.entity}' conflita com uma versão mais recente salva no servidor.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Você alterou este item offline, mas outra modificação ocorreu no servidor no mesmo período. Qual versão você deseja manter?
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Card className="flex flex-col p-4">
                        <h4 className="font-semibold mb-2 text-indigo-600 dark:text-indigo-400">Versão do Servidor</h4>
                        <div className="text-xs space-y-1 mb-4 text-gray-700 dark:text-gray-300 flex-1 break-all">
                            <pre className="whitespace-pre-wrap">{JSON.stringify(currentConflict.serverData, null, 2)}</pre>
                        </div>
                        <Button variant="outline" onClick={handleKeepServer} className="mt-auto">
                            Manter Servidor
                        </Button>
                    </Card>

                    <Card className="flex flex-col p-4 border border-indigo-200 dark:border-indigo-800">
                        <h4 className="font-semibold mb-2 text-emerald-600 dark:text-emerald-400">Sua Versão (Offline)</h4>
                        <div className="text-xs space-y-1 mb-4 text-gray-700 dark:text-gray-300 flex-1 break-all">
                            <pre className="whitespace-pre-wrap">{JSON.stringify(currentConflict.queueItem.payload, null, 2)}</pre>
                        </div>
                        <Button onClick={handleForceLocal} className="mt-auto">
                            Forçar Minha Versão
                        </Button>
                    </Card>
                </div>

                {conflicts.length > 1 && (
                    <p className="text-xs text-center text-gray-500 mt-4">
                        +{conflicts.length - 1} outro(s) conflito(s) pendente(s).
                    </p>
                )}
            </div>
        </Modal>
    )
}
