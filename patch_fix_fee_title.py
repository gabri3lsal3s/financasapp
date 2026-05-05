import os
import re

filepath = 'src/pages/admin/ConsultingReports.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Standardize 6. TAXA DE GESTÃO and rearrange description
# Search for the old block
fee_block_pattern = r'<div>\s+<h4 className=\"font-black uppercase mb-4 text-\[13px\] tracking-\[0\.2em\]\" style={{ color: \"#000\" }}>({.*?})\. TAXA DE GESTÃO \(FEE-BASED\)</h4>\s+<p style={{fontSize: \'12px\', color: \'#555\', fontWeight: \'bold\'}}>Calculado sobre o Patrimônio Total Consolidado Gerido: {feeRate}%</p>\s+<p className=\"text-4xl font-black mt-3 tracking-tighter\" style={{color: \'#000\'}}>{formatCurrency\(activeReportData\.total_balance \* \(parseFloat\(feeRate\.replace\(\',\',\'\.\'\)\) / 100\)\)}</p>\s+</div>'

new_fee_block = r'''<div>
                                         <h3 className="font-black uppercase mb-6 text-[18px] border-b-[3px] pb-2" style={{ borderColor: "#000", color: "#000" }}>\1. TAXA DE GESTÃO (FEE-BASED)</h3>
                                         <p className="text-4xl font-black mt-4 tracking-tighter" style={{color: '#000'}}>{formatCurrency(activeReportData.total_balance * (parseFloat(feeRate.replace(',','.')) / 100))}</p>
                                         <p style={{fontSize: '11px', color: '#888', fontWeight: 'bold', marginTop: '4px'}}>Calculado sobre o Patrimônio Total Consolidado Gerido: {feeRate}%</p>
                                      </div>'''

if re.search(fee_block_pattern, content):
    content = re.sub(fee_block_pattern, new_fee_block, content)
    print("Standardized Fee section")
else:
    print("Fee section pattern not found, trying manual fix")
    # Fallback simpler replace
    content = content.replace('<h4 className="font-black uppercase mb-4 text-[13px] tracking-[0.2em]" style={{ color: "#000" }}>{(comparisonData ? (planning.length > 0 ? 6 : 5) : (planning.length > 0 ? 5 : 4))}. TAXA DE GESTÃO (FEE-BASED)</h4>',
                              '<h3 className="font-black uppercase mb-6 text-[18px] border-b-[3px] pb-2" style={{ borderColor: "#000", color: "#000" }}>{(comparisonData ? (planning.length > 0 ? 6 : 5) : (planning.length > 0 ? 5 : 4))}. TAXA DE GESTÃO (FEE-BASED)</h3>')

# 2. Fix other H3 titles that might still have old styles or small borders
# e.g. 1. SUMÁRIO EXECUTIVO, 2. RESULTADOS CONSOLIDADOS, 3. ANÁLISE COMPARATIVA
content = content.replace('className="font-black uppercase mb-4 text-[16px] border-b-2 pb-1" style={{borderColor: \'#eee\'}}', 
                          'className="font-black uppercase mb-6 text-[18px] border-b-[3px] pb-2" style={{ borderColor: "#000", color: "#000" }}')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Standardized all titles successfully")
