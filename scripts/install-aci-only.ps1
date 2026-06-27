# Minimal installer: only needs this script + aci-session-pack.zip in the same folder (or pass -ZipPath).
# Fixes OS ERROR 3 / FS_NOT_FOUND when the GitHub repo path does not exist on the other PC.
param([string]$ZipPath = '')

$ErrorActionPreference = 'Stop'
$COLLECTIVE_ID = '019efdcc-ee91-7572-9b29-240c4edaa26c'
$ACI_HOME = Join-Path $env:USERPROFILE '.astranov'
$GROK_HOME = Join-Path $env:USERPROFILE '.grok'
$WORKSPACE = $env:USERPROFILE

function Get-EncodedCwd([string]$Path) {
  $p = $Path
  if (Test-Path -LiteralPath $p) {
    $p = (Get-Item -LiteralPath $p).FullName
  }
  return [uri]::EscapeDataString($p)
}

if (-not $ZipPath) {
  $candidates = @(
    (Join-Path $PSScriptRoot 'aci-session-pack.zip'),
    (Join-Path $ACI_HOME 'aci-session-pack.zip'),
    (Join-Path $env:USERPROFILE 'Downloads\aci-session-pack.zip')
  )
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { $ZipPath = $c; break }
  }
}
if (-not $ZipPath -or -not (Test-Path -LiteralPath $ZipPath)) {
  Write-Host 'OS ERROR 3: aci-session-pack.zip not found.' -ForegroundColor Red
  Write-Host 'Put aci-session-pack.zip next to this script, or run:'
  Write-Host '  install-aci-only.ps1 -ZipPath "D:\path\to\aci-session-pack.zip"'
  exit 1
}

New-Item -ItemType Directory -Force -Path $ACI_HOME | Out-Null
$storeZip = Join-Path $ACI_HOME 'aci-session-pack.zip'
Copy-Item -LiteralPath $ZipPath -Destination $storeZip -Force

$enc = Get-EncodedCwd $WORKSPACE
$dest = Join-Path $GROK_HOME "sessions\$enc\$COLLECTIVE_ID"
New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null

$staging = Join-Path $env:TEMP "aci-install-$COLLECTIVE_ID"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
Expand-Archive -LiteralPath $storeZip -DestinationPath $staging -Force

$sessionSrc = Join-Path $staging 'session'
if (Test-Path $sessionSrc) {
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Copy-Item $sessionSrc $dest -Recurse
} else {
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Get-ChildItem $staging -File | Copy-Item -Destination $dest
}

foreach ($drop in @('rewind_points.jsonl', 'hunk_records.jsonl')) {
  $f = Join-Path $dest $drop
  if (Test-Path $f) { Remove-Item $f -Force }
}
$term = Join-Path $dest 'terminal'
if (Test-Path $term) { Remove-Item $term -Recurse -Force }

$summaryPath = Join-Path $dest 'summary.json'
if (Test-Path $summaryPath) {
  $raw = Get-Content $summaryPath -Raw -Encoding UTF8
  $cwd = $WORKSPACE.Replace('\', '\\')
  $grokHomeEsc = $GROK_HOME.Replace('\', '\\')
  $raw = $raw -replace '"cwd"\s*:\s*"[^"]*"', ('"cwd": "' + $cwd + '"')
  $raw = $raw -replace '"grok_home"\s*:\s*"[^"]*"', ('"grok_home": "' + $grokHomeEsc + '"')
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($summaryPath, $raw, $utf8)
}

Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue

[Environment]::SetEnvironmentVariable('GROK_MEMORY', '1', 'User')
[Environment]::SetEnvironmentVariable('ASTRANOV_COLLECTIVE_SESSION', $COLLECTIVE_ID, 'User')

$grokb = Join-Path $GROK_HOME 'bin\grok.exe'
if (-not (Test-Path $grokb)) {
  $cmd = Get-Command grok -CommandType Application -ErrorAction SilentlyContinue
  if ($cmd) { $grokb = $cmd.Source }
}
if (-not (Test-Path $grokb)) {
  Write-Host 'Session installed. Install Grok CLI, then run from home folder:' -ForegroundColor Yellow
  Write-Host "  grok --resume $COLLECTIVE_ID"
  exit 0
}

$marker = '# ASTRANOV COLLECTIVE GROK'
$profilePath = $PROFILE
$profileDir = Split-Path $profilePath -Parent
if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Force -Path $profileDir | Out-Null }
$block = @"
$marker
`$script:AstranovCollectiveSession = '$COLLECTIVE_ID'
function aci {
  Set-Location `$env:USERPROFILE
  & '$($grokb.Replace("'", "''"))' --resume `$script:AstranovCollectiveSession @args
}
"@
if (Test-Path $profilePath) {
  $existing = Get-Content $profilePath -Raw
  if ($existing -match [regex]::Escape($marker)) {
    $start = $existing.IndexOf($marker)
    $existing = $existing.Substring(0, $start) + $block.TrimEnd()
  } else {
    $existing = $existing.TrimEnd() + "`n`n" + $block
  }
  Set-Content $profilePath $existing.TrimEnd() -Encoding UTF8
} else {
  Set-Content $profilePath $block -Encoding UTF8
}

Write-Host 'ACI session installed.' -ForegroundColor Green
Write-Host "Path: $dest"
Write-Host 'Open a NEW PowerShell window, then run: aci' -ForegroundColor Cyan