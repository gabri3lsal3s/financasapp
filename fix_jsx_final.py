import os

filepath = 'src/pages/admin/ConsultingReports.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the start of the mess
mess_start = content.find('{/* 4. FEE FOOTER */}')
# Find the end of the mess
# We know it ends before MonthPickerModal
mess_end = content.find('<MonthPickerModal')

if mess_start != -1 and mess_end != -1:
    # Reconstruct the entire footer correctly
    new_footer = """{/* 4. FEE FOOTER */}
                                  <div className="mt-24">
                                      <h3 className="font-black uppercase mb-6 text-[18px] border-b-[3px] pb-2" style={{ borderColor: "#000", color: "#000" }}>{(comparisonData ? (planning.length > 0 ? 6 : 5) : (planning.length > 0 ? 5 : 4))}. TAXA DE GESTÃO (FEE-BASED)</h3>
                                      <div className="flex justify-between items-end">
                                         <div>
                                            <p className="text-4xl font-black mt-4 tracking-tighter" style={{color: '#000'}}>{formatCurrency(activeReportData.total_balance * (parseFloat(feeRate.replace(',','.')) / 100))}</p>
                                            <p style={{fontSize: '11px', color: '#888', fontWeight: 'bold', marginTop: '4px'}}>Calculado sobre o Patrimônio Total Consolidado Gerido: {feeRate}%</p>
                                         </div>
                                         <div className="text-right" style={{fontSize: '10px', textTransform: 'uppercase', fontWeight: '900', color: '#bbb', letterSpacing: '0.2em'}}>
                                            <p></p>
                                         </div>
                                      </div>
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                ) : (
                   <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-20 bg-secondary/5 rounded-[3rem] border-2 border-dashed border-white/5 animate-pulse">
                      <div className="p-8 bg-primary/5 rounded-full mb-8 shadow-inner">
                         <Calculator size={50} className="text-primary opacity-30" />
                      </div>
                      <h3 className="text-2xl font-black text-primary mb-3">Painel de Emissão Técnica</h3>
                      <p className="text-secondary max-w-sm font-black opacity-60">Selecione um fechamento arquivado ou a posição "Live" para editar os parâmetros e exportar o relatório minimalista.</p>
                   </div>
                )}
             </div>
          </div>
       </div>


       """
    content = content[:mess_start] + new_footer + content[mess_end:]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed JSX manually via python script")
else:
    print("Failed to find boundaries")
