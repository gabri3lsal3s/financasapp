import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area
} from 'recharts';
import { formatCurrency } from '@/utils/format';

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

const BW_PALETTE = ['#000000', '#2a2a2a', '#444444', '#666666', '#888888', '#aaaaaa', '#bbbbbb', '#cccccc'];
const RADIAN = Math.PI / 180;
const SECTION_SPACING = 20; 

export default function ReportCharts({ assets, macroSectors, sectors, historyReports, totalBalance, compositionDescription }: Props) {

  const macroComposition = useMemo(() => {
    return macroSectors.map((m) => {
      const macroSectorIds = sectors.filter(s => s.macro_sector_id === m.id).map(s => s.id);
      const current = assets.filter(a => macroSectorIds.includes(a.sector_id || '')).reduce((s, a) => s + a.current_balance, 0);
      const currentPct = totalBalance > 0 ? (current / totalBalance) * 100 : 0;
      return {
        name: m.name.length > 15 ? m.name.slice(0, 13) + '…' : m.name,
        'Atual (%)': parseFloat(currentPct.toFixed(2)),
        'Alvo (%)': parseFloat((m.target_percentage * 100).toFixed(2)),
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
      .map(([name, value]) => ({ name, value, pct: totalBalance > 0 ? (value / totalBalance * 100).toFixed(1) : '0' }))
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
      .map(([name, value]) => ({ name, value, pct: totalBalance > 0 ? (value / totalBalance * 100).toFixed(1) : '0' }))
      .sort((a, b) => b.value - a.value);
  }, [assets, macroSectors, sectors, totalBalance]);

  const evolutionData = useMemo(() => {
    const sorted = [...historyReports].sort((a, b) => a.month.localeCompare(b.month));
    return sorted.slice(-12).map(r => ({
      month: r.month.slice(0, 7).split('-').reverse().join('/'),
      'Patrimônio': r.total_balance,
    }));
  }, [historyReports]);

  const renderLabel = ({ cx, cy, midAngle, outerRadius, pct }: any) => {
    if (parseFloat(pct) < 4) return null;
    const radius = outerRadius + 8;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#111" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: 7, fontWeight: '900' }}>
        {pct}%
      </text>
    );
  };

  const TITLE_STYLE: React.CSSProperties = { 
    fontSize: 10, 
    fontWeight: '900', 
    color: '#000', 
    textTransform: 'uppercase', 
    letterSpacing: '0.1em', 
    marginBottom: 12,
    borderBottom: '1px solid #000',
    paddingBottom: '4px',
    display: 'block'
  };

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* Chart 1: Composição Atual vs Alvo */}
      {macroComposition.length > 0 && (
        <div style={{ marginBottom: SECTION_SPACING }}>
          <p style={TITLE_STYLE}>COMPOSIÇÃO ATUAL VS. ALVO (%)</p>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={macroComposition} barCategoryGap="30%" margin={{ top: 10, bottom: 40, left: 0, right: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis 
                   dataKey="name" 
                   tick={{ fontSize: 7, fill: '#333', fontWeight: 'bold' }} 
                   axisLine={false} 
                   tickLine={false}
                   interval={0}
                   angle={-35}
                   textAnchor="end"
                   height={50}
                />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 7, fill: '#888' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} contentStyle={{ fontSize: 9, borderRadius: 4 }} />
                <Bar dataKey="Atual (%)" fill="#000" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Alvo (%)" fill="#bbb" radius={[2, 2, 0, 0]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 8, paddingTop: 10 }} verticalAlign="bottom" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {compositionDescription && (
            <div style={{ marginTop: -20, overflow: 'hidden', wordWrap: 'break-word' }}>
              <p style={{ fontSize: '10px', color: '#111', lineHeight: '1.5', textAlign: 'justify' }}>{compositionDescription}</p>
            </div>
          )}
        </div>
      )}

      {/* Charts 2 & 3: Donuts side by side */}
      {(macroDist.length > 0 || sectorDist.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, marginBottom: SECTION_SPACING }}>
          {macroDist.length > 0 && (
            <div>
              <p style={TITLE_STYLE}>DISTRIBUIÇÃO POR CLASSE</p>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, bottom: 20, left: 10, right: 10 }}>
                    <Pie 
                       data={macroDist} 
                       cx="50%" 
                       cy="45%" 
                       innerRadius={30} 
                       outerRadius={50} 
                       dataKey="value" 
                       labelLine={false} 
                       label={renderLabel}
                       minAngle={15}
                    >
                      {macroDist.map((_, i) => <Cell key={i} fill={BW_PALETTE[i % BW_PALETTE.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 8 }} />
                    <Legend iconSize={7} wrapperStyle={{ fontSize: 7, paddingTop: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {sectorDist.length > 0 && (
            <div>
              <p style={TITLE_STYLE}>DISTRIBUIÇÃO POR SETOR</p>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, bottom: 20, left: 10, right: 10 }}>
                    <Pie 
                       data={sectorDist} 
                       cx="50%" 
                       cy="45%" 
                       innerRadius={30} 
                       outerRadius={50} 
                       dataKey="value" 
                       labelLine={false} 
                       label={renderLabel}
                       minAngle={15}
                    >
                      {sectorDist.map((_, i) => <Cell key={i} fill={BW_PALETTE[i % BW_PALETTE.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 8 }} />
                    <Legend iconSize={7} wrapperStyle={{ fontSize: 7, paddingTop: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart 4: Evolução Patrimonial */}
      {evolutionData.length > 1 && (
        <div style={{ marginBottom: SECTION_SPACING }}>
          <p style={TITLE_STYLE}>EVOLUÇÃO PATRIMONIAL</p>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolutionData} margin={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="bwGradRpt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 7, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 7, fill: '#888' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 8, borderRadius: 4 }} />
                <Area type="monotone" dataKey="Patrimônio" stroke="#000" strokeWidth={1.5} fill="url(#bwGradRpt)" dot={{ fill: '#000', r: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Chart 5: Concentração por Setor (horizontal bars) */}
      {sectorDist.length > 1 && (
        <div>
          <p style={TITLE_STYLE}>CONCENTRAÇÃO POR SETOR</p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorDist.slice(0, 6)} layout="vertical" barCategoryGap="20%" margin={{ top: 10, bottom: 10, left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                <XAxis type="number" tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 7, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={85} tick={{ fontSize: 7, fill: '#555', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 8 }} />
                <Bar dataKey="value" fill="#333" radius={[0, 2, 2, 0]}>
                  {sectorDist.slice(0, 6).map((_, i) => <Cell key={i} fill={BW_PALETTE[Math.min(i, BW_PALETTE.length - 1)]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
