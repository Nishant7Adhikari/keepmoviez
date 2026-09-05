param(
    [switch]$Major,
    [switch]$Minor,
    [string]$VersionString
)

$ErrorActionPreference = 'Stop'

# PowerShell 7.3+ can optionally treat non-zero native command exit codes
# as PowerShell errors. This script intentionally handles Git exit codes
# itself, so disable that behavior when the variable exists.
if ($null -ne (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue)) {
    $PSNativeCommandUseErrorActionPreference = $false
}

Write-Host "Automated Publish Script" -ForegroundColor Cyan

# ------------------------------------------------------------
# Git helper
# ------------------------------------------------------------

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [switch]$AllowFailure
    )

    # Git writes warnings to stderr even when the command succeeds.
    # Capture stdout and stderr separately so PowerShell does not treat
    # normal Git warnings as terminating errors.
    $stdoutFile = [System.IO.Path]::GetTempFileName()
    $stderrFile = [System.IO.Path]::GetTempFileName()

    $escapedArgs = @(
        $Arguments | ForEach-Object {
            if ($_ -match '[\s"]') {
                '"{0}"' -f ($_ -replace '(\\*)(")', '$1$1\"' -replace '(\\+)$', '$1$1')
            } else {
                $_
            }
        }
    )

    try {
        $process = Start-Process `
            -FilePath "git.exe" `
            -ArgumentList $escapedArgs `
            -NoNewWindow `
            -Wait `
            -PassThru `
            -RedirectStandardOutput $stdoutFile `
            -RedirectStandardError $stderrFile

        $stdout = @()

        if (Test-Path -LiteralPath $stdoutFile) {
            $stdout = @(
                Get-Content `
                    -Path $stdoutFile `
                    -ErrorAction SilentlyContinue
            )
        }

        $stderr = @()

        if (Test-Path -LiteralPath $stderrFile) {
            $stderr = @(
                Get-Content `
                    -Path $stderrFile `
                    -ErrorAction SilentlyContinue
            )
        }

        $output = @(
            $stdout + $stderr
        )

        $exitCode = $process.ExitCode

        if (-not $AllowFailure -and $exitCode -ne 0) {

            if ($output) {
                $output | ForEach-Object {
                    Write-Host $_ -ForegroundColor Red
                }
            }

            throw "git $($Arguments -join ' ') failed with exit code $exitCode."
        }

        # Display Git warnings/informational stderr output without
        # treating them as PowerShell errors.
        if ($stderr.Count -gt 0) {
            $stderr | ForEach-Object {
                Write-Host $_ -ForegroundColor Yellow
            }
        }

        return [PSCustomObject]@{
            Output   = @($output)
            ExitCode = $exitCode
        }
    }
    finally {

        if (Test-Path -LiteralPath $stdoutFile) {
            Remove-Item `
                -Path $stdoutFile `
                -Force `
                -ErrorAction SilentlyContinue
        }

        if (Test-Path -LiteralPath $stderrFile) {
            Remove-Item `
                -Path $stderrFile `
                -Force `
                -ErrorAction SilentlyContinue
        }
    }
}

# ------------------------------------------------------------
# Repository helpers
# ------------------------------------------------------------

function Get-RepoPath {

    $result = Invoke-Git @(
        'rev-parse',
        '--show-toplevel'
    )

    $repoPath = (
        $result.Output |
        Select-Object -First 1
    ).ToString().Trim()

    if ([string]::IsNullOrWhiteSpace($repoPath)) {
        throw "Could not determine repository root."
    }

    return $repoPath
}

function Test-MergeInProgress {

    $result = Invoke-Git @(
        'rev-parse',
        '--git-path',
        'MERGE_HEAD'
    )

    $mergeHeadPath = (
        $result.Output |
        Select-Object -First 1
    ).ToString().Trim()

    if ([string]::IsNullOrWhiteSpace($mergeHeadPath)) {
        return $false
    }

    return Test-Path -LiteralPath $mergeHeadPath
}

function Get-UnmergedFiles {

    $result = Invoke-Git @(
        'diff',
        '--name-only',
        '--diff-filter=U'
    ) -AllowFailure

    return @(
        $result.Output |
        ForEach-Object {
            $_.ToString().Trim()
        } |
        Where-Object {
            -not [string]::IsNullOrWhiteSpace($_)
        } |
        Sort-Object -Unique
    )
}

# ------------------------------------------------------------
# Finish an existing merge.
#
# IMPORTANT:
# This function stages ONLY paths Git currently considers
# conflicted. It never uses "git add -A".
# ------------------------------------------------------------

function Finish-ExistingMerge {

    Write-Host "`nA Git merge is already in progress." -ForegroundColor Yellow

    $unmerged = Get-UnmergedFiles

    if ($unmerged.Count -gt 0) {

        Write-Host "Unresolved merge conflicts detected:" -ForegroundColor Red

        $unmerged | ForEach-Object {
            Write-Host " - $_" -ForegroundColor Red
        }

        Write-Host "`nChecking whether the conflict files have been resolved..." -ForegroundColor Cyan

        # Stage ONLY conflict paths.
        foreach ($path in $unmerged) {
            Invoke-Git @(
                'add',
                '--',
                $path
            ) | Out-Null
        }

        # Git's index is the authority for whether the conflicts
        # are actually resolved.
        $unmerged = Get-UnmergedFiles

        if ($unmerged.Count -gt 0) {

            Write-Host "`nSome merge conflicts are still unresolved." -ForegroundColor Red

            $unmerged | ForEach-Object {
                Write-Host " - $_" -ForegroundColor Red
            }

            Write-Host "`nResolve them in VS Code, save the files, then run publish.ps1 again." -ForegroundColor Yellow

            exit 1
        }
    }

    Write-Host "No unresolved conflicts remain. Finishing the existing merge..." -ForegroundColor Cyan

    $commitResult = Invoke-Git @(
        'commit',
        '--no-edit'
    ) -AllowFailure

    if ($commitResult.ExitCode -ne 0) {

        $commitResult.Output | ForEach-Object {
            Write-Host $_ -ForegroundColor Red
        }

        Write-Host "`nThe merge could not be completed automatically." -ForegroundColor Red
        Write-Host "Finish the Git merge manually, then run publish.ps1 again." -ForegroundColor Yellow

        exit $commitResult.ExitCode
    }

    Write-Host "Existing merge completed successfully." -ForegroundColor Green
}

