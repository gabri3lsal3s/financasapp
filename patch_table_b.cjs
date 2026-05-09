const fs = require('fs');
const path = 'src/pages/admin/ConsultingReports.tsx';
let content = fs.readFileSync(path, 'utf8');

const insertion = `
                          </Card>

                          {/* Tabela B - Setores (Desktop) */}
                          <Card className="hidden md:block p-0 overflow-hidden bg-primary border-primary shadow-none mt-6">
                             <div className="bg-tertiary p-4 border-b border-primary">
                                <h4 className="text-xs font-semibold text-secondary uppercase tracking-widest">Desempenho por Grupo/Setor (Tabela B)</h4>
                             </div>
                             <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                   <thead>
                                      <tr className="text-[10px] text-secondary uppercase font-semibold border-b border-primary bg-secondary">
                                         <th className="p-4">Grupo / Estratégia</th>
                                         <th className="p-4 text-center">Rent. Mês (%)</th>
                                         <th className="p-4 text-center">Rent. Ano (YTD)</th>
                                         <th className="p-4 text-center">Rent. Total (%)</th>
                                         <th className="p-4 text-center text-income">Yield Mês (%)</th>
                                         <th className="p-4 text-center text-primary">Yield Total (%)</th>
                                      </tr>
                                   </thead>
                                   <tbody className="divide-y divide-[var(--color-border)]">
                                      {sortedTableBData.map((row, idx) => (
                                         <tr key={idx} className="hover:bg-tertiary transition-colors group">
                                            <td className="p-4">
                                               <span className="text-sm font-bold text-primary/70">{row.label}</span>
                                            </td>
                                            <td className="p-4 text-center font-black">
                                               <span className={parseFloat(row.rentMês) >= 0 ? 'text-income' : 'text-danger'}>
                                                  {row.rentMês !== '-' ? (parseFloat(row.rentMês) >= 0 ? '+' + row.rentMês + '%' : row.rentMês + '%') : '-'}
                                               </span>
                                            </td>
                                            <td className="p-4 text-center font-black">
                                               <span className={parseFloat(row.rentYtd) >= 0 ? 'text-income' : 'text-danger'}>
                                                  {row.rentYtd !== '-' ? (parseFloat(row.rentYtd) >= 0 ? '+' + row.rentYtd + '%' : row.rentYtd + '%') : '-'}
                                               </span>
                                            </td>
                                            <td className="p-4 text-center font-black">
                                               <span className={parseFloat(row.rentTotal) >= 0 ? 'text-income' : 'text-danger'}>
                                                  {row.rentTotal !== '-' ? (parseFloat(row.rentTotal) >= 0 ? '+' + row.rentTotal + '%' : row.rentTotal + '%') : '-'}
                                               </span>
                                            </td>
                                            <td className="p-4 text-center text-income text-xs font-black">
                                               {row.yield !== '-' ? row.yield + '%' : '-'}
                                            </td>
                                            <td className="p-4 text-center text-primary text-xs font-black">
                                               {row.yieldCurrent !== '-' ? row.yieldCurrent + '%' : '-'}
                                            </td>
                                         </tr>
                                      ))}
                                   </tbody>
                                </table>
                             </div>
                          </Card>
`;

// Try to find a very unique place
const marker = 'sortedTableAData.map((row, idx) => (';
const index = content.lastIndexOf(marker); // Get the second one (mobile)
if (index !== -1) {
    const startOfDiv = content.lastIndexOf('<div className="md:hidden space-y-4">', index);
    if (startOfDiv !== -1) {
        content = content.slice(0, startOfDiv) + insertion + '\n' + content.slice(startOfDiv);
        fs.writeFileSync(path, content);
        console.log('Successfully patched!');
    } else {
        console.log('Could not find start of div');
    }
} else {
    console.log('Could not find marker');
}
