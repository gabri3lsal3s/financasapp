/**
 * WebAuthn Biometric Utility
 *
 * Provides a session-unlock model:
 * 1. User logs in with email/password (Supabase session is created)
 * 2. User registers their device biometric (Face ID, Touch ID, Windows Hello, PIN)
 * 3. On subsequent visits, the stored credential is used to verify identity
 *    before granting access to the existing Supabase session.
 */

const STORAGE_KEY = 'minhas-financas:biometric-credential-id'
const RP_NAME = 'Minhas Finanças'
const RP_ID_STORAGE_KEY = 'minhas-financas:biometric-rp-id'

/** Check if WebAuthn is available in this browser/device */
export function isBiometricAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof navigator.credentials?.create === 'function' &&
    typeof navigator.credentials?.get === 'function'
  )
}

/** Check if a biometric credential has been registered on this device */
export function isBiometricRegistered(): boolean {
  return !!localStorage.getItem(STORAGE_KEY)
}

/** Returns the stored credential ID (base64url), or null */
function getStoredCredentialId(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function generateChallenge(): ArrayBuffer {
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)
  return challenge.buffer as ArrayBuffer
}

export interface BiometricResult {
  success: boolean
  error?: string
}

/**
 * Register a biometric credential for the given user.
 * Stores the credential ID in localStorage upon success.
 */
export async function registerBiometric(userId: string, userEmail: string): Promise<BiometricResult> {
  if (!isBiometricAvailable()) {
    return { success: false, error: 'WebAuthn não é suportado neste dispositivo ou navegador.' }
  }

  try {
    const challenge = generateChallenge()
    const rpId = window.location.hostname

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: RP_NAME,
          id: rpId,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: userEmail,
          displayName: userEmail.split('@')[0],
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',  // only built-in authenticators (Face ID, Touch ID, Windows Hello)
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })

    if (!credential || credential.type !== 'public-key') {
      return { success: false, error: 'Registro cancelado ou não suportado.' }
    }

    const credentialId = arrayBufferToBase64Url((credential as PublicKeyCredential).rawId)
    localStorage.setItem(STORAGE_KEY, credentialId)
    localStorage.setItem(RP_ID_STORAGE_KEY, rpId)

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'

    if (msg.includes('NotAllowedError') || msg.toLowerCase().includes('not allowed') || msg.toLowerCase().includes('pending')) {
      return { success: false, error: 'CANCELLED' }
    }
    if (msg.includes('InvalidStateError')) {
      return { success: false, error: 'Uma credencial biométrica já está registrada neste dispositivo.' }
    }
    if (msg.includes('NotSupportedError')) {
      return { success: false, error: 'Este dispositivo não suporta autenticadores de plataforma (Face ID, Touch ID, Windows Hello).' }
    }

    return { success: false, error: `Falha no registro: ${msg}` }
  }
}

/**
 * Verify the user's biometric credential.
 * Returns success if the authenticator passes the challenge.
 */
export async function verifyBiometric(): Promise<BiometricResult> {
  if (!isBiometricAvailable()) {
    return { success: false, error: 'WebAuthn não suportado.' }
  }

  const credentialId = getStoredCredentialId()
  if (!credentialId) {
    return { success: false, error: 'Nenhuma biometria registrada. Configure nas Configurações → Segurança.' }
  }

  try {
    const challenge = generateChallenge()
    const rpId = localStorage.getItem(RP_ID_STORAGE_KEY) || window.location.hostname

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId,
        allowCredentials: [
          {
            id: base64UrlToArrayBuffer(credentialId),
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    })

    if (!assertion || assertion.type !== 'public-key') {
      return { success: false, error: 'Verificação biométrica falhou.' }
    }

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'

    if (msg.includes('NotAllowedError') || msg.toLowerCase().includes('not allowed') || msg.toLowerCase().includes('pending')) {
      return { success: false, error: 'CANCELLED' }
    }
    if (msg.includes('InvalidStateError') || msg.includes('NotFoundError')) {
      // Credential no longer exists on this device — clean up
      removeBiometricCredential()
      return { success: false, error: 'Credencial biométrica não encontrada neste dispositivo. Por favor registre novamente.' }
    }

    return { success: false, error: `Falha na verificação: ${msg}` }
  }
}

/** Remove the stored biometric credential from this device */
export function removeBiometricCredential(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(RP_ID_STORAGE_KEY)
}
