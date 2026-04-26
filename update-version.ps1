# 1. Read the version
$version = Get-Content -Path "VERSION" -Raw
$version = $version.Trim()

Write-Host "Hunting down version strings for v$version..." -ForegroundColor Cyan

# 2. Update index.html comment
# This regex (\s*) matches ANY kind of space, including those annoying non-breaking ones.
$htmlPattern = '(?i)'
$htmlReplacement = ""
(Get-Content index.html) -replace $htmlPattern, $htmlReplacement | Set-Content index.html

# 3. Update sw.js
$swPattern = '(?i)const\s+CACHE_NAME\s+=\s+["'']keepmoviez-local-v[0-9.]+["''];'
$swReplacement = "const CACHE_NAME = `"keepmoviez-local-v$version`";"
(Get-Content sw.js) -replace $swPattern, $swReplacement | Set-Content sw.js

# 4. Update manifest.json
(Get-Content manifest.json) -replace '(?i)"version":\s*"[0-9.]+"', "`"version`": `"$version`"" | Set-Content manifest.json
(Get-Content manifest.json) -replace '(?i)"version_name":\s*"[0-9.]+"', "`"version_name`": `"$version`"" | Set-Content manifest.json

# 5. Update docs/index.html
if (Test-Path "docs/index.html") {
    (Get-Content docs/index.html) -replace '(?i)<small>v[0-9.]+</small>', "<small>v$version</small>" | Set-Content docs/index.html
}

Write-Host "Exorcism complete. Everything should be v$version now." -ForegroundColor Green