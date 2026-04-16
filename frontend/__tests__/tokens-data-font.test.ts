import { describe, it, expect } from 'vitest'
import { tokens } from '../src/tokens/tokens.ts'

describe('Design tokens - data font', () => {
  it('should have data font family defined', () => {
    expect(tokens.typography.fontFamily.data).toBeDefined()
  })
  it('data font should include DM Sans as primary', () => {
    expect(tokens.typography.fontFamily.data[0]).toBe('DM Sans')
  })
  it('data font should have sans-serif fallback', () => {
    expect(tokens.typography.fontFamily.data).toContain('sans-serif')
  })
})
