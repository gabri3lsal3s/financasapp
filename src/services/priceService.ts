import { supabase } from '@/lib/supabase'
import { AssetPrice } from '@/types'

// Cache em memória para evitar requisições repetidas no mesmo ciclo de renderização
const memoryPriceCache: Record<string, AssetPrice> = {}

// Cotações base de fallback para os ativos mais comuns brasileiras/americanas (caso APIs falhem ou estejam sem rede)
const FALLBACK_PRICES: Record<string, number> = {
  WEGE3: 39.50,
  VALE3: 63.80,
  PETR4: 36.20,
  ITUB4: 32.40,
  BBDC4: 14.10,
  BBAS3: 27.80,
  VOO: 475.20,
  IVVB11: 290.00,
  BOVA11: 122.50,
  SMAL11: 98.40,
  MXRF11: 10.15,
  HGLG11: 165.50,
  XPML11: 114.20,
  BTC: 345000.00,
  ETH: 18500.00,
}

/**
 * Auxiliar para mitigar erros de CORS em navegadores utilizando o proxy gratuito AllOrigins.
 * Se o proxy falhar ou estiver indisponível, faz o fetch direto como fallback.
 */
async function fetchWithCorsProxy(url: string): Promise<Response> {
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (response.ok) return response;
  } catch (err) {
    console.warn('Falha no proxy CORS, tentando fetch direto como fallback:', err);
  }
  return fetch(url);
}

/**
 * Busca cotações de uma lista de tickers de forma resiliente.
 * Lê o cache do Supabase e, se ausente ou desatualizado (> 4 horas), 
 * busca em tempo real da API pública e estável do Yahoo Finance B3 com fallback.
 */
export async function getAssetPrices(tickers: string[]): Promise<Record<string, AssetPrice>> {
  if (tickers.length === 0) return {}

  const normalizedTickers = tickers.map(t => t.trim().toUpperCase()).filter(Boolean)
  const result: Record<string, AssetPrice> = {}
  const now = new Date()

  // 1. Tentar pegar do cache em memória primeiro
  const missingInCache: string[] = []
  for (const ticker of normalizedTickers) {
    const cached = memoryPriceCache[ticker]
    // Se estiver no cache e atualizado nos últimos 5 minutos, aproveita
    if (cached && (now.getTime() - new Date(cached.last_updated).getTime() < 5 * 60 * 1000)) {
      result[ticker] = cached
    } else {
      missingInCache.push(ticker)
    }
  }

  if (missingInCache.length === 0) {
    return result;
  }

  // 2. Buscar do cache persistente no Supabase
  let supabasePrices: AssetPrice[] = []
  try {
    const { data, error } = await supabase
      .from('asset_prices')
      .select()
      .in('ticker', missingInCache)

    if (!error && data) {
      supabasePrices = data as AssetPrice[]
    }
  } catch (err) {
    console.warn('Erro ao ler cache de cotações do Supabase, operando localmente:', err)
  }

  const pricesToFetchFromApi: string[] = []
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000)

  // Mapeia o que achou no Supabase
  for (const ticker of missingInCache) {
    const found = supabasePrices.find(p => p.ticker === ticker)
    if (found && new Date(found.last_updated) > fourHoursAgo) {
      if (!found.asset_class || !found.sector) {
        const meta = getAssetMetadata(ticker)
        found.asset_class = found.asset_class || meta.asset_class
        found.sector = found.sector || meta.sector
      }
      result[ticker] = found
      memoryPriceCache[ticker] = found
    } else {
      pricesToFetchFromApi.push(ticker)
    }
  }

  // 3. Se houver tickers que precisam de atualização de API (Yahoo Finance)
  if (pricesToFetchFromApi.length > 0) {
    const fetchedPrices: Record<string, number> = {}
    
    try {
      // Mapeia os símbolos brasileiros para a extensão do Yahoo Finance (.SA)
      const yahooSymbols = pricesToFetchFromApi.map(ticker => {
        // Se for um ativo brasileiro de 5 ou 6 caracteres (Ex: WEGE3, BOVA11)
        const isB3 = /^[A-Z]{4}[0-9]{1,2}$/.test(ticker)
        return isB3 ? `${ticker}.SA` : ticker
      })

      const symbolsStr = yahooSymbols.join(',')
      // Busca cotações através do proxy CORS para evitar bloqueios no navegador
      const response = await fetchWithCorsProxy(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolsStr}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data && data.quoteResponse && data.quoteResponse.result) {
          for (const item of data.quoteResponse.result) {
            if (item.symbol && item.regularMarketPrice !== undefined) {
              const cleanTicker = item.symbol.replace('.SA', '').toUpperCase()
              fetchedPrices[cleanTicker] = item.regularMarketPrice
            }
          }
        }
      }
    } catch (apiErr) {
      console.warn('API de cotações do Yahoo Finance indisponível. Usando cotações locais:', apiErr)
    }

    // Processa os tickers atualizados e preenche fallbacks para os que falharam
    const updatesToSave: Omit<AssetPrice, 'last_updated'>[] = []
    
    for (const ticker of pricesToFetchFromApi) {
      let price = fetchedPrices[ticker]
      
      let quotationStatus: AssetPrice['quotation_status'] = 'live'
      if (price === undefined) {
        const oldPrice = supabasePrices.find(p => p.ticker === ticker)
        if (oldPrice) {
          price = Number(oldPrice.current_price)
          quotationStatus = 'stale'
        } else if (FALLBACK_PRICES[ticker] !== undefined) {
          price = FALLBACK_PRICES[ticker]
          quotationStatus = 'fallback_static'
        } else {
          price = 0
          quotationStatus = 'unavailable'
        }
      }

      const meta = getAssetMetadata(ticker)
      const assetPrice: AssetPrice = {
        ticker,
        current_price: price,
        last_updated: now.toISOString(),
        asset_class: meta.asset_class,
        sector: meta.sector,
        quotation_status: quotationStatus,
      }

      result[ticker] = assetPrice
      memoryPriceCache[ticker] = assetPrice
      if (quotationStatus === 'live' && price > 0) {
        updatesToSave.push({
          ticker,
          current_price: price,
          asset_class: meta.asset_class,
          sector: meta.sector,
        })
      }
    }

    // 4. Salvar novas cotações de volta no cache do Supabase em background
    if (updatesToSave.length > 0) {
      const savePricesBackground = async () => {
        try {
          await supabase
            .from('asset_prices')
            .upsert(updatesToSave)
        } catch (err) {
          console.error('Erro de conexão ao salvar cotações:', err)
        }
      }
      savePricesBackground()
    }
  }

  return result
}

