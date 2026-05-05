import os
import re

filepath = 'src/pages/admin/ConsultingReports.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove border-t and rearrange Fee section layout
old_fee_block = r'<div className=\"mt-24 pt-10 flex justify-between items-end border-t-\[3px\] border-black\">\s+<div>\s+<h3 className=\"font-black uppercase mb-6 text-\[18px\] border-b-\[3px\] pb-2\" style={{ borderColor: \"#000\", color: \"#000\" }}>(.*?)</h3>\s+<p className=\"text-4xl font-black mt-4 tracking-tighter\" style={{color: \'#000\'}}>(.*?)</p>\s+<p style={{fontSize: \'11px\', color: \'#888\', fontWeight: \'bold\', marginTop: \'4px\'}}>(.*?)</p>\s+</div>'

new_fee_block = r'''<div className="mt-24">
                                      <h3 className="font-black uppercase mb-6 text-[18px] border-b-[3px] pb-2" style={{ borderColor: "#000", color: "#000" }}>\1</h3>
                                      <div className="flex justify-between items-end">
                                         <div>
                                            <p className="text-4xl font-black mt-4 tracking-tighter" style={{color: '#000'}}>\2</p>
                                            <p style={{fontSize: '11px', color: '#888', fontWeight: 'bold', marginTop: '4px'}}>\3</p>
                                         </div>'''

if re.search(old_fee_block, content):
    content = re.sub(old_fee_block, new_fee_block, content)
    print("Fixed Fee section layout and removed top border")
else:
    print("Fee block pattern not found")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
