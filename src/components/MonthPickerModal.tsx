import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from './Modal';

interface MonthPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string; // YYYY-MM
  onChange: (value: string) => void;
  title?: string;
  showLiveOption?: boolean;
}

export default function MonthPickerModal({ isOpen, onClose, value, onChange, title = "Selecionar Mês", showLiveOption = false }: MonthPickerModalProps) {
  const [year, month] = value ? value.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  const [viewYear, setViewYear] = useState(year);

  const months = [
    { name: 'Jan', value: 1 }, { name: 'Fev', value: 2 }, { name: 'Mar', value: 3 },
    { name: 'Abr', value: 4 }, { name: 'Mai', value: 5 }, { name: 'Jun', value: 6 },
    { name: 'Jul', value: 7 }, { name: 'Ago', value: 8 }, { name: 'Set', value: 9 },
    { name: 'Out', value: 10 }, { name: 'Nov', value: 11 }, { name: 'Dez', value: 12 }
  ];

  const handleSelect = (m: number) => {
    const formattedMonth = String(m).padStart(2, '0');
    onChange(`${viewYear}-${formattedMonth}`);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6">
        {/* Year Selector */}
        <div className="flex items-center justify-between bg-secondary/5 p-2 rounded-xl border border-white/5">
          <button 
            onClick={() => setViewYear(viewYear - 1)}
            className="p-2 hover:bg-white/5 rounded-lg text-secondary transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-xl font-black text-primary tracking-tighter">{viewYear}</span>
          <button 
            onClick={() => setViewYear(viewYear + 1)}
            className="p-2 hover:bg-white/5 rounded-lg text-secondary transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Month Grid */}
        <div className="grid grid-cols-3 gap-3">
          {months.map((m) => {
            const isSelected = year === viewYear && month === m.value;
            return (
              <button
                key={m.value}
                onClick={() => handleSelect(m.value)}
                className={`
                  py-4 rounded-2xl border transition-all font-bold text-sm
                  ${isSelected 
                    ? 'bg-primary/10 border-primary-500/30 text-primary shadow-lg shadow-primary/10 scale-[1.02]' 
                    : 'bg-secondary/5 border-white/5 text-secondary hover:border-primary/30 hover:text-primary'
                  }
                `}
              >
                {m.name}
              </button>
            );
          })}
        </div>

        <div className="pt-2 flex flex-col items-center gap-3">
            {showLiveOption && (
                <button 
                    onClick={() => { onChange('live'); onClose(); }}
                    className="w-full py-3 rounded-2xl border border-primary/30 bg-primary/5 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary/10 transition-all"
                >
                    Copiar para Posição Atual (Live)
                </button>
            )}
            <button 
                onClick={onClose}
                className="text-xs text-secondary opacity-50 hover:opacity-100 transition-opacity"
            >
                Cancelar
            </button>
        </div>
      </div>
    </Modal>
  );
}
