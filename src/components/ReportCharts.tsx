import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area
} from 'recharts';
import {
  formatCurrency,
  formatPercentBR,
  formatAxisCurrencyThousands,
  roundToDecimals,
} from '@/utils/format';
import { useTheme } from '@/hooks/useTheme';
import type { PieLabelProps } from '@/types/recharts';
import { chartAnimProps } from '@/types/recharts';

interface Asset {
  asset_name: string;
  category: string;
  current_balance: number;
  sector_id?: string;
  target_percentage?: number;
}
interface MacroSector { id: string; name: string; target_percentage: number; }
interface Sector { id: string; macro_sector_id: string | null; macro_category: string; sector_name: string; target_percentage: number; }
interface HistoryReport { id: string; month: string; total_balance: number; }

interface Props {
  assets: Asset[];
  macroSectors: MacroSector[];
  sectors: Sector[];
  historyReports: HistoryReport[];
  totalBalance: number;
  compositionDescription?: string;
}

const RADIAN = Math.PI / 180;

export default function ReportCharts({ assets, macroSectors, sectors, historyReports, totalBalance, compositionDescription }: Props) {
  const { colorPalette } = useTheme();

  const chartPalette = useMemo(() => {
    if (colorPalette === 'monochrome') {
      return Array.from({ length: 6 }, (_, i) => `var(--chart-mono-${i})`)
    }
    return [
      'var(--color-primary)',
      ...Array.from({ length: 6 }, (_, i) => `var(--chart-glass-${i})`),
    ]
  }, [colorPalette]);

  const macroComposition = useMemo(() => {
    return macroSectors.map((m) => {
      const macroSectorIds = sectors.filter(s => s.macro_sector_id === m.id).map(s => s.id);
      const current = assets.filter(a => macroSectorIds.includes(a.sector_id || '')).reduce((s, a) => s + a.current_balance, 0);
      const currentPct = totalBalance > 0 ? (current / totalBalance) * 100 : 0;
      return {
        name: m.name.length > 15 ? m.name.slice(0, 13) + '…' : m.name,
        'Atual (%)': roundToDecimals(currentPct, 2),
        'Alvo (%)': roundToDecimals(m.target_percentage * 100, 2),
      };
    });
  }, [assets, macroSectors, sectors, totalBalance]);

  const sectorDist = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach(a => {
      const sec = sectors.find(s => s.id === a.sector_id);
      const label = sec ? sec.sector_name : 'Outros';
      map[label] = (map[label] || 0) + a.current_balance;
    });
    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        pct: totalBalance > 0 ? roundToDecimals((value / totalBalance) * 100, 1) : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [assets, sectors, totalBalance]);

  const macroDist = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach(a => {
      const sec = sectors.find(s => s.id === a.sector_id);
      const mac = macroSectors.find(m => m.id === sec?.macro_sector_id);
      const label = mac ? mac.name : (sec?.macro_category || a.category || 'Outros');
      map[label] = (map[label] || 0) + a.current_balance;
    });
    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        pct: totalBalance > 0 ? roundToDecimals((value / totalBalance) * 100, 1) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [assets, macroSectors, sectors, totalBalance]);

  const evolutionData = useMemo(() => {
    const sorted = [...historyReports].sort((a, b) => a.month.localeCompare(b.month));
    return sorted.slice(-12).map(r => ({
      month: r.month.slice(0, 7).split('-').reverse().join('/'),
      'Patrimônio': r.total_balance,
    }));
  }, [historyReports]);

  const animProps = useMemo(() => chartAnimProps(), []);

  // Renderizador de percentual nas fatias (adaptável para contraste de temas)
  const renderLabel = ({ cx, cy, midAngle, outerRadius, pct }: PieLabelProps) => {
    if (parseFloat(String(pct)) < 4) return null;
    const radius = outerRadius + 8;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text 
        x={x} 
        y={y} 
        fill="var(--color-text-secondary)" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central" 
        style={{ fontSize: 9, fontWeight: '700', fontFamily: 'inherit' }}
      >
        {formatPercentBR(Number(pct), 1)}
      </text>
    );
  };



  return (
    <div className="space-y-6 font-sans">
      {/* Chart 1: Composição Atual vs Alvo */}
      {macroComposition.length > 0 && (
        <div className="w-full mb-6">
          <p className="text-[11px] font-extrabold text-primary uppercase tracking-wider mb-4 border-b border-primary pb-1.5 block">COMPOSIÇÃO ATUAL VS. ALVO (%)</p>
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={macroComposition} barCategoryGap="25%" margin={{ top: 10, bottom: 20, left: -25, right: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                   dataKey="name" 
                   tick={{ fontSize: 9, fontWeight: 'bold' }} 
                   axisLine={false} 
                   tickLine={false}
                   interval={0}
                   angle={-25}
                   textAnchor="end"
                   height={45}
                />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatPercentBR(Number(v), 2)} />
                <Bar dataKey="Atual (%)" fill="var(--color-primary)" radius={[4, 4, 0, 0]} {...animProps} />
                <Bar dataKey="Alvo (%)" fill="var(--color-disabled)" radius={[4, 4, 0, 0]} {...animProps} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 9, paddingTop: 10 }} verticalAlign="bottom" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {compositionDescription && (
            <div className="mt-4 px-1">
              <p className="text-xs text-secondary leading-relaxed text-justify">{compositionDescription}</p>
            </div>
          )}
        </div>
      )}

      {/* Charts 2 & 3: Donuts side by side */}
      {(macroDist.length > 0 || sectorDist.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-6">
          {macroDist.length > 0 && (
            <div className="w-full">
              <p className="text-[11px] font-extrabold text-primary uppercase tracking-wider mb-4 border-b border-primary pb-1.5 block">DISTRIBUIÇÃO POR CLASSE</p>
              <div className="h-56 sm:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart margin={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Pie 
                       data={macroDist} 
                       cx="50%" 
                       cy="45%" 
                       innerRadius={45} 
                       outerRadius={65} 
                       dataKey="value" 
                       labelLine={false} 
                       label={renderLabel}
                       minAngle={15}
                       paddingAngle={2}
                       {...animProps}
                    >
                      {macroDist.map((_, i) => <Cell key={i} fill={chartPalette[i % chartPalette.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 9, paddingTop: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {sectorDist.length > 0 && (
            <div className="w-full">
              <p className="text-[11px] font-extrabold text-primary uppercase tracking-wider mb-4 border-b border-primary pb-1.5 block">DISTRIBUIÇÃO POR SETOR</p>
              <div className="h-56 sm:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart margin={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Pie 
                       data={sectorDist} 
                       cx="50%" 
                       cy="45%" 
                       innerRadius={45} 
                       outerRadius={65} 
                       dataKey="value" 
                       labelLine={false} 
                       label={renderLabel}
                       minAngle={15}
                       paddingAngle={2}
                       {...animProps}
                    >
                      {sectorDist.map((_, i) => <Cell key={i} fill={chartPalette[i % chartPalette.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 9, paddingTop: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart 4: Evolução Patrimonial */}
      {evolutionData.length > 1 && (
        <div className="w-full mb-6">
          <p className="text-[11px] font-extrabold text-primary uppercase tracking-wider mb-4 border-b border-primary pb-1.5 block">EVOLUÇÃO PATRIMONIAL</p>
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={evolutionData} margin={{ top: 10, bottom: 10, left: -10, right: 10 }}>
                <defs>
                  <linearGradient id="chartEvolutionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatAxisCurrencyThousands(Number(v))} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area type="monotone" dataKey="Patrimônio" stroke="var(--color-primary)" strokeWidth={2} fill="url(#chartEvolutionGrad)" dot={{ fill: 'var(--color-primary)', r: 3 }} {...animProps} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Chart 5: Concentração por Setor (horizontal bars) */}
      {sectorDist.length > 1 && (
        <div className="w-full">
          <p className="text-[11px] font-extrabold text-primary uppercase tracking-wider mb-4 border-b border-primary pb-1.5 block">CONCENTRAÇÃO POR SETOR</p>
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={sectorDist.slice(0, 6)} layout="vertical" barCategoryGap="20%" margin={{ top: 10, bottom: 10, left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => formatAxisCurrencyThousands(Number(v), { spaced: true })} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 9, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} {...animProps}>
                  {sectorDist.slice(0, 6).map((_, i) => <Cell key={i} fill={chartPalette[i % chartPalette.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
