$filePath = "src\pages\admin\PortfolioManagement.tsx"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText($filePath, $utf8NoBom)
# Replace target_percentage * 100).toString().replace('.', ',') with toFixed(2).replace('.', ',')
$content = $content -replace '\* 100\)\.toString\(\)\.replace\(''\.'' *, '',''([^)]*)\)', "* 100).toFixed(2).replace('.', ',')"
[System.IO.File]::WriteAllText($filePath, $content, $utf8NoBom)
Write-Host "Done formatting percentages"