# ------------------------------------------------------------
# VERSION history helpers
# ------------------------------------------------------------

function Get-LastVersionCommit {

    # IMPORTANT:
    #
    # This searches committed Git history, NOT git status.
    #
    # It is the historical publication boundary.
    #
    # It must be captured before this script creates any new commit.
    #

    $result = Invoke-Git @(
        'log',
        '-1',
        '--format=%H',
        '--',
        'VERSION'
    ) -AllowFailure

    $sha = (
        $result.Output |
        Select-Object -First 1
    ).ToString().Trim()

    if ([string]::IsNullOrWhiteSpace($sha)) {
        throw "Could not find a committed history entry for VERSION. VERSION must have been committed at least once."
    }

    return $sha
}

function Get-ChangedPathsSince {

    param(
        [Parameter(Mandatory = $true)]
        [string]$Commit
    )

    $result = Invoke-Git @(
        'diff',
        '--name-only',
        $Commit,
        'HEAD'
    )

    return @(
        $result.Output |
        ForEach-Object {
            $_.ToString().Trim()
        } |
        Where-Object {
            -not [string]::IsNullOrWhiteSpace($_)
        } |
        Sort-Object -Unique
    )
}

# ------------------------------------------------------------
# Working tree helpers
# ------------------------------------------------------------

function Get-WorkingTreeChanges {

    $result = Invoke-Git @(
        'status',
        '--porcelain=v1'
    )

    return @(
        $result.Output |
        Where-Object {
            -not [string]::IsNullOrWhiteSpace($_)
        }
    )
}

function Test-VersionWorkingTreeChange {

    $result = Invoke-Git @(
        'status',
        '--porcelain=v1',
        '--',
        'VERSION'
    )

    return @(
        $result.Output |
        Where-Object {
            -not [string]::IsNullOrWhiteSpace($_)
        }
    ).Count -gt 0
}

# ------------------------------------------------------------
# File helpers
#
# Using -Raw / -NoNewline prevents Get-Content from rebuilding
# the file line-by-line and potentially changing line endings.
# ------------------------------------------------------------

function Read-TextFile {

    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [System.IO.File]::ReadAllText(
        (Join-Path (Get-Location) $Path)
    )
}

function Write-TextFile {

    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    $fullPath = Join-Path (Get-Location) $Path

    # UTF-8 without BOM.
    #
    # Keep-MovieZ web files are expected to be UTF-8.
    # This avoids PowerShell's older UTF-8 BOM behavior.
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)

    [System.IO.File]::WriteAllText(
        $fullPath,
        $Content,
        $utf8NoBom
    )
}

# ------------------------------------------------------------
# Version validation
# ------------------------------------------------------------

function Test-VersionFormat {

    param(
        [Parameter(Mandatory = $true)]
        [string]$Version
    )

    return $Version -match '^\d+\.\d+\.\d+$'
}

function Get-VersionParts {

    param(
        [Parameter(Mandatory = $true)]
        [string]$Version
    )

    if (-not (Test-VersionFormat $Version)) {
        throw "Invalid VERSION format '$Version'. VERSION must always use MAJOR.MINOR.PATCH, for example 1.4.12."
    }

    $parts = $Version.Split('.')

    $major = 0
    $minor = 0
    $patch = 0

    if (
        -not [int]::TryParse($parts[0], [ref]$major) -or
        -not [int]::TryParse($parts[1], [ref]$minor) -or
        -not [int]::TryParse($parts[2], [ref]$patch)
    ) {
        throw "VERSION '$Version' contains a number too large for the supported version parser."
    }

    return [PSCustomObject]@{
        Major      = $major
        Minor      = $minor
        Patch      = $patch
        PatchWidth = $parts[2].Length
    }
}