/**
 * Atualiza forçadamente uma cotação manualmente (ex: se o consultor souber a cotação exata).
 */
export async function forceUpdateAssetPrice(ticker: string, price: number): Promise<AssetPrice | null> {
  const normTicker = ticker.trim().toUpperCase()
  const now = new Date()
  const meta = getAssetMetadata(normTicker)
  const assetPrice: AssetPrice = {
    ticker: normTicker,
    current_price: price,
    last_updated: now.toISOString(),
    asset_class: meta.asset_class,
    sector: meta.sector
  }

  memoryPriceCache[normTicker] = assetPrice

  try {
    const { data, error } = await supabase
      .from('asset_prices')
      .upsert({ 
        ticker: normTicker, 
        current_price: price,
        asset_class: meta.asset_class,
        sector: meta.sector
      })
      .select()
      .single()

    if (!error && data) {
      return data as AssetPrice
    }
  } catch (err) {
    console.error('Erro ao forçar atualização de cotação:', err)
  }

  return assetPrice
}

export interface SearchedAsset {
  ticker: string
  name: string
}

/**
 * Pesquisa ativos B3 / Internacionais em tempo real no Yahoo Finance.
 * Usado para o autocomplete de ativos do dashboard.
 */
export async function searchB3Assets(query: string): Promise<SearchedAsset[]> {
  const q = query.trim()
  if (q.length < 2) return []

  try {
    const response = await fetchWithCorsProxy(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`)
    if (response.ok) {
      const data = await response.json()
      if (data && data.quotes) {
        return data.quotes
          .filter((item: any) => {
            // Filtra apenas ativos da B3 (.SA) ou mercado global sem pontos no símbolo
            return item.symbol && (item.symbol.endsWith('.SA') || !item.symbol.includes('.'))
          })
          .map((item: any) => {
            const ticker = item.symbol.replace('.SA', '').toUpperCase()
            return {
              ticker,
              name: item.shortname || item.longname || ticker
            }
          })
      }
    }
  } catch (err) {
    console.error('Erro ao pesquisar ativos na B3/Yahoo:', err)
  }

  // Fallback local se estiver offline
  return Object.keys(FALLBACK_PRICES)
    .filter(t => t.startsWith(q.toUpperCase()))
    .map(t => ({ ticker: t, name: `${t} Asset` }))
}

export interface AssetRichData {
  ticker: string
  price: number
  name: string
  dividendYield?: number
  dividendRate?: number
}

const memoryRichCache: Record<string, AssetRichData> = {}

/**
 * Obtém dados ricos de um ativo (Cotação e Dividend Yield) do Yahoo Finance.
 */
export async function getAssetRichData(ticker: string): Promise<AssetRichData | null> {
  const normTicker = ticker.trim().toUpperCase()
  if (!normTicker) return null

  if (memoryRichCache[normTicker]) {
    return memoryRichCache[normTicker]
  }

  try {
    const isB3 = /^[A-Z]{4}[0-9]{1,2}$/.test(normTicker)
    const symbol = isB3 ? `${normTicker}.SA` : normTicker
    const response = await fetchWithCorsProxy(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`)
    
    if (response.ok) {
      const data = await response.json()
      if (data && data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result.length > 0) {
        const item = data.quoteResponse.result[0]
        const richData: AssetRichData = {
          ticker: normTicker,
          price: item.regularMarketPrice || 0,
          name: item.shortName || item.longName || normTicker,
          dividendYield: item.trailingAnnualDividendYield ? item.trailingAnnualDividendYield * 100 : undefined,
          dividendRate: item.trailingAnnualDividendRate
        }
        memoryRichCache[normTicker] = richData
        return richData
      }
    }
  } catch (err) {
    console.error('Erro ao buscar dados ricos do ativo:', err)
  }

  return null
}

