/**
 * Utilitário para gerenciamento de orientação de tela.
 * Tenta travar ou liberar a orientação baseada na preferência do usuário.
 */

export const applyOrientationSettings = async (allowed: boolean) => {
  try {
    const orientation = (window.screen as any).orientation
    if (!orientation) return

    if (!allowed && orientation.lock) {
      // Tenta travar em retrato (portrait-primary é mais robusto em alguns dispositivos)
      await orientation.lock('portrait-primary').catch(() => {
        // Fallback para portrait genérico
        return orientation.lock('portrait')
      })
      console.log('Screen orientation locked to portrait')
    } else if (allowed && orientation.unlock) {
      orientation.unlock()
      console.log('Screen orientation unlocked')
    }
  } catch (error) {
    // Ignora erros (comum em navegadores que não suportam ou exigem modo tela cheia)
    console.warn('Screen orientation management not supported or failed:', error)
  }
}
