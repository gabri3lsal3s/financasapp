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
  VINO11: 7.20,
  XPLG11: 94.50,
  BTLG11: 102.30,
  KNIP11: 96.10,
  KNCR11: 102.50,
  VISC11: 112.40,
  MALL11: 115.60,
  TRXF11: 104.20,
  HGRU11: 125.40,
  BTC: 345000.00,
  ETH: 18500.00,
  'USDBRL=X': 5.25,
}

/**
 * Lê uma resposta HTTP como texto e tenta decodificar o JSON com segurança.
 * Em caso de erro de parsing, lança um SyntaxError com o início do conteúdo recebido,
 * facilitando o diagnóstico (ex: "Edge: Too Many Requests").
 */
async function safeJson(response: Response): Promise<any> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new SyntaxError(`Resposta inválida do servidor: ${text.slice(0, 80)}`)
  }
}

/**
 * Auxiliar para mitigar erros de CORS em navegadores utilizando múltiplos proxies CORS de backup.
 * Lista priorizada: corsproxy.io → codetabs → allorigins (como último recurso).
 * Valida se o conteúdo retornado é um JSON legível para evitar que páginas/erros em texto
 * interrompam o fluxo antes de tentar os demais proxies. Se todos falharem, tenta requisição direta.
 */
async function fetchWithCorsProxy(url: string, init?: RequestInit): Promise<Response> {
  const proxies = [
    (targetUrl: string) => `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
    (targetUrl: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
    (targetUrl: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
  ];

  let lastError: any = null;

  for (let i = 0; i < proxies.length; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // Reduzido de 6s para 2.5s para maior resiliência e velocidade

    try {
      const proxyUrl = proxies[i](url);
      const response = await fetch(proxyUrl, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);

      // Se o destino retornou 404 (Não Encontrado), o ativo de fato não existe no Yahoo Finance.
      // Retorna imediatamente para evitar cascata desnecessária em outros proxies.
      if (response.status === 404) {
        return response;
      }

      if (response.ok) {
        // Valida se o corpo é um JSON legível para evitar aceitar respostas textuais de erro (ex: "Edge: Too Many Requests")
        const text = await response.text();
        try {
          JSON.parse(text); // Tenta fazer o parse do JSON
          // Retorna um novo objeto Response construído a partir do texto JSON validado
          return new Response(text, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } catch (jsonErr) {
          console.warn(`[CORS Proxy] Resposta do proxy ${i} (${proxyUrl}) não é um JSON válido. Ignorando lote...`, jsonErr);
          // Trata como falha de rede/proxy para seguir ao próximo da lista
          continue;
        }
      }
      
      // 429 = rate-limit atingido neste proxy — tenta o próximo sem logar
      if (response.status === 429) continue;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      // Só exibe aviso ao trocar para o último proxy de backup
      if (i === proxies.length - 2) {
        console.warn('[CORS Proxy] Proxies principais indisponíveis, tentando último backup...', err);
      }
    }
  }

  // Tentativa direta como último recurso (falhará por CORS no browser, mas pode funcionar em SSR ou fora de sandbox)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // Reduzido de 5s para 2s
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.status === 404) {
      return response;
    }
    if (response.ok) {
      const text = await response.text();
      try {
        JSON.parse(text);
        return new Response(text, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch (jsonErr) {
        throw new SyntaxError(`Resposta direta não retornou um JSON válido: ${text.slice(0, 80)}`);
      }
    }
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw lastError || err;
  }
}

interface B3TreasuryPrice {
  name: string
  price: number
  maturityDate: string
}

let cachedTreasuryPrices: Record<string, B3TreasuryPrice> | null = null
let lastTreasuryFetchTime = 0

async function fetchB3TreasuryPrices(): Promise<Record<string, B3TreasuryPrice>> {
  const now = Date.now()
  if (cachedTreasuryPrices && (now - lastTreasuryFetchTime < 15 * 60 * 1000)) {
    return cachedTreasuryPrices
  }

  const url = 'https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondsinfo.json'
  try {
    const response = await fetchWithCorsProxy(url)
    if (!response.ok) throw new Error(`Falha ao buscar preços do Tesouro B3: ${response.status}`)
    const data = await safeJson(response)
    const list = data?.response?.TrsrBdTradgList
    if (!Array.isArray(list)) throw new Error('Estrutura de resposta inválida da API do Tesouro B3')

    const prices: Record<string, B3TreasuryPrice> = {}
    for (const item of list) {
      const bd = item.TrsrBd
      if (!bd || !bd.nm) continue
      const name = bd.nm.trim().toUpperCase()
      
      const price = Number(bd.untrRedVal || bd.untrInvstmtVal || 0)
      
      prices[name] = {
        name: bd.nm,
        price,
        maturityDate: bd.mtrtyDt ? bd.mtrtyDt.split('T')[0] : ''
      }
    }

    cachedTreasuryPrices = prices
    lastTreasuryFetchTime = now
    return prices
  } catch (err) {
    console.error('[fetchB3TreasuryPrices] Erro ao carregar preços oficiais do Tesouro Direto B3:', err)
    return cachedTreasuryPrices || {}
  }
}



/**
 * Busca cotações de uma lista de tickers de forma resiliente.
 * Lê o cache do Supabase e, se ausente ou desatualizado (caso forceRefresh seja true),
 * busca em tempo real da API pública e estável do Yahoo Finance B3 com fallback.
 */
export async function getAssetPrices(
  tickers: string[],
  options?: { forceRefresh?: boolean }
): Promise<Record<string, AssetPrice>> {
  if (tickers.length === 0) return {}

  const now = new Date()
  const forceRefresh = options?.forceRefresh ?? false

  // 1. Mapeamento bidirecional de tickers originais para normalizados limpos
  // (ex: VINO11.SA -> VINO11; PETR4F -> PETR4)
  const tickerMap = new Map<string, string>() // original -> limpo
  const cleanTickers: string[] = []

  for (const raw of tickers) {
    const rawUpper = raw.trim().toUpperCase()
    if (!rawUpper) continue

    // Ignorar Caixa/Índices que não devem ser buscados em APIs de mercado
    if (['SALDO_INV', 'CAIXA', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA', 'CDI', 'SELIC', 'IPCA', 'TESOURO', 'DEBENTURE'].includes(rawUpper)) {
      continue
    }

    let clean = rawUpper
    if (clean.endsWith('.SA')) {
      clean = clean.replace('.SA', '')
    }
    if (/^[A-Z]{4}[0-9]{1,2}F$/i.test(clean)) {
      clean = clean.slice(0, -1)
    }

    tickerMap.set(rawUpper, clean)
    if (!cleanTickers.includes(clean)) {
      cleanTickers.push(clean)
    }
  }

  const result: Record<string, AssetPrice> = {}

  // 2. Tentar pegar do cache em memória primeiro (se não estiver forçando)
  const missingInCache: string[] = []
  for (const ticker of cleanTickers) {
    const cached = memoryPriceCache[ticker]
    // Se estiver no cache e atualizado nos últimos 5 minutos, aproveita (se não for forceRefresh)
    if (!forceRefresh && cached && (now.getTime() - new Date(cached.last_updated).getTime() < 5 * 60 * 1000)) {
      result[ticker] = cached
    } else {
      missingInCache.push(ticker)
    }
  }

  if (missingInCache.length > 0) {
    // 3. Buscar do cache persistente no Supabase
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



    // Mapeia o que achou no Supabase e identifica direitos de subscrição
    for (const ticker of missingInCache) {
      const found = supabasePrices.find(p => p.ticker === ticker)
      const isSubscriptionOrRight = isSubscriptionOrRightTicker(ticker)

      const isTreasury = ticker.toUpperCase().includes('TESOURO') ||
                         ticker.toUpperCase().startsWith('LFT') ||
                         ticker.toUpperCase().startsWith('NTN') ||
                         ticker.toUpperCase().startsWith('LTN') ||
                         /^(IPCA|SELIC|PRE)\s+\d{2}$/i.test(ticker)

      // Se achou no cache e NÃO estamos forçando atualização, aproveita
      if (found && !forceRefresh) {
        if (!found.asset_class || !found.sector) {
          const meta = getAssetMetadata(ticker)
          found.asset_class = found.asset_class || meta.asset_class
          found.sector = found.sector || meta.sector
        }
        
        // Calcular dinamicamente o status de cotação com base na data de atualização
        const lastUpdatedDate = found.last_updated ? new Date(found.last_updated) : new Date(0)
        const ageInMs = now.getTime() - lastUpdatedDate.getTime()
        const oneDayInMs = 24 * 60 * 60 * 1000
        found.quotation_status = found.quotation_status || (ageInMs < oneDayInMs ? 'live' : 'stale')

        result[ticker] = found
        memoryPriceCache[ticker] = found
      } else if (isSubscriptionOrRight) {
        // Se for direito de subscrição ou warrant B3 (ex: MXRF12, XPML12), lidamos localmente sem API
        const oldPrice = found || supabasePrices.find(p => p.ticker === ticker)
        const price = oldPrice ? Number(oldPrice.current_price) : 0
        const meta = getAssetMetadata(ticker)
        
        const assetPrice: AssetPrice = {
          ticker,
          current_price: price,
          last_updated: now.toISOString(),
          asset_class: meta.asset_class,
          sector: meta.sector,
          quotation_status: oldPrice ? 'stale' : 'fallback_static',
        }
        result[ticker] = assetPrice
        memoryPriceCache[ticker] = assetPrice
      } else if (isTreasury) {
        // Ativos do Tesouro Direto são tratados estritamente como Renda Fixa no motor e não consultam APIs externas
        const price = (found && Number(found.current_price)) || 0
        const assetPrice: AssetPrice = {
          ticker,
          current_price: price,
          last_updated: now.toISOString(),
          asset_class: 'Renda Fixa',
          sector: 'Títulos Públicos/Privados',
          quotation_status: 'manual',
        }
        result[ticker] = assetPrice
        memoryPriceCache[ticker] = assetPrice
      } else {
        pricesToFetchFromApi.push(ticker)
      }
    }

    // 4. Se houver tickers que precisam de consulta remota (Yahoo Finance)
    if (pricesToFetchFromApi.length > 0) {
      const fetchedPrices: Record<string, number> = {}

      const fetchSingleTicker = async (ticker: string) => {
        try {
          // Cryptos: BTC, ETH, SOL, etc.
          let symbol = ticker
          if (['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'USDT'].includes(ticker)) {
            symbol = `${ticker}-BRL`
          } else {
            const isB3 = /^[A-Z]{4}[0-9]{1,2}$/.test(ticker)
            symbol = isB3 ? `${ticker}.SA` : ticker
          }

          // Usa o endpoint v8/chart que não exige autenticação via crumb/cookie
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`

          let response: Response | null = null
          try {
            response = await fetchWithCorsProxy(url)
          } catch (err) {
            console.warn(`[getAssetPrices] Falha no query1 via chart para ${symbol}.`, err)
          }

          // Se for 404 (Não Encontrado), o ativo não existe no Yahoo Finance.
          // Não adianta tentar o query2 pois os dados são idênticos.
          if (response && response.status === 404) {
            console.warn(`[getAssetPrices] Ticker ${symbol} não encontrado no Yahoo Finance (404).`)
            return
          }

          if (!response || !response.ok) {
            const backupUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
            try {
              response = await fetchWithCorsProxy(backupUrl)
            } catch (err) {
              console.warn(`[getAssetPrices] Falha no query2 via chart para ${symbol}.`, err)
            }
          }

          if (response && response.ok) {
            const data = await safeJson(response)
            const chartMeta = data?.chart?.result?.[0]?.meta
            if (chartMeta && chartMeta.regularMarketPrice !== undefined) {
              fetchedPrices[ticker] = chartMeta.regularMarketPrice
            }
          }
        } catch (tickerErr) {
          console.warn(`[getAssetPrices] Erro ao buscar cotação via chart para ${ticker}:`, tickerErr)
        }
      }

      // Executa a busca concorrentemente com fila controlada (máx 8 workers simultâneos)
      const CONCURRENCY_LIMIT = 8
      const queue = [...pricesToFetchFromApi]
      try {
        const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, queue.length) }, async () => {
          while (queue.length > 0) {
            const ticker = queue.shift()
            if (ticker) await fetchSingleTicker(ticker)
          }
        })
        await Promise.all(workers)
      } catch (apiErr) {
        console.warn('[getAssetPrices] Erro na execução concorrente das cotações via chart:', apiErr)
      }

      // Processa tickers buscados e preenche fallbacks para os que falharam
      const updatesToSave: AssetPrice[] = []

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

        // Salvar todas as cotações que tentamos consultar no banco de dados,
        // incluindo cotações com erro (preço 0 ou static/stale), para persistir no cache
        // e evitar requisições repetidas de rede nas próximas 24 horas.
        updatesToSave.push({
          ticker,
          current_price: price,
          asset_class: meta.asset_class,
          sector: meta.sector,
          last_updated: now.toISOString() as any,
        })
      }

      // Salvar novas cotações de volta no cache do Supabase em background
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
  }


  // 5. Mapear o resultado unificado de volta para as chaves originais que foram pedidas
  const finalResult: Record<string, AssetPrice> = {}
  for (const raw of tickers) {
    const rawUpper = raw.trim().toUpperCase()
    const clean = tickerMap.get(rawUpper)
    if (clean && result[clean]) {
      finalResult[rawUpper] = {
        ...result[clean],
        ticker: rawUpper // mantém o nome original exato solicitado (ex: VINO11.SA) para compatibilidade do chamador
      }
    }
  }

  return finalResult
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