function Get-NewVersion {

    param(
        [Parameter(Mandatory = $true)]
        [string]$CurrentVersion,

        [switch]$Major,
        [switch]$Minor,
        [string]$VersionString
    )

    $parts = Get-VersionParts $CurrentVersion

    if (-not [string]::IsNullOrWhiteSpace($VersionString)) {

        if (-not (Test-VersionFormat $VersionString)) {
            throw "Invalid -VersionString '$VersionString'. Use MAJOR.MINOR.PATCH only, for example -VersionString '2.0.0'."
        }

        return $VersionString
    }

    $majorNum = $parts.Major
    $minorNum = $parts.Minor
    $patchNum = $parts.Patch
    $patchWidth = $parts.PatchWidth

    if ($Major) {

        $majorNum++
        $minorNum = 0
        $patchNum = 0
        $patchWidth = 1
    }
    elseif ($Minor) {

        $minorNum++
        $patchNum = 0
        $patchWidth = 1
    }
    else {

        $patchNum++
    }

    $newPatch = $patchNum.ToString("D$patchWidth")

    return "$majorNum.$minorNum.$newPatch"
}

# ------------------------------------------------------------
# Version reference replacement helper
# ------------------------------------------------------------

function Replace-Required {

    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Pattern,

        [Parameter(Mandatory = $true)]
        [string]$Replacement,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $false
    }

    $content = Read-TextFile $Path

    $updated = [regex]::Replace(
        $content,
        $Pattern,
        $Replacement,
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    if ($updated -eq $content) {

        throw "Could not update $Description in '$Path'. The expected pattern was not found."
    }

    Write-TextFile `
        -Path $Path `
        -Content $updated

    Write-Host "Updated $Description in $Path." -ForegroundColor Green

    return $true
}

# ------------------------------------------------------------
# Validate generated version references
# ------------------------------------------------------------

function Test-VersionReferences {

    param(
        [Parameter(Mandatory = $true)]
        [string]$Version
    )

    $errors = @()

    # index.html
    if (Test-Path -LiteralPath "index.html") {

        $content = Read-TextFile "index.html"

        if (
            $content -notmatch "(?i)<!--\s*KeepMoviEZ\s+v$([regex]::Escape($Version))\s*-->"
        ) {
            $errors += "index.html does not contain the expected KeepMoviEZ version comment."
        }

        if ($content -match '(?i)(?:src|href)\s*=\s*["'']\s*=') {
            $errors += "index.html contains corrupted script or link references with missing path (e.g., src=`"=...`")."
        }
    }

    # sw.js
    if (Test-Path -LiteralPath "sw.js") {

        $content = Read-TextFile "sw.js"

        if (
            $content -notmatch "(?i)const\s+CACHE_NAME\s*=\s*['""]keepmoviez-local-v$([regex]::Escape($Version))['""];"
        ) {
            $errors += "sw.js does not contain the expected CACHE_NAME version."
        }

        if ($content -match '["'']\s*=[0-9.]+\s*["'']') {
            $errors += "sw.js contains corrupted asset paths with missing path (e.g., `"=...`")."
        }
    }

    # manifest.json
    if (Test-Path -LiteralPath "manifest.json") {

        $content = Read-TextFile "manifest.json"

        try {
            $manifest = $content | ConvertFrom-Json
        }
        catch {
            $errors += "manifest.json is no longer valid JSON: $($_.Exception.Message)"
        }

        if ($null -ne $manifest) {

            if ($manifest.version -ne $Version) {
                $errors += "manifest.json 'version' is '$($manifest.version)' instead of '$Version'."
            }

            if ($manifest.version_name -ne $Version) {
                $errors += "manifest.json 'version_name' is '$($manifest.version_name)' instead of '$Version'."
            }
        }
    }

    # docs/index.html
    if (Test-Path -LiteralPath "docs/index.html") {

        $content = Read-TextFile "docs/index.html"

        if (
            $content -notmatch "(?i)<small>v$([regex]::Escape($Version))</small>"
        ) {
            $errors += "docs/index.html does not contain the expected version."
        }
    }

    if ($errors.Count -gt 0) {

        Write-Host "`nVERSION REFERENCE VALIDATION FAILED:" -ForegroundColor Red

        $errors | ForEach-Object {
            Write-Host " - $_" -ForegroundColor Red
        }

        throw "One or more generated version references are incorrect."
    }

    Write-Host "All version references validated successfully." -ForegroundColor Green
}

# ------------------------------------------------------------
# Cache-busting helper
# ------------------------------------------------------------

