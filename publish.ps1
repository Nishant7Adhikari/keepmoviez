param(
    [switch]$Major,
    [switch]$Minor,
    [string]$VersionString
)

Write-Host "Automated Publish Script" -ForegroundColor Cyan

# 1. Version Update
$versionFile = "VERSION"
$currentVersion = (Get-Content -Path $versionFile -Raw).Trim()

if ([string]::IsNullOrWhiteSpace($VersionString)) {
    # Attempt to parse version X.Y.Z
    # Usually the format is like 5.5.03 or 5.5.3
    $parts = $currentVersion.Split('.')
    if ($parts.Length -eq 3) {
        $majorVer = [int]$parts[0]
        $minorVer = [int]$parts[1]
        $patchStr = $parts[2]
            
        # Determine padding for patch (e.g. 03 has length 2)
        $padLength = $patchStr.Length
        $patchVer = [int]$patchStr

        if ($Major) {
            $majorVer++
            $minorVer = 0
            $patchVer = 0
        }
        elseif ($Minor) {
            $minorVer++
            $patchVer = 0
        }
        else {
            $patchVer++
        }

        $newPatchStr = $patchVer.ToString("D$padLength")
        $newVersion = "$majorVer.$minorVer.$newPatchStr"
    }
    else {
        # Fallback if version doesn't split nicely
        Write-Host "Could not parse current version format cleanly. Using basic increment." -ForegroundColor Yellow
        $newVersion = $currentVersion + "-new"
    }
}
else {
    $newVersion = $VersionString
}

Write-Host "Updating version: v$currentVersion -> v$newVersion" -ForegroundColor Green
Set-Content -Path $versionFile -Value $newVersion -NoNewline

# 2. Run version updates locally 
Write-Host "Hunting down version strings for v$newVersion..." -ForegroundColor Cyan

$htmlPattern = '(?i)<!--\s*KeepMoviEZ\s+v[0-9.]+\s*-->'
$htmlReplacement = "<!-- KeepMoviEZ  v$newVersion -->"
(Get-Content index.html) -replace $htmlPattern, $htmlReplacement | Set-Content index.html

$swPattern = '(?i)const\s+CACHE_NAME\s+=\s+["'']keepmoviez-local-v[0-9.]+["''];'
$swReplacement = "const CACHE_NAME = `"keepmoviez-local-v$newVersion`";"
(Get-Content sw.js) -replace $swPattern, $swReplacement | Set-Content sw.js

(Get-Content manifest.json) -replace '(?i)"version":\s*"[0-9.]+"', "`"version`": `"$newVersion`"" | Set-Content manifest.json
(Get-Content manifest.json) -replace '(?i)"version_name":\s*"[0-9.]+"', "`"version_name`": `"$newVersion`"" | Set-Content manifest.json

if (Test-Path "docs/index.html") {
    (Get-Content docs/index.html) -replace '(?i)<small>v[0-9.]+</small>', "<small>v$newVersion</small>" | Set-Content docs/index.html
}

# 3. Cache Busting
Write-Host "Applying cache-busting (?v=$newVersion) to modified JS/CSS files..." -ForegroundColor Cyan

# Find modified or untracked .js and .css files
$changedFiles = git status --porcelain | Where-Object { $_ -match '\.(js|css)$' }

if ($changedFiles) {
    # Load index.html and sw.js content once
    $indexContent = Get-Content index.html -Raw
    $swContent = Get-Content sw.js -Raw
    $filesUpdated = $false

    foreach ($line in $changedFiles) {
        # git status output is like: " M js/app.js" or "?? js/new.js"
        $filePath = $line.Substring(3).Trim()
        # Escape path for regex
        $fileName = [System.IO.Path]::GetFileName($filePath)
            
        Write-Host " - Cache busting: $filePath" -ForegroundColor Gray

        # Replace in index.html
        # Regex: (src|href)=(['"])([^'"]*(fileName|filePath))(?:\?v=[a-zA-Z0-9.-]*)?(['"])
        $escapedFilePath = [regex]::Escape($filePath)
        $regexPattern = "(src|href)=(['`"])([^'`"]*?(?:$fileName|$escapedFilePath))(?:\?v=[a-zA-Z0-9.-]*)?(['`"])"
        $indexContent = [regex]::Replace($indexContent, $regexPattern, "`$1=`$2`$3?v=$newVersion`$4", "IgnoreCase")

        # Replace in sw.js
        $regexPatternSw = "(['`"])([^'`"]*?(?:$fileName|$escapedFilePath))(?:\?v=[a-zA-Z0-9.-]*)?(['`"])"
        $swContent = [regex]::Replace($swContent, $regexPatternSw, "`$1`$2?v=$newVersion`$3", "IgnoreCase")

        $filesUpdated = $true
    }

    if ($filesUpdated) {
        Set-Content -Path index.html -Value $indexContent -NoNewline
        Set-Content -Path sw.js -Value $swContent -NoNewline
        Write-Host "Cache busting updated in index.html and sw.js." -ForegroundColor Green
    }
}
else {
    Write-Host "No JS/CSS modifications found to cache-bust." -ForegroundColor DarkGray
}

# 4. Git Operations
Write-Host "Executing Git operations..." -ForegroundColor Cyan

# Stage all files
git add .
Write-Host "Staged changes." -ForegroundColor Green

# Output status briefly
git status -s

# Generate AI prompt and copy to clipboard
Write-Host "`nGenerating AI prompt with git diff..." -ForegroundColor Cyan
$diffOutput = git diff --cached
if (![string]::IsNullOrWhiteSpace($diffOutput)) {
    $prompt = @"
You are an expert developer. Please generate a concise, descriptive Git commit message based on the following git diff output. 
Use the Conventional Commits format (e.g., feat:, fix:, chore:, docs:).
Provide only the commit message without any additional conversational text.

Git diff:
$diffOutput
"@
    Set-Clipboard -Value $prompt
    Write-Host "✅ A prompt with your git diff has been copied to your clipboard! Paste it into ChatGPT or Gemini." -ForegroundColor Yellow

    Write-Host ""
    $commitMessage = Read-Host "Paste your commit message here (or press Enter to abort)"

    if (![string]::IsNullOrWhiteSpace($commitMessage)) {
        git commit -m $commitMessage
        Write-Host "Changes committed successfully." -ForegroundColor Green

        $push = Read-Host "Do you want to push to remote? [Y/n]"
        if ($push -eq '' -or $push.ToLower().StartsWith('y')) {
            Write-Host "Pushing changes..." -ForegroundColor Cyan
            git push
            Write-Host "Push complete." -ForegroundColor Green
        } else {
            Write-Host "Push skipped." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Commit aborted. Changes are still staged." -ForegroundColor Yellow
    }
}
else {
    Write-Host "No changes detected in git diff." -ForegroundColor DarkGray
}
