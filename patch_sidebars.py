import os
import re

filepath = 'src/pages/admin/ConsultingReports.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Summary block
content = content.replace('className="mb-12" style={{ overflow: "hidden", wordWrap: "break-word" }}', 
                          'className="mb-12" style={{ padding: "16px 24px", borderLeft: "8px solid #000", background: "transparent", overflow: "hidden", wordWrap: "break-word" }}')

# 2. Update Scenario and Next Steps
# Old style might vary. I'll use regex.
pattern = r'style={{background: \'#f9f9f9\', padding: \'16px\', borderLeft: \'4px solid #.*?\'}}'
replacement = "style={{ padding: '12px 20px', borderLeft: '6px solid #000', background: 'transparent', overflow: 'hidden', wordWrap: 'break-word' }}"
content = re.sub(pattern, replacement, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated blocks in ConsultingReports")
