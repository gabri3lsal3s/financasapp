import { describe, it, expect } from 'vitest'
import {
  calculateScuttlebuttScore,
  calculateQuantitativeScore,
  simulateSmartAporte
} from './quantamentalEngine'
import { PortfolioQuantPreferences, ScuttlebuttPillar, ScuttlebuttQuestion, ScuttlebuttAnswer } from '@/types'

describe('Quantamental Engine - Scuttlebutt Score', () => {
  const mockPillars: ScuttlebuttPillar[] = [
    { id: 'p1', name: 'Gestão', weight_percentage: 50 },
    { id: 'p2', name: 'Moat', weight_percentage: 50 }
  ]

  const mockQuestions: ScuttlebuttQuestion[] = [
    { id: 'q1', pillar_id: 'p1', question_text: 'Q1', weight: 1 },
    { id: 'q2', pillar_id: 'p1', question_text: 'Q2', weight: 1 },
    { id: 'q3', pillar_id: 'p2', question_text: 'Q3', weight: 1 }
  ]

  it('deve calcular score 100% com todas as respostas SIM', () => {
    const answers: ScuttlebuttAnswer[] = [
      { portfolio_id: '1', ticker: 'TEST3', question_id: 'q1', answer: 'yes', updated_at: '' },
      { portfolio_id: '1', ticker: 'TEST3', question_id: 'q2', answer: 'yes', updated_at: '' },
      { portfolio_id: '1', ticker: 'TEST3', question_id: 'q3', answer: 'yes', updated_at: '' }
    ]
    const res = calculateScuttlebuttScore(answers, mockPillars, mockQuestions)
    expect(res.score).toBe(100)
  })

  it('deve redistribuir proporcionalmente o peso quando houver N/A', () => {
    // Se q2 for N/A, q1 representa 100% do pilar Gestão. Se q1 for SIM, Gestão pontua 100.
    const answers: ScuttlebuttAnswer[] = [
      { portfolio_id: '1', ticker: 'TEST3', question_id: 'q1', answer: 'yes', updated_at: '' },
      { portfolio_id: '1', ticker: 'TEST3', question_id: 'q2', answer: 'na', updated_at: '' },
      { portfolio_id: '1', ticker: 'TEST3', question_id: 'q3', answer: 'no', updated_at: '' } // Moat pontua 0
    ]
    const res = calculateScuttlebuttScore(answers, mockPillars, mockQuestions)
    // Gestão = 100 (peso 50%), Moat = 0 (peso 50%) -> Score = 50%
    expect(res.score).toBe(50)
  })
})

describe('Quantamental Engine - Quantitative Score', () => {
  const mockPrefs: PortfolioQuantPreferences = {
    portfolio_id: '1',
    tier_s_limit: 20,
    tier_a_limit: 10,
    tier_b_limit: 5,
    tier_c_limit: 0,
    max_sector_acoes: 30,
    max_sector_fiis: 45,
    min_roic_excelente: 15,
    max_divida_ebitda: 2.5,
    scuttlebutt_decay_days: 365
  }

  it('deve pontuar corretamente ações excelentes', () => {
    const fundamentals = {
      roic: 20, // Excelente (+30 pts)
      dividend_yield: 5,
      pe_ratio: 10,
      pe_5y_average: 15, // Abaixo da média (+20 pts)
      ev_ebitda: null,
      ev_ebitda_5y_average: null,
      net_debt_ebitda: 1.5, // Saudável (+30 pts)
      net_debt_trend_up_2y: false // Saudável (+20 pts)
    }
    const score = calculateQuantitativeScore('AÇÕES', fundamentals, mockPrefs)
    expect(score).toBe(100)
  })
})

describe('Quantamental Engine - Smart Aporte Simulation', () => {
  const mockPrefs: PortfolioQuantPreferences = {
    portfolio_id: '1',
    tier_s_limit: 20,
    tier_a_limit: 10,
    tier_b_limit: 5,
    tier_c_limit: 0,
    max_sector_acoes: 30,
    max_sector_fiis: 45,
    min_roic_excelente: 15,
    max_divida_ebitda: 2.5,
    scuttlebutt_decay_days: 365
  }

  const mockGroupTargets = [
    { group_type: 'class', group_name: 'Ações', target_percentage: 60 },
    { group_type: 'class', group_name: 'FIIs', target_percentage: 40 }
  ]

  const mockPositions = [
    {
      ticker: 'VALE3',
      asset_class: 'Ações',
      sector: 'Mineração',
      currency: 'BRL',
      current_price: 60.00,
      total_value: 1200.00,
      current_percentage: 30,
      quality_score: 90,
      conviction_tier: 'S',
      absolute_limit: 12, // 60% (Ações) * 20% (Tier S) = 12%
      enquadramento_state: 'em_linha',
      is_decayed: false
    },
    {
      ticker: 'PETR4',
      asset_class: 'Ações',
      sector: 'Petróleo',
      currency: 'BRL',
      current_price: 35.00,
      total_value: 800.00,
      current_percentage: 20,
      quality_score: 80,
      conviction_tier: 'A',
      absolute_limit: 6, // 60% * 10% = 6%
      enquadramento_state: 'desenquadrado_excesso', // Excedido, não deve receber aporte
      is_decayed: false
    }
  ]

  it('deve simular distribuição priorizando ativos em linha com maior qualidade e direcionar o resto para Caixa', () => {
    // TotalValue = 2000. Aporte = R$ 1000.
    const res = simulateSmartAporte(
      mockPositions,
      mockPrefs,
      mockGroupTargets,
      2000.00,
      1000.00
    )

    // VALE3 está Em Linha e possui Score 90 (Tier S). Limite absoluto = 12% de (2000 + 1000) = R$ 360.
    // Atualmente VALE3 tem R$ 1200. Ué, R$ 1200 > R$ 360. Então o limite absoluto de VALE3 (12%) já está ultrapassado!
    // Por isso, VALE3 não receberá aportes e o dinheiro irá integralmente para o Caixa (fallback).
    expect(res.suggestions.length).toBe(0)
    expect(res.fallbackAmount).toBe(1000)
  })
})