const POPULAR_ASSETS: SearchedAsset[] = [
  // Ações
  { ticker: 'PETR4', name: 'Petrobras PN (Cof. e Dist.)' },
  { ticker: 'PETR3', name: 'Petrobras ON' },
  { ticker: 'VALE3', name: 'Vale S.A. ON' },
  { ticker: 'ITUB4', name: 'Itaú Unibanco PN' },
  { ticker: 'BBDC4', name: 'Bradesco PN' },
  { ticker: 'BBDC3', name: 'Bradesco ON' },
  { ticker: 'BBAS3', name: 'Banco do Brasil ON' },
  { ticker: 'ITSA4', name: 'Itaúsa PN' },
  { ticker: 'WEGE3', name: 'WEG S.A. ON' },
  { ticker: 'MGLU3', name: 'Magazine Luiza ON' },
  { ticker: 'ABEV3', name: 'Ambev ON' },
  { ticker: 'RENT3', name: 'Localiza ON' },
  { ticker: 'LREN3', name: 'Lojas Renner ON' },
  { ticker: 'PRIO3', name: 'PetroRio ON' },
  { ticker: 'EGIE3', name: 'Engie Brasil ON' },
  { ticker: 'ELET3', name: 'Eletrobras ON' },
  { ticker: 'ELET6', name: 'Eletrobras PN' },
  { ticker: 'GGBR4', name: 'Gerdau PN' },
  { ticker: 'SUZB3', name: 'Suzano ON' },
  { ticker: 'HAPV3', name: 'Hapvida ON' },
  { ticker: 'RADL3', name: 'Raia Drogasil ON' },
  { ticker: 'EQTL3', name: 'Equatorial Energia ON' },
  { ticker: 'RDOR3', name: 'Rede D\'Or ON' },
  { ticker: 'ASAI3', name: 'Assaí Sendas ON' },
  { ticker: 'CSAN3', name: 'Cosan ON' },
  { ticker: 'CPLE6', name: 'Copel PNB' },
  { ticker: 'CCRO3', name: 'CCR ON' },
  { ticker: 'TIMS3', name: 'TIM ON' },
  { ticker: 'VIVT3', name: 'Telefônica Brasil ON' },
  { ticker: 'EMBR3', name: 'Embraer ON' },
  { ticker: 'CMIG4', name: 'Cemig PN' },
  { ticker: 'B3SA3', name: 'B3 ON' },
  { ticker: 'USIM5', name: 'Usiminas PNA' },
  { ticker: 'COGN3', name: 'Cogna ON' },
  { ticker: 'YDUQ3', name: 'Yduqs ON' },
  { ticker: 'RAIZ4', name: 'Raízen PN' },
  { ticker: 'CIEL3', name: 'Cielo ON' },
  { ticker: 'GOLL4', name: 'Gol PN' },
  { ticker: 'AZUL4', name: 'Azul PN' },
  { ticker: 'MRVE3', name: 'MRV ON' },
  { ticker: 'CYRE3', name: 'Cyrela ON' },
  { ticker: 'JHSF3', name: 'JHSF ON' },
  { ticker: 'FLRY3', name: 'Fleury ON' },
  { ticker: 'TOTS3', name: 'Totvs ON' },
  { ticker: 'IRBR3', name: 'IRB Brasil ON' },

  // FIIs
  { ticker: 'MXRF11', name: 'Maxi Renda FII' },
  { ticker: 'HGLG11', name: 'CGG Logística FII' },
  { ticker: 'XPML11', name: 'XP Malls FII' },
  { ticker: 'XPLG11', name: 'XP Log FII' },
  { ticker: 'BTLG11', name: 'BTG Pactual Logística FII' },
  { ticker: 'KNIP11', name: 'Kinea Índices de Preços FII' },
  { ticker: 'KNCR11', name: 'Kinea Rendimentos Imobiliários FII' },
  { ticker: 'KNSC11', name: 'Kinea Recebíveis Imobiliários FII' },
  { ticker: 'KNRI11', name: 'Kinea Renda Imobiliária FII' },
  { ticker: 'HGBS11', name: 'Hedge Shopping Centers FII' },
  { ticker: 'HGRU11', name: 'Hedge Recebíveis Imobiliários FII' },
  { ticker: 'VISC11', name: 'Vinci Shopping Centers FII' },
  { ticker: 'MALL11', name: 'Malls Brasil Plural FII' },
  { ticker: 'TRXF11', name: 'TRX Real Estate FII' },
  { ticker: 'HCTR11', name: 'Hectare CE FII' },
  { ticker: 'DEVA11', name: 'Devant Recebíveis Imobiliários FII' },
  { ticker: 'IRDM11', name: 'Iridium Recebíveis Imobiliários FII' },
  { ticker: 'CPTS11', name: 'Capitânia Securities II FII' },
  { ticker: 'RECT11', name: 'Real Estate FII' },
  { ticker: 'VINO11', name: 'Vinci Offices FII' },
  { ticker: 'BRCR11', name: 'BTG Pactual Corporate Office Fund FII' },
  { ticker: 'ALZR11', name: 'Alianza Trust Estilo FII' },
  { ticker: 'BCFF11', name: 'BTG Pactual Fundo de Fundos FII' },
  { ticker: 'TGAR11', name: 'TG Ativa Real Estate FII' },
  { ticker: 'VGIP11', name: 'Valora IP FII' },
  { ticker: 'URPR11', name: 'Urca Prime Renda FII' },
  { ticker: 'RECR11', name: 'REC Recebíveis Imobiliários FII' },
  { ticker: 'VSLH11', name: 'Versalhes Recebíveis Imobiliários FII' },
  { ticker: 'HREC11', name: 'Hedge Recebíveis FII' },
  { ticker: 'GALG11', name: 'Guardian Logística FII' },
  { ticker: 'CACR11', name: 'Cartesia Recebíveis FII' },

  // ETFs e Internacionais / Crypto
  { ticker: 'BOVA11', name: 'iShares Ibovespa ETF' },
  { ticker: 'IVVB11', name: 'iShares S&P 500 ETF' },
  { ticker: 'SMAL11', name: 'iShares Small Cap ETF' },
  { ticker: 'HASH11', name: 'Hashdex Nasdaq Crypto Index ETF' },
  { ticker: 'QBTC11', name: 'QR Bitcoin ETF' },
  { ticker: 'QETH11', name: 'QR Ether ETF' },
  { ticker: 'GOLD11', name: 'Trend Ouro ETF' },
  { ticker: 'XINA11', name: 'Trend China ETF' },
  { ticker: 'AAPL', name: 'Apple Inc. (NASDAQ)' },
  { ticker: 'MSFT', name: 'Microsoft Corporation (NASDAQ)' },
  { ticker: 'GOOGL', name: 'Alphabet Inc. (NASDAQ)' },
  { ticker: 'AMZN', name: 'Amazon.com Inc. (NASDAQ)' },
  { ticker: 'TSLA', name: 'Tesla Inc. (NASDAQ)' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation (NASDAQ)' },
  { ticker: 'BTC', name: 'Bitcoin (Criptomoeda)' },
  { ticker: 'ETH', name: 'Ethereum (Criptomoeda)' },
  { ticker: 'USDT', name: 'Tether Dollar Stablecoin' },
]

/**
 * Pesquisa ativos B3 / Internacionais em tempo real com busca local ultra-rápida
 * e fallback/enriquecimento assíncrono via Yahoo Finance.
 */
export async function searchB3Assets(query: string): Promise<SearchedAsset[]> {
  const q = query.trim().toUpperCase()
  if (q.length < 2) return []

  // 1. Filtrar ativos populares locais instantaneamente
  const localMatches = POPULAR_ASSETS.filter(
    (asset) => asset.ticker.startsWith(q) || asset.name.toUpperCase().includes(q)
  )

  let remoteMatches: SearchedAsset[] = []
  try {
    // Definimos um timeout curto (800ms) para que a rede nunca trave a digitação do usuário
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 800)

    const targetUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`
    // Tenta fetch com múltiplos proxies de backup em cascata
    const response = await fetchWithCorsProxy(targetUrl, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await safeJson(response)
      if (data && data.quotes) {
        remoteMatches = data.quotes
          .filter((item: any) => {
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
    console.debug('[searchB3Assets] Falha ou timeout na busca remota, usando locais:', err)
  }

  // 2. Mesclar resultados sem duplicar tickers, priorizando os locais
  const seenTickers = new Set<string>()
  const merged: SearchedAsset[] = []

  for (const asset of localMatches) {
    seenTickers.add(asset.ticker)
    merged.push(asset)
  }

  for (const asset of remoteMatches) {
    if (!seenTickers.has(asset.ticker)) {
      seenTickers.add(asset.ticker)
      merged.push(asset)
    }
  }

  // 3. Fallback adicional do FALLBACK_PRICES se a busca remota falhar e não houver localMatches
  if (merged.length === 0) {
    const fallbackMatches = Object.keys(FALLBACK_PRICES)
      .filter((t) => t.startsWith(q))
      .map((t) => ({ ticker: t, name: `${t} Asset` }))

    for (const asset of fallbackMatches) {
      if (!seenTickers.has(asset.ticker)) {
        seenTickers.add(asset.ticker)
        merged.push(asset)
      }
    }
  }

  return merged.slice(0, 10)
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
    let t = normTicker
    if (/^[A-Z]{4}[0-9]{1,2}F$/i.test(t)) {
      t = t.slice(0, -1)
    }
    const isB3 = /^[A-Z]{4}[0-9]{1,2}$/.test(t)
    const symbol = isB3 ? `${t}.SA` : t

    let response: Response | null = null
    try {
      response = await fetchWithCorsProxy(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`)
    } catch (err) {
      console.warn('[getAssetRichData] Falha no host principal query1. Tentando query2...', err)
    }

    if (!response || !response.ok) {
      response = await fetchWithCorsProxy(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`)
    }
    
    if (response.ok) {
      const data = await safeJson(response)
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
  let t = ticker.trim().toUpperCase()
  if (t.endsWith('.SA')) {
    t = t.replace('.SA', '')
  }
  if (/^[A-Z]{4}[0-9]{1,2}F$/i.test(t)) {
    t = t.slice(0, -1)
  }
  return /^[A-Z]{4}[0-9]{1,2}$/.test(t)
}

/**
 * Detecta se um ticker é um direito de subscrição ou outro ativo B3 não padrão
 * que o Yahoo Finance não oferece suporte para cotações.
 */
export function isSubscriptionOrRightTicker(ticker: string): boolean {
  let t = ticker.trim().toUpperCase()
  if (t.endsWith('.SA')) {
    t = t.replace('.SA', '')
  }
  if (/^[A-Z]{4}[0-9]{1,2}F$/i.test(t)) {
    t = t.slice(0, -1)
  }
  
  if (/^[A-Z]{4}[0-9]{1,2}$/.test(t)) {
    const match = t.match(/[0-9]+$/)
    if (match) {
      const num = parseInt(match[0], 10)
      // Digitos normais: 3, 4, 5, 6, 7, 8 (Ações), 11 (FIIs, ETFs, Units)
      // Também suporta alguns BDRs comuns terminando em 34, 35, 39 ou renda fixa
      const standardDigits = [3, 4, 5, 6, 7, 8, 11, 32, 33, 34, 35, 36, 39]
      return !standardDigits.includes(num)
    }
  }
  return false
}

/** Limpa completamente o cache em memória das cotações */
export function clearPriceCache(): void {
  for (const key in memoryPriceCache) {
    delete memoryPriceCache[key]
  }
}

/** Atualiza forçadamente uma lista de tickers bypassando o cache persistente */
export async function forceRefreshPrices(tickers: string[]): Promise<Record<string, AssetPrice>> {
  clearPriceCache()
  return getAssetPrices(tickers, { forceRefresh: true })
}

/**
 * Detecta dinamicamente a moeda de cotação padrão de um ativo a partir de seu ticker.
 */
export function detectDefaultCurrency(ticker: string): 'BRL' | 'USD' {
  const t = ticker.trim().toUpperCase()
  if (['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'USDT'].includes(t)) {
    return 'BRL'
  }
  if (isB3TickerPattern(t)) {
    return 'BRL'
  }
  if (['CDI', 'SELIC', 'IPCA', 'TESOURO', 'LCI', 'LCA', 'CDB', 'DEBENTURE', 'CAIXA', 'SALDO_INV', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'].some(rf => t.includes(rf))) {
    return 'BRL'
  }
  // Ativos cotados no mercado americano (geralmente 3 ou 4 letras puras, ex: AAPL, VOO)
  const isUsStock = /^[A-Z]{3,4}$/.test(t)
  if (isUsStock) {
    return 'USD'
  }
  return 'BRL'
}

