import os
import re

filepath = 'src/pages/admin/ConsultingReports.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove border-left from Summary block
content = content.replace('style={{ padding: "16px 24px", borderLeft: "8px solid #000", background: "transparent", overflow: "hidden", wordWrap: "break-word" }}',
                          'style={{ overflow: "hidden", wordWrap: "break-word" }}')

# Remove border-left from Scenario and Next Steps
pattern = r'style={{ padding: \'12px 20px\', borderLeft: \'6px solid #000\', background: \'transparent\', overflow: \'hidden\', wordWrap: \'break-word\' }}'
replacement = "style={{ overflow: 'hidden', wordWrap: 'break-word' }}"
content = re.sub(pattern, replacement, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed sidebars from ConsultingReports")
