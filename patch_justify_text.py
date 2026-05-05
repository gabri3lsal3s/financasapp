import os
import re

filepath = 'src/pages/admin/ConsultingReports.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Ensure Scenario and Next Steps have textAlign: 'justify'
# Old: style={{fontSize: '11px', color: '#333', lineHeight: '1.6'}}
pattern = r'style={{fontSize: \'11px\', color: \'#333\', lineHeight: \'1\.6\'}}'
replacement = "style={{ fontSize: '11px', color: '#333', lineHeight: '1.6', textAlign: 'justify' }}"
content = re.sub(pattern, replacement, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated text alignment in ConsultingReports")
