// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFormAmountSync } from '@/hooks/useFormAmountSync'

describe('useFormAmountSync', () => {
  it('sincroniza reportAmount quando reportAmount é igual a amount', () => {
    const setAmounts = vi.fn()
    const { result } = renderHook(() =>
      useFormAmountSync({
        amount: 100,
        reportAmount: 100,
        setAmounts,
      })
    )

    result.current.handleAmountChange(150)
    expect(setAmounts).toHaveBeenCalledWith({
      amount: 150,
      report_amount: 150,
    })
  })

  it('preserva reportAmount = 0 quando o usuário definiu 0 no relatório e altera amount', () => {
    const setAmounts = vi.fn()
    const { result } = renderHook(() =>
      useFormAmountSync({
        amount: 100,
        reportAmount: 0,
        setAmounts,
      })
    )

    result.current.handleAmountChange(150)
    expect(setAmounts).toHaveBeenCalledWith({
      amount: 150,
      report_amount: 0,
    })
  })

  it('preserva reportAmount = null (vazio) quando o usuário não preencheu o campo', () => {
    const setAmounts = vi.fn()
    const { result } = renderHook(() =>
      useFormAmountSync({
        amount: 0,
        reportAmount: null,
        setAmounts,
      })
    )

    result.current.handleAmountChange(50)
    expect(setAmounts).toHaveBeenCalledWith({
      amount: 50,
      report_amount: null,
    })
  })

  it('preserva reportAmount = 0 quando o usuário definiu 0 no relatório e altera amount', () => {
    const setAmounts = vi.fn()
    const { result } = renderHook(() =>
      useFormAmountSync({
        amount: 100,
        reportAmount: 0,
        setAmounts,
      })
    )

    result.current.handleAmountChange(150)
    expect(setAmounts).toHaveBeenCalledWith({
      amount: 150,
      report_amount: 0,
    })
  })
})