function Get-CacheBustFiles {

    param(
        [Parameter(Mandatory = $true)]
        [string[]]$ChangedPaths
    )

    $files = @()

    foreach ($filePath in $ChangedPaths) {

        $normalizedPath = $filePath.Replace('\', '/')

        # Ignore vendor/library files.
        if (
            $normalizedPath -match '(^|/)libs/'
        ) {
            continue
        }

        # Application JS/CSS anywhere in the project.
        if (
            $normalizedPath -match '(?i)\.(js|css)$'
        ) {
            $files += $normalizedPath
        }
    }

    return @(
        $files |
        Sort-Object -Unique
    )
}

function Update-CacheBusting {

    param(
        [Parameter(Mandatory = $true)]
        [string[]]$ChangedPaths,

        [Parameter(Mandatory = $true)]
        [string]$Version
    )

    $cacheBustFiles = Get-CacheBustFiles `
        -ChangedPaths $ChangedPaths

    if ($cacheBustFiles.Count -eq 0) {

        Write-Host "No application JS/CSS modifications found to cache-bust." -ForegroundColor DarkGray

        return
    }

    Write-Host "`nApplying cache-busting (?v=$Version)..." -ForegroundColor Cyan

    $indexExists = Test-Path -LiteralPath "index.html"
    $swExists = Test-Path -LiteralPath "sw.js"

    if (-not $indexExists -and -not $swExists) {

        Write-Host "Neither index.html nor sw.js exists. No cache-busting targets are available." -ForegroundColor Yellow

        return
    }

    $indexContent = $null
    $swContent = $null

    if ($indexExists) {
        $indexContent = Read-TextFile "index.html"
    }

    if ($swExists) {
        $swContent = Read-TextFile "sw.js"
    }

    $indexChanged = $false
    $swChanged = $false

    foreach ($filePath in $cacheBustFiles) {

        Write-Host " - Checking: $filePath" -ForegroundColor Gray

        $escapedPath = [regex]::Escape($filePath)

        # Also allow the common "./js/file.js" and "/js/file.js"
        # forms while still matching the exact project path.
        $pathPattern = "(?:\./|/)?$escapedPath"

        # --------------------------------------------------------
        # index.html
        #
        # Matches:
        #
        # src="js/app.js"
        # src="./js/app.js?v=old"
        # href="/style.css"
        #
        # Preserves quote type and replaces an existing query.
        # --------------------------------------------------------

        if ($indexExists) {

            $indexPattern =
                "((?:src|href)\s*=\s*)([""'])($pathPattern)(?:\?[^""'#\s]*)?((?:#[^""'\s]*)?)([""'])"

            $indexReplacement = {
                param($match)

                $prefix = $match.Groups[1].Value
                $quote = $match.Groups[2].Value
                $path = $match.Groups[3].Value
                $fragment = $match.Groups[4].Value
                $closingQuote = $match.Groups[5].Value

                return "$prefix$quote$($path)?v=$($Version)$fragment$closingQuote"
            }

            $newIndexContent = [regex]::Replace(
                $indexContent,
                $indexPattern,
                $indexReplacement,
                [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
            )

            if ($newIndexContent -ne $indexContent) {

                $indexChanged = $true
                $indexContent = $newIndexContent

                Write-Host "   Updated index.html" -ForegroundColor Green
            }
        }

        # --------------------------------------------------------
        # sw.js
        #
        # Matches quoted file references:
        #
        # "js/app.js"
        # './js/app.js?v=old'
        #
        # This deliberately supports only normal JS string quotes.
        # Backticks are not needed for the application's current
        # file-reference format.
        # --------------------------------------------------------

        if ($swExists) {

            $swPattern =
                "([""'])($pathPattern)(?:\?[^""'#\s]*)?((?:#[^""'\s]*)?)([""'])"

            $swReplacement = {
                param($match)

                $quote = $match.Groups[1].Value
                $path = $match.Groups[2].Value
                $fragment = $match.Groups[3].Value
                $closingQuote = $match.Groups[4].Value

                return "$quote$($path)?v=$($Version)$fragment$closingQuote"
            }

            $newSwContent = [regex]::Replace(
                $swContent,
                $swPattern,
                $swReplacement,
                [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
            )

            if ($newSwContent -ne $swContent) {

                $swChanged = $true
                $swContent = $newSwContent

                Write-Host "   Updated sw.js" -ForegroundColor Green
            }
        }
    }

    if ($indexChanged) {

        if ($indexContent -match '(?i)(?:src|href)\s*=\s*["'']\s*=') {
            throw "Corrupted URL pattern detected in index.html during cache busting."
        }

        Write-TextFile `
            -Path "index.html" `
            -Content $indexContent
    }

    if ($swChanged) {

        if ($swContent -match '["'']\s*=[0-9.]+\s*["'']') {
            throw "Corrupted asset path detected in sw.js during cache busting."
        }

        Write-TextFile `
            -Path "sw.js" `
            -Content $swContent
    }

    if (-not $indexChanged -and -not $swChanged) {

        Write-Host "`nNo references to the changed JS/CSS files were found in index.html or sw.js." -ForegroundColor Yellow

        Write-Host "Changed application files:" -ForegroundColor Yellow

        $cacheBustFiles | ForEach-Object {
            Write-Host " - $_" -ForegroundColor Yellow
        }

        Write-Host "No cache-busting references were modified." -ForegroundColor Yellow
    }
}

# ------------------------------------------------------------
# Commit ordinary local working-tree changes.
#
# VERSION is deliberately excluded from ordinary local commits.
# A manually modified VERSION must be handled explicitly.
# ------------------------------------------------------------

function Commit-WorkingTreeChanges {

    $status = Get-WorkingTreeChanges

    if ($status.Count -eq 0) {
        return $false
    }

    if (Test-VersionWorkingTreeChange) {

        Write-Host "`nVERSION has been modified in the working tree." -ForegroundColor Red

        Write-Host "publish.ps1 will not include a manual VERSION change in the ordinary local commit." -ForegroundColor Yellow
        Write-Host "If you intentionally want a specific version, use:" -ForegroundColor Yellow
        Write-Host "  .\publish.ps1 -VersionString `"MAJOR.MINOR.PATCH`"" -ForegroundColor Cyan

        throw "VERSION has an uncommitted change. Revert it or use -VersionString intentionally."
    }

    Write-Host "`nUncommitted local changes detected." -ForegroundColor Yellow

    git status --short

    Write-Host "`nStaging local changes for the AI commit-message workflow..." -ForegroundColor Cyan

    Invoke-Git @(
        'add',
        '-A'
    ) | Out-Null

    Write-Host "Staged changes:" -ForegroundColor Green

    git status --short

    Write-Host "`nGenerating AI prompt with git diff..." -ForegroundColor Cyan

    $diffResult = Invoke-Git @(
        'diff',
        '--cached'
    )

    $diffOutput = (
        $diffResult.Output -join [Environment]::NewLine
    )

    if ([string]::IsNullOrWhiteSpace($diffOutput)) {

        Write-Host "No staged changes detected. Nothing to commit." -ForegroundColor DarkGray

        return $false
    }

    $prompt = @"
You are an expert developer. Please generate a concise, descriptive Git commit message based on the following git diff output.
Use the Conventional Commits format (e.g., feat:, fix:, chore:, docs:).
Provide only the commit message without any additional conversational text but it should be descriptive (Range 1 - 80 words), multi-lines are recommended if major changes included else single line is preferred for minor changes.
Always provide output in a copy codeblock format.

Git diff:
$diffOutput
"@

    Set-Clipboard -Value $prompt

    Write-Host "Prompt with git diff copied to clipboard. Paste it into an AI assistant." -ForegroundColor Yellow

    $tempFile = [System.IO.Path]::GetTempFileName()

    try {

        Write-Host ""
        Write-Host "Paste your commit message below, then save and close the editor." -ForegroundColor Cyan

        Start-Process `
            notepad.exe `
            -ArgumentList $tempFile `
            -Wait

        $commitMessage = Get-Content `
            -Path $tempFile `
            -Raw `
            -ErrorAction SilentlyContinue

        if ($commitMessage) {
            $commitMessage = $commitMessage.Trim()
        }

        if ([string]::IsNullOrWhiteSpace($commitMessage)) {

            Write-Host "Commit aborted (empty message). Changes are still staged." -ForegroundColor Yellow

            exit 1
        }

        Set-Content `
            -Path $tempFile `
            -Value $commitMessage `
            -Encoding UTF8

        $commitResult = Invoke-Git @(
            'commit',
            '-F',
            $tempFile
        ) -AllowFailure

        if ($commitResult.ExitCode -ne 0) {

            $commitResult.Output | ForEach-Object {
                Write-Host $_ -ForegroundColor Red
            }

            Write-Host "Git commit failed. Changes are still staged." -ForegroundColor Red

            exit $commitResult.ExitCode
        }

        Write-Host "Local changes committed successfully." -ForegroundColor Green

        return $true
    }
    finally {

        if (Test-Path -LiteralPath $tempFile) {

            Remove-Item `
                -Path $tempFile `
                -Force `
                -ErrorAction SilentlyContinue
        }
    }
}

# ------------------------------------------------------------
# Push helper
# ------------------------------------------------------------

function Ask-AndPush {

    param(
        [string]$Message = "Do you want to push to remote? [Y/n]"
    )

    $push = Read-Host $Message

    if (
        $push -eq '' -or
        $push.ToLower().StartsWith('y')
    ) {

        Write-Host "Pushing changes..." -ForegroundColor Cyan

        $pushResult = Invoke-Git @(
            'push'
        ) -AllowFailure

        if ($pushResult.ExitCode -eq 0) {

            Write-Host "Push complete." -ForegroundColor Green

            return $true
        }

        $pushResult.Output | ForEach-Object {
            Write-Host $_ -ForegroundColor Red
        }

        Write-Host "Push failed. Your commits remain local. Run publish.ps1 again to retry." -ForegroundColor Red

        exit $pushResult.ExitCode
    }

    Write-Host "Push skipped. Your commits remain local." -ForegroundColor Yellow

    return $false
}

# ============================================================
# MAIN
# ============================================================

# ------------------------------------------------------------
# 0. Move to repository root
# ------------------------------------------------------------

$repoRoot = Get-RepoPath

Set-Location -Path $repoRoot

Write-Host "Repository: $repoRoot" -ForegroundColor DarkGray

# ------------------------------------------------------------
# 1. Validate VERSION exists BEFORE doing anything else.
# ------------------------------------------------------------

$versionFile = "VERSION"

if (-not (Test-Path -LiteralPath $versionFile)) {
    throw "VERSION file was not found."
}

$currentVersion = (
    Read-TextFile $versionFile
).Trim()

if ([string]::IsNullOrWhiteSpace($currentVersion)) {
    throw "VERSION file is empty."
}

if (-not (Test-VersionFormat $currentVersion)) {
    throw "VERSION '$currentVersion' is invalid. It must always be MAJOR.MINOR.PATCH using numbers only."
}

# ------------------------------------------------------------
# 2. Capture the last committed VERSION change BEFORE this
#    script creates any new commit.
# ------------------------------------------------------------

$lastVersionCommit = Get-LastVersionCommit

Write-Host "Current VERSION: v$currentVersion" -ForegroundColor DarkGray
Write-Host "Last committed VERSION change: $lastVersionCommit" -ForegroundColor DarkGray

# ------------------------------------------------------------
# 3. Existing merge?
#
#    NEVER fetch/pull again while a merge is already active.
# ------------------------------------------------------------

if (Test-MergeInProgress) {

    Finish-ExistingMerge
}

# ------------------------------------------------------------
# 4. Handle ordinary uncommitted local work FIRST.
#
#    This makes synchronization safe and predictable.
# ------------------------------------------------------------

[void](Commit-WorkingTreeChanges)

# ------------------------------------------------------------
# 5. Fetch remote information.
# ------------------------------------------------------------

Write-Host "`nSynchronizing with remote..." -ForegroundColor Cyan

Invoke-Git @(
    'fetch',
    'origin'
) | Out-Null

# ------------------------------------------------------------
# 6. Determine upstream branch.
# ------------------------------------------------------------

$upstreamResult = Invoke-Git @(
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}'
) -AllowFailure

$upstream = (
    $upstreamResult.Output |
    Select-Object -First 1
).ToString().Trim()

if ([string]::IsNullOrWhiteSpace($upstream)) {

    throw "This branch has no upstream remote branch. Set one with 'git push -u origin <branch>', then rerun publish.ps1."
}

Write-Host "Upstream: $upstream" -ForegroundColor DarkGray

# ------------------------------------------------------------
# 7. Compare local branch with remote.
# ------------------------------------------------------------

$localSha = (
    Invoke-Git @(
        'rev-parse',
        'HEAD'
    )
).Output |
    Select-Object -First 1

$localSha = $localSha.ToString().Trim()

$remoteSha = (
    Invoke-Git @(
        'rev-parse',
        $upstream
    )
).Output |
    Select-Object -First 1

$remoteSha = $remoteSha.ToString().Trim()

$baseSha = (
    Invoke-Git @(
        'merge-base',
        'HEAD',
        $upstream
    )
).Output |
    Select-Object -First 1

$baseSha = $baseSha.ToString().Trim()

if ($localSha -eq $remoteSha) {

    # --------------------------------------------------------
    # SAME
    # --------------------------------------------------------

    Write-Host "Local branch and $upstream are already synchronized." -ForegroundColor Green
}
elseif ($baseSha -eq $localSha) {

    # --------------------------------------------------------
    # REMOTE AHEAD ONLY
    #
    # Remote: A-B-C-D
    # Local:  A-B
    #
    # Safe fast-forward.
    # --------------------------------------------------------

    Write-Host "$upstream is ahead. Fast-forwarding local branch..." -ForegroundColor Cyan

    Invoke-Git @(
        'pull',
        '--ff-only'
    ) | Out-Null

    Write-Host "Fast-forward complete." -ForegroundColor Green
}
elseif ($baseSha -eq $remoteSha) {

    # --------------------------------------------------------
    # LOCAL AHEAD ONLY
    #
    # Remote: A-B
    # Local:  A-B-C-D
    #
    # Nothing needs to be pulled.
    # --------------------------------------------------------

    Write-Host "Local branch is ahead of $upstream. No pull is needed." -ForegroundColor Green
}
else {

    # --------------------------------------------------------
    # DIVERGED
    #
    # Remote: A-B-C-D
    # Local:  A-B-X-Y
    #
    # Let normal Git merge the histories.
    #
    # If Git can merge automatically:
    #     continue.
    #
    # If Git encounters conflicts:
    #     stop.
    #     User resolves them.
    #     User runs publish.ps1 again.
    # --------------------------------------------------------

    Write-Host "Local and remote histories have diverged." -ForegroundColor Yellow
    Write-Host "Attempting normal Git pull/merge..." -ForegroundColor Yellow

    $pullResult = Invoke-Git @(
        'pull',
        '--no-rebase'
    ) -AllowFailure

    if ($pullResult.ExitCode -ne 0) {

        $pullResult.Output | ForEach-Object {
            Write-Host $_ -ForegroundColor Red
        }

        if (Test-MergeInProgress) {

            Write-Host "`nGit has started a merge but conflicts require your attention." -ForegroundColor Yellow
            Write-Host "Resolve the conflicts in VS Code, save the files, then run publish.ps1 again." -ForegroundColor Yellow
        }
        else {

            Write-Host "`nGit pull failed for another reason." -ForegroundColor Red
            Write-Host "Resolve the Git issue, then run publish.ps1 again." -ForegroundColor Yellow
        }

        exit $pullResult.ExitCode
    }

    Write-Host "Diverged histories merged successfully." -ForegroundColor Green
}

# ------------------------------------------------------------
# 8. Safety check after synchronization.
#
#    A merge may still be active if Git left one unresolved.
# ------------------------------------------------------------

if (Test-MergeInProgress) {

    Finish-ExistingMerge
}

# ------------------------------------------------------------
# 9. Re-read VERSION after synchronization.
#
#    Remote/Jules commits may have changed VERSION.
# ------------------------------------------------------------

$currentVersion = (
    Read-TextFile $versionFile
).Trim()

if ([string]::IsNullOrWhiteSpace($currentVersion)) {
    throw "VERSION file is empty."
}

if (-not (Test-VersionFormat $currentVersion)) {
    throw "VERSION '$currentVersion' is invalid after synchronization. It must always be MAJOR.MINOR.PATCH using numbers only."
}

# ------------------------------------------------------------
# 10. Important boundary handling.
#
# If synchronization brought in a newer committed VERSION change,
# that newer commit is now the real publication boundary.
#
# Example:
#
# Before sync:
#   A -- VERSION 1.0.0
#
# Remote:
#   A -- B -- VERSION 1.1.0 -- C
#
# The latest VERSION commit after sync is the correct boundary.
# We must not bump 1.1.0 merely because B changed VERSION.
# We DO still process C and anything after that boundary.
# ------------------------------------------------------------

$currentLastVersionCommit = Get-LastVersionCommit

if ($currentLastVersionCommit -ne $lastVersionCommit) {

    Write-Host "`nA newer committed VERSION change was found during synchronization." -ForegroundColor Yellow

    Write-Host "Using the newest VERSION commit as the publication boundary." -ForegroundColor Yellow

    $lastVersionCommit = $currentLastVersionCommit
}

Write-Host "Publication boundary: $lastVersionCommit" -ForegroundColor DarkGray

# ------------------------------------------------------------
# 11. Find EVERYTHING changed since the publication boundary.
#
#     NOT git status.
#
#     This catches:
#
#       - GitHub changes
#       - Jules changes
#       - merged PRs
#       - local commits
#       - merge commits
# ------------------------------------------------------------

$changedSinceVersion = Get-ChangedPathsSince `
    -Commit $lastVersionCommit

if ($changedSinceVersion.Count -eq 0) {

    Write-Host "`nNo changes since the last committed VERSION change." -ForegroundColor DarkGray

    # --------------------------------------------------------
    # This normally means:
    #
    #   - version bump already happened
    #   - push was skipped
    #   - previous push failed
    #
    # DO NOT bump again.
    # --------------------------------------------------------

    $localNow = (
        Invoke-Git @(
            'rev-parse',
            'HEAD'
        )
    ).Output |
        Select-Object -First 1

    $localNow = $localNow.ToString().Trim()

    $remoteNow = (
        Invoke-Git @(
            'rev-parse',
            $upstream
        )
    ).Output |
        Select-Object -First 1

    $remoteNow = $remoteNow.ToString().Trim()

    if ($localNow -ne $remoteNow) {

        $aheadResult = Invoke-Git @(
            'rev-list',
            '--count',
            "$upstream..HEAD"
        )

        $aheadCount = [int](
            (
                $aheadResult.Output |
                Select-Object -First 1
            ).ToString().Trim()
        )

        if ($aheadCount -gt 0) {

            Write-Host "Local has $aheadCount commit(s) not pushed to $upstream." -ForegroundColor Yellow

            [void](Ask-AndPush `
                -Message "Do you want to push the existing commits to remote? [Y/n]")
        }
    }

    exit 0
}

Write-Host "`nFiles changed since the publication boundary:" -ForegroundColor Cyan

$changedSinceVersion | ForEach-Object {
    Write-Host " - $_" -ForegroundColor Gray
}

# ------------------------------------------------------------
# 12. Calculate exactly ONE new version.
# ------------------------------------------------------------

$newVersion = Get-NewVersion `
    -CurrentVersion $currentVersion `
    -Major:$Major `
    -Minor:$Minor `
    -VersionString $VersionString

if (-not (Test-VersionFormat $newVersion)) {
    throw "Generated version '$newVersion' is invalid."
}

if ($newVersion -eq $currentVersion) {
    throw "Generated version is identical to the current version."
}

Write-Host "`nUpdating version: v$currentVersion -> v$newVersion" -ForegroundColor Green

# ------------------------------------------------------------
# 13. Update VERSION itself.
# ------------------------------------------------------------

Write-TextFile `
    -Path $versionFile `
    -Content $newVersion

# ------------------------------------------------------------
# 14. Update fixed version references.
# ------------------------------------------------------------

Write-Host "`nUpdating fixed version references..." -ForegroundColor Cyan

# index.html
if (Test-Path -LiteralPath "index.html") {

    Replace-Required `
        -Path "index.html" `
        -Pattern '(?i)<!--\s*KeepMoviEZ\s+v[0-9.]+\s*-->' `
        -Replacement "<!-- KeepMoviEZ  v$newVersion -->" `
        -Description "KeepMoviEZ version comment" |
        Out-Null
}

# sw.js
if (Test-Path -LiteralPath "sw.js") {

    Replace-Required `
        -Path "sw.js" `
        -Pattern '(?i)const\s+CACHE_NAME\s*=\s*["'']keepmoviez-local-v[0-9.]+["''];' `
        -Replacement "const CACHE_NAME = `"keepmoviez-local-v$newVersion`";" `
        -Description "service-worker CACHE_NAME" |
        Out-Null
}

# manifest.json
if (Test-Path -LiteralPath "manifest.json") {

    $manifestContent = Read-TextFile "manifest.json"

    # Preserve the existing comma instead of forcing one.
    $manifestVersionPattern =
        '(?i)"version"\s*:\s*"[0-9.]+"(?<comma>\s*,)?'

    $manifestVersionUpdated = [regex]::Replace(
        $manifestContent,
        $manifestVersionPattern,
        {
            param($match)

            return "`"version`": `"$newVersion`"$($match.Groups['comma'].Value)"
        },
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    if ($manifestVersionUpdated -eq $manifestContent) {
        throw "Could not update 'version' in manifest.json. The expected property was not found."
    }

    $manifestVersionNamePattern =
        '(?i)"version_name"\s*:\s*"[0-9.]+"(?<comma>\s*,)?'

    $manifestVersionNameUpdated = [regex]::Replace(
        $manifestVersionUpdated,
        $manifestVersionNamePattern,
        {
            param($match)

            return "`"version_name`": `"$newVersion`"$($match.Groups['comma'].Value)"
        },
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    if ($manifestVersionNameUpdated -eq $manifestVersionUpdated) {
        throw "Could not update 'version_name' in manifest.json. The expected property was not found."
    }

    Write-TextFile `
        -Path "manifest.json" `
        -Content $manifestVersionNameUpdated

    Write-Host "Updated manifest.json version fields." -ForegroundColor Green
}

# docs/index.html
if (Test-Path -LiteralPath "docs/index.html") {

    Replace-Required `
        -Path "docs/index.html" `
        -Pattern '(?i)<small>v[0-9.]+</small>' `
        -Replacement "<small>v$newVersion</small>" `
        -Description "documentation version" |
        Out-Null
}

# ------------------------------------------------------------
# 15. Cache-bust files changed since the publication boundary.
# ------------------------------------------------------------

Update-CacheBusting `
    -ChangedPaths $changedSinceVersion `
    -Version $newVersion

# ------------------------------------------------------------
# 16. Validate all generated version references BEFORE staging.
# ------------------------------------------------------------

Write-Host "`nValidating generated files..." -ForegroundColor Cyan

# VERSION
$writtenVersion = (
    Read-TextFile $versionFile
).Trim()

if ($writtenVersion -ne $newVersion) {
    throw "VERSION file does not contain the expected new version '$newVersion'."
}

Test-VersionReferences `
    -Version $newVersion

# ------------------------------------------------------------
# 17. Show generated changes.
# ------------------------------------------------------------

Write-Host "`nGenerated publication changes:" -ForegroundColor Cyan

git status --short

# ------------------------------------------------------------
# 18. Stage ONLY files intentionally modified by this script.
#
#     NEVER use:
#
#         git add -A
#
#     here.
#
#     This protects unrelated working-tree changes that may have
#     appeared during merge resolution or otherwise remained local.
# ------------------------------------------------------------

$versioningFiles = @(
    "VERSION"
)

if (Test-Path -LiteralPath "index.html") {
    $versioningFiles += "index.html"
}

if (Test-Path -LiteralPath "sw.js") {
    $versioningFiles += "sw.js"
}

if (Test-Path -LiteralPath "manifest.json") {
    $versioningFiles += "manifest.json"
}

if (Test-Path -LiteralPath "docs/index.html") {
    $versioningFiles += "docs/index.html"
}

# Add changed JS/CSS files only if they actually exist.
foreach ($path in (Get-CacheBustFiles -ChangedPaths $changedSinceVersion)) {

    if (Test-Path -LiteralPath $path) {
        $versioningFiles += $path
    }
}

$versioningFiles = @(
    $versioningFiles |
    Sort-Object -Unique
)

Write-Host "`nStaging only publication-generated files..." -ForegroundColor Cyan

foreach ($path in $versioningFiles) {

    Invoke-Git @(
        'add',
        '--',
        $path
    ) | Out-Null
}

# ------------------------------------------------------------
# 19. Verify the staged versioning diff.
# ------------------------------------------------------------

$versionDiffResult = Invoke-Git @(
    'diff',
    '--cached',
    '--name-status'
)

$stagedVersionFiles = @(
    $versionDiffResult.Output |
    ForEach-Object {
        $_.ToString().Trim()
    } |
    Where-Object {
        -not [string]::IsNullOrWhiteSpace($_)
    }
)

if ($stagedVersionFiles.Count -eq 0) {

    Write-Host "No versioning changes were staged. Nothing to commit." -ForegroundColor DarkGray

    exit 0
}

Write-Host "`nFiles staged for version commit:" -ForegroundColor Green

$stagedVersionFiles | ForEach-Object {
    Write-Host " - $_" -ForegroundColor Green
}

# ------------------------------------------------------------
# 20. Safety check:
#     Make sure unrelated files were NOT staged.
# ------------------------------------------------------------

$allowedStagedPaths = @(
    $versioningFiles |
    ForEach-Object {
        $_.Replace('\', '/')
    }
)

$stagedNameResult = Invoke-Git @(
    'diff',
    '--cached',
    '--name-only'
)

$unexpectedStagedFiles = @(
    $stagedNameResult.Output |
    ForEach-Object {
        $_.ToString().Trim().Replace('\', '/')
    } |
    Where-Object {
        -not [string]::IsNullOrWhiteSpace($_) -and
        $allowedStagedPaths -notcontains $_
    }
)

if ($unexpectedStagedFiles.Count -gt 0) {

    Write-Host "`nUnexpected files were staged:" -ForegroundColor Red

    $unexpectedStagedFiles | ForEach-Object {
        Write-Host " - $_" -ForegroundColor Red
    }

    throw "Refusing to create the version commit because unrelated files are staged."
}

# ------------------------------------------------------------
# 21. Commit VERSION + generated references + cache-busting.
# ------------------------------------------------------------

$versionCommitResult = Invoke-Git @(
    'commit',
    '-m',
    "chore: bump version to $newVersion"
) -AllowFailure

if ($versionCommitResult.ExitCode -ne 0) {

    $versionCommitResult.Output | ForEach-Object {
        Write-Host $_ -ForegroundColor Red
    }

    Write-Host "Version commit failed. Generated changes are still staged." -ForegroundColor Red

    exit $versionCommitResult.ExitCode
}

Write-Host "`nVersion bump committed successfully: v$newVersion" -ForegroundColor Green

# ------------------------------------------------------------
# 22. Final push prompt.
# ------------------------------------------------------------

[void](Ask-AndPush `
    -Message "Do you want to push to remote? [Y/n]")