import { describe, it, expect } from 'vitest'
import * as extractors from './assistant-core/extractors'

describe('temp test', () => {
  it('loads extractors', () => {
    expect(extractors).toBeDefined()
    const amt = extractors.extractAmount('dezenove e noventa e oito')
    console.log('19.98 check:', amt)
    expect(amt).toBe(19.98)
  })
})
