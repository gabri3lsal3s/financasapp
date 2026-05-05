import os

filepath = 'src/pages/admin/ConsultingReports.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken JSX structure in the Fee section
# I will rewrite the entire section from 4. FEE FOOTER to the end of the if block

old_section_start = """                                  {/* 4. FEE FOOTER */}"""
# We need to find where the if block ends
# It ends with ) : (

import re
pattern = re.compile(r'{/\* 4\. FEE FOOTER \*/}.*?\)\s+:\s+\(', re.DOTALL)
match = pattern.search(content)

if match:
    new_section = """{/* 4. FEE FOOTER */}
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
                ) : ("""
    content = content[:match.start()] + new_section + content[match.end():]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed JSX structure")
else:
    print("Could not find the Fee Footer section with the expected boundaries")
