import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  CartesianGrid
} from 'recharts';

interface ChartItem {
  name: string;
  value: number;
  active?: boolean;
}

interface InteractiveAIChartProps {
  chartData?: ChartItem[];
  expenses?: any[];
  onBarClick?: (item: ChartItem) => void;
}

export const InteractiveAIChart: React.FC<InteractiveAIChartProps> = ({
  chartData = [],
  onBarClick
}) => {
  if (!chartData || chartData.length === 0) return null;

  // Auto-detect single correct chart type based on content of chartData
  const isCategory = chartData.some(d => 
    ['Lazer', 'Transporte', 'Assinaturas', 'Supermercado', 'Carro', 'Capex', 'Compras', 'Outros'].includes(d.name) ||
    (!['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM', 'HOJE', 'LIMITE', 'META', 'CONSUMO'].includes(d.name.toUpperCase()))
  );

  const isLimitComparison = chartData.some(d => 
    ['LIMITE', 'META', 'ORÇAMENTO', 'ORCAMENTO'].includes(d.name.toUpperCase())
  );

  const chartType: 'bar' | 'donut' | 'comparison' = isCategory ? 'donut' : isLimitComparison ? 'comparison' : 'bar';

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Custom polished Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 p-2.5 rounded-xl shadow-lg text-[10px] font-semibold text-slate-800 space-y-1">
          <p className="font-extrabold uppercase text-slate-400 font-mono tracking-wider">{label}</p>
          {payload.map((item: any, i: number) => (
            <p key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
              <span className="text-slate-500">{item.name}:</span>
              <span className="font-bold text-slate-900">
                R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/60 space-y-3.5">
      {/* Dynamic Title based on Auto-Detected Type */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
          {chartType === 'donut' && 'Distribuição por Categoria'}
          {chartType === 'bar' && 'Evolução dos Gastos'}
          {chartType === 'comparison' && 'Acompanhamento de Metas'}
        </span>
        <span className="text-[8px] font-bold font-mono text-blue-500 uppercase bg-blue-50/80 px-2 py-0.5 rounded-md">
          IA Analítico
        </span>
      </div>

      {/* Main Container */}
      <div className="h-36 w-full flex items-center justify-center">
        {chartType === 'bar' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
              <XAxis 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: '800', fontFamily: 'monospace' }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: '800', fontFamily: 'monospace' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }} />
              <Bar 
                dataKey="value" 
                name="Gasto"
                radius={[5, 5, 0, 0]}
                onClick={(data) => onBarClick && onBarClick(data)}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.active ? '#2563eb' : '#cbd5e1'} 
                    className="cursor-pointer hover:opacity-85 transition-opacity"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {chartType === 'donut' && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}

        {chartType === 'comparison' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 15, right: 30, left: -15, bottom: 5 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" strokeOpacity={0.6} />
              <XAxis 
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: '800', fontFamily: 'monospace' }}
              />
              <YAxis 
                type="category"
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 9, fontWeight: '800' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]} barSize={16}>
                {chartData.map((entry, index) => {
                  const isLimite = entry.name.toUpperCase() === 'LIMITE';
                  let fillColor = '#94a3b8'; // default grey for limit
                  if (!isLimite) {
                    // It's the "HOJE" or consumption bar. Let's check if it's over the limit
                    const limitEntry = chartData.find(d => d.name.toUpperCase() === 'LIMITE');
                    const limitVal = limitEntry ? limitEntry.value : Infinity;
                    fillColor = entry.value > limitVal ? '#ef4444' : '#10b981'; // red if over, green if ok
                  }
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={fillColor} 
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Polish Legend details below the chart */}
      {chartType === 'donut' && (
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-2 border-t border-slate-200/40">
          {chartData.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span>{entry.name}:</span>
              <span className="text-slate-800 font-mono">R$ {entry.value.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {chartType === 'bar' && (
        <div className="text-[9px] font-bold text-slate-400 text-center select-none pt-1">
          Gráfico diário de evolução. O dia em <span className="text-blue-600">azul</span> indica o pico de despesa.
        </div>
      )}

      {chartType === 'comparison' && (
        <div className="text-[9px] font-bold text-slate-400 text-center select-none pt-1">
          Barra em <span className="text-emerald-500">verde</span> indica que os gastos estão dentro do limite diário sugerido.
        </div>
      )}
    </div>
  );
};