/**
 * Mapeia automaticamente um ticker para classe de ativos e setor (consultoria / carteira).
 * Suporta Ações B3, FIIs, ETFs Nacionais/Internacionais, Ações US e Criptoativos.
 */
export function getAssetMetadata(ticker: string): { asset_class: string; sector: string } {
  const t = ticker.trim().toUpperCase()
  
  // 1. Criptomoedas
  if (t.endsWith('BTC') || t.endsWith('ETH') || t.endsWith('USDT') || ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT'].includes(t)) {
    return { asset_class: 'Criptoativos', sector: 'Tecnologia Blockchain' }
  }
  
  // Lista de UNITs comuns da B3 que terminam em 11 mas são Ações (não FIIs/ETFs)
  const isBrUnit = ['TAEE11', 'KLBN11', 'SANB11', 'BPAC11', 'ALUP11', 'RAPT11', 'SAPR11', 'ENGI11', 'SULA11'].includes(t)
  
  // 2. Fundos Imobiliários Brasileiros (terminam com 11 e começam com 4 letras, ex: MXRF11, HGLG11)
  const isFii = /^[A-Z]{4}11$/.test(t) && !isBrUnit && !['BOVA11', 'SMAL11', 'IVVB11', 'ECOO11', 'DIVO11', 'PIBB11'].includes(t)
  if (isFii) {
    if (['HGLG11', 'XPLG11', 'VILG11', 'BTLG11', 'GALG11'].includes(t)) {
      return { asset_class: 'Fundos Imobiliários', sector: 'Logística e Galpões' }
    }
    if (['HGRU11', 'TRXF11'].includes(t)) {
      return { asset_class: 'Fundos Imobiliários', sector: 'Varejo e Renda Urbana' }
    }
    if (['KNRI11', 'JSRE11', 'HGRE11'].includes(t)) {
      return { asset_class: 'Fundos Imobiliários', sector: 'Lajes Corporativas' }
    }
    if (['MXRF11', 'KNCR11', 'CPTS11', 'HGCR11', 'RBRR11', 'IRDM11', 'KNSC11', 'VGIP11', 'MCCI11', 'VRTA11'].includes(t)) {
      return { asset_class: 'Fundos Imobiliários', sector: 'Papéis e Recebíveis (CRIs)' }
    }
    if (['XPML11', 'VISC11', 'HSML11', 'MALL11'].includes(t)) {
      return { asset_class: 'Fundos Imobiliários', sector: 'Shopping Centers' }
    }
    if (['HFOF11', 'BCFF11', 'KFOF11'].includes(t)) {
      return { asset_class: 'Fundos Imobiliários', sector: 'Fundos de Fundos (FoFs)' }
    }
    return { asset_class: 'Fundos Imobiliários', sector: 'Imobiliário Diversificado' }
  }
  
  // 3. ETFs Comuns (B3 ou Internacionais)
  if (['BOVA11', 'SMAL11', 'IVVB11', 'VOO', 'IVV', 'SPY', 'QQQ', 'VT', 'VNQ', 'BND', 'HASH11', 'QBTC11'].includes(t)) {
    if (['BOVA11', 'SMAL11'].includes(t)) {
      return { asset_class: 'ETFs Nacionais', sector: 'Índices Nacionais (B3)' }
    }
    if (['IVVB11', 'VOO', 'IVV', 'SPY', 'QQQ', 'VT'].includes(t)) {
      return { asset_class: 'ETFs Internacionais', sector: 'Índices Internacionais (EUA)' }
    }
    if (['HASH11', 'QBTC11'].includes(t)) {
      return { asset_class: 'ETFs Internacionais', sector: 'Criptoativos' }
    }
    return { asset_class: 'ETFs', sector: 'Índices de Mercado' }
  }

  // 4. BDRs Brasileiras (terminam com 34, ex: AAPL34, TSLA34)
  const isBdr = /^[A-Z]{4}34$/.test(t)
  if (isBdr) {
    return { asset_class: 'Ações Internacionais', sector: 'BDRs / Mercado Global' }
  }

  // Ações Americanas / Internacionais (3 ou 4 letras sem número, ex: AAPL, MSFT)
  const isUsStock = /^[A-Z]{3,4}$/.test(t) && !['CDI', 'SELIC', 'IPCA'].includes(t)
  if (isUsStock) {
    if (['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'NVDA', 'AMD', 'INTC'].includes(t)) {
      return { asset_class: 'Ações Internacionais', sector: 'Tecnologia da Informação' }
    }
    if (['TSLA', 'AMZN', 'HD', 'NKE'].includes(t)) {
      return { asset_class: 'Ações Internacionais', sector: 'Consumo Cíclico' }
    }
    if (['META', 'NFLX', 'DIS', 'CMCSA'].includes(t)) {
      return { asset_class: 'Ações Internacionais', sector: 'Serviços de Comunicação' }
    }
    if (['JPM', 'BAC', 'WFC', 'C', 'V', 'MA'].includes(t)) {
      return { asset_class: 'Ações Internacionais', sector: 'Financeiro' }
    }
    if (['JNJ', 'PFE', 'UNH', 'ABBV', 'MRK'].includes(t)) {
      return { asset_class: 'Ações Internacionais', sector: 'Saúde' }
    }
    if (['XOM', 'CVX'].includes(t)) {
      return { asset_class: 'Ações Internacionais', sector: 'Energia' }
    }
    return { asset_class: 'Ações Internacionais', sector: 'EUA / Global Diversificado' }
  }

  // 5. Ações Brasileiras (terminam com 3, 4, 5, 6, 7, 8, ou UNITs do array isBrUnit)
  const isBrStock = /^[A-Z]{4}[345678]$/.test(t) || isBrUnit
  if (isBrStock) {
    if (['PETR4', 'PETR3', 'RECV3', 'PRIO3', 'RRRP3', 'UGPA3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Petróleo, Gás e Biocombustíveis' }
    }
    if (['VALE3', 'CSNA3', 'GGBR4', 'USIM5', 'KLBN11', 'SUZB3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Materiais Básicos (Mineração/Siderurgia)' }
    }
    if (['ITUB4', 'ITUB3', 'BBDC4', 'BBDC3', 'BBAS3', 'SANB11', 'BPAC11', 'CXSE3', 'BBSE3', 'PSSA3', 'IRBR3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Financeiro e Seguros' }
    }
    if (['ELET3', 'ELET6', 'CPLE6', 'EGIE3', 'ENGI11', 'TAEE11', 'ALUP11', 'TRPL4', 'CMIG4', 'SBSP3', 'CSMG3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Utilidade Pública (Energia/Saneamento)' }
    }
    if (['WEGE3', 'TUPY3', 'EMBR3', 'RAPT4', 'POMO4'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Bens Industriais' }
    }
    if (['LREN3', 'MGLU3', 'VIIA3', 'BHIA3', 'AREZ3', 'SOMA3', 'ALPA4', 'PETZ3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Consumo Cíclico (Varejo)' }
    }
    if (['ABEV3', 'JBSS3', 'BRFS3', 'MRFG3', 'BEEF3', 'MDIA3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Consumo Não Cíclico (Alimentos/Bebidas)' }
    }
    if (['HAPV3', 'RADL3', 'FLRY3', 'ONCO3', 'RDNI3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Saúde' }
    }
    if (['RENT3', 'MOVI3', 'JSLG3', 'RAIL3', 'STBP3', 'AZUL4', 'GOLL4'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Bens Industriais (Logística/Transporte)' }
    }
    if (['VIVT3', 'TIMS3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Telecomunicações' }
    }
    return { asset_class: 'Ações Nacionais', sector: 'Consumo e Indústria Geral' }
  }

  // 6. Renda Fixa
  if (['CDI', 'SELIC', 'IPCA', 'TESOURO', 'LCI', 'LCA', 'CDB', 'DEBENTURE'].some(rf => t.includes(rf))) {
    return { asset_class: 'Renda Fixa', sector: 'Títulos Públicos/Privados' }
  }

  // Fallback geral
  return { asset_class: 'Não classificado', sector: 'Indefinido' }
}

/** Indica se o ticker segue o padrão de código B3 (4 letras + 1–2 dígitos). */
export function isB3TickerPattern(ticker: string): boolean {
  return /^[A-Z]{4}[0-9]{1,2}$/.test(ticker.trim().toUpperCase())
}
