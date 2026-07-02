import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  normalizeKey,
  isSubscriptionIgnored,
  ignoreSubscription,
  restoreSubscription,
  getIgnoredSubscriptions,
  clearAllIgnored,
} from './ignoredSubscriptions'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
})()

beforeEach(() => {
  localStorageMock.clear()
  vi.stubGlobal('localStorage', localStorageMock)
})

describe('normalizeKey', () => {
  it('lowercases and removes accents', () => {
    expect(normalizeKey('Netflix Básico')).toBe('netflixbasico')
  })

  it('removes special characters', () => {
    expect(normalizeKey('Spotify Premium!@#')).toBe('spotifypremium')
  })

  it('trims whitespace', () => {
    expect(normalizeKey('  Apple Music  ')).toBe('applemusic')
  })

  it('handles empty string', () => {
    expect(normalizeKey('')).toBe('')
  })

  it('handles strings with only special chars', () => {
    expect(normalizeKey('!!!')).toBe('')
  })
})

describe('ignoreSubscription', () => {
  it('adds a subscription to the ignored list', () => {
    const result = ignoreSubscription('Netflix')
    expect(result).toBe(true)

    const ignored = getIgnoredSubscriptions()
    expect(ignored).toHaveLength(1)
    expect(ignored[0].key).toBe('netflix')
    expect(ignored[0].displayName).toBe('Netflix')
    expect(ignored[0].ignoredAt).toBeTruthy()
  })

  it('returns false if already ignored', () => {
    ignoreSubscription('Netflix')
    const result = ignoreSubscription('Netflix')
    expect(result).toBe(false)
    expect(getIgnoredSubscriptions()).toHaveLength(1)
  })

  it('returns false for empty description', () => {
    const result = ignoreSubscription('')
    expect(result).toBe(false)
  })

  it('normalizes before comparing', () => {
    ignoreSubscription('Netflix Básico')
    const result = ignoreSubscription('Netflix Básico!')
    expect(result).toBe(false) // Already exists (normalized key: 'netflixbasico')
  })
})

describe('isSubscriptionIgnored', () => {
  it('returns true if description was ignored', () => {
    ignoreSubscription('Spotify')
    expect(isSubscriptionIgnored('Spotify')).toBe(true)
  })

  it('returns false if not ignored', () => {
    expect(isSubscriptionIgnored('Apple TV+')).toBe(false)
  })

  it('returns false for empty description', () => {
    expect(isSubscriptionIgnored('')).toBe(false)
  })

  it('matches normalized keys', () => {
    ignoreSubscription('Apple TV+')
    expect(isSubscriptionIgnored('Apple TV+')).toBe(true)
    expect(isSubscriptionIgnored('apple tv+')).toBe(true)
  })
})

describe('restoreSubscription', () => {
  it('removes a subscription from the ignored list', () => {
    ignoreSubscription('Disney+')
    expect(getIgnoredSubscriptions()).toHaveLength(1)

    restoreSubscription('Disney+')
    expect(getIgnoredSubscriptions()).toHaveLength(0)
  })

  it('does nothing for non-existent subscriptions', () => {
    restoreSubscription('HBO Max')
    expect(getIgnoredSubscriptions()).toHaveLength(0)
  })

  it('only removes the specified subscription', () => {
    ignoreSubscription('Netflix')
    ignoreSubscription('Spotify')
    expect(getIgnoredSubscriptions()).toHaveLength(2)

    restoreSubscription('Netflix')
    const remaining = getIgnoredSubscriptions()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].key).toBe('spotify')
  })

  it('matches by normalized key', () => {
    ignoreSubscription('HBO Max')
    restoreSubscription('hbo max!')
    expect(getIgnoredSubscriptions()).toHaveLength(0)
  })
})

describe('getIgnoredSubscriptions', () => {
  it('returns empty array when nothing is ignored', () => {
    expect(getIgnoredSubscriptions()).toEqual([])
  })

  it('returns all ignored subscriptions', () => {
    ignoreSubscription('A')
    ignoreSubscription('B')
    ignoreSubscription('C')
    expect(getIgnoredSubscriptions()).toHaveLength(3)
  })
})

describe('clearAllIgnored', () => {
  it('removes all ignored subscriptions', () => {
    ignoreSubscription('Netflix')
    ignoreSubscription('Spotify')
    expect(getIgnoredSubscriptions()).toHaveLength(2)

    clearAllIgnored()
    expect(getIgnoredSubscriptions()).toEqual([])
  })

  it('is safe to call when already empty', () => {
    clearAllIgnored()
    expect(getIgnoredSubscriptions()).toEqual([])
  })
})
