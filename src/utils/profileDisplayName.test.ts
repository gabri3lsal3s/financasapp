import { describe, expect, it } from 'vitest'
import { ADMIN_EMAIL } from '@/constants/adminProfile'
import { profileSelectSublabel, resolveProfileDisplayName } from './profileDisplayName'

describe('resolveProfileDisplayName', () => {
  it('usa full_name quando cadastrado', () => {
    expect(
      resolveProfileDisplayName({
        email: 'cliente@example.com',
        full_name: 'Maria Silva',
      })
    ).toBe('Maria Silva')
  })

  it('repete o e-mail quando não há nome', () => {
    expect(
      resolveProfileDisplayName({
        email: 'cliente@example.com',
        full_name: null,
      })
    ).toBe('cliente@example.com')
  })

  it('exibe Gabriel Sales para o super admin', () => {
    expect(
      resolveProfileDisplayName({
        email: ADMIN_EMAIL,
        full_name: null,
      })
    ).toBe('Gabriel Sales')
  })

  it('deriva nome de cliente provisório (domínio atual)', () => {
    expect(
      resolveProfileDisplayName({
        email: 'temp_joao_silva_x7k2m9@provisional.internal',
      })
    ).toBe('Joao Silva (Provisório)')
  })

  it('deriva nome de cliente provisório (domínio legado)', () => {
    expect(
      resolveProfileDisplayName({
        email: 'temp_joao_silva_x7k2m9@cerrado.internal',
      })
    ).toBe('Joao Silva (Provisório)')
  })
})

describe('profileSelectSublabel', () => {
  it('retorna apenas o e-mail do cliente', () => {
    expect(
      profileSelectSublabel(
        { id: 'u1', email: 'me@example.com' },
        { selfUserId: 'u1' }
      )
    ).toBe('me@example.com')
  })
})
