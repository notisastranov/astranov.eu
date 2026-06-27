# Always open the single ASTRANOV COLLECTIVE INTELLIGENCE Grok session (no resume picker)
$COLLECTIVE_ID = $env:ASTRANOV_COLLECTIVE_SESSION
if (-not $COLLECTIVE_ID) { $COLLECTIVE_ID = '019efdcc-ee91-7572-9b29-240c4edaa26c' }
$env:GROK_MEMORY = '1'
$WORKSPACE = $env:USERPROFILE
$ACI_HOME = Join-Path $WORKSPACE '.astranov'
$SYNC = Join-Path $PSScriptRoot 'sync-collective-session.ps1'

function Get-EncodedCwd([string]$Path) {
  $p = $Path
  if (Test-Path -LiteralPath $p) { $p = (Get-Item -LiteralPath $p).FullName }
  return [uri]::EscapeDataString($p)
}

function Find-Zip {
  $candidates = @(
    (Join-Path $ACI_HOME 'aci-session-pack.zip'),
    (Join-Path (Split-Path $PSScriptRoot -Parent) '.collective-exports\aci-session-pack.zip'),
    (Join-Path $WORKSPACE 'Documents\GitHub\Astranov\.collective-exports\aci-session-pack.zip'),
    (Join-Path $PSScriptRoot 'aci-session-pack.zip')
  )
  foreach ($z in $candidates) {
    if ($z -and (Test-Path -LiteralPath $z)) { return $z }
  }
  return $null
}

function Get-GrokExe {
  $fallback = Join-Path $WORKSPACE '.grok\bin\grok.exe'
  if (Test-Path -LiteralPath $fallback) { return $fallback }
  $cmd = Get-Command grok-native -CommandType Application -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command grok -CommandType Application -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

Set-Location -LiteralPath $WORKSPACE
$enc = Get-EncodedCwd $WORKSPACE
$sessionDir = Join-Path $WORKSPACE ".grok\sessions\$enc\$COLLECTIVE_ID"
$updates = Join-Path $sessionDir 'updates.jsonl'
$summary = Join-Path $sessionDir 'summary.json'

if (-not (Test-Path -LiteralPath $updates) -or -not (Test-Path -LiteralPath $summary)) {
  $zip = Find-Zip
  if ($zip -and (Test-Path -LiteralPath $SYNC)) {
    Write-Host 'Installing collective session for this PC...' -ForegroundColor Yellow
    & $SYNC -Action install -ZipPath $zip
  } elseif ($zip -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'install-aci-only.ps1'))) {
    & (Join-Path $PSScriptRoot 'install-aci-only.ps1') -ZipPath $zip
  } else {
    Write-Host 'OS ERROR 3: session files missing on this PC.' -ForegroundColor Red
    Write-Host "Expected: $sessionDir"
    Write-Host ''
    Write-Host 'Fix: copy aci-session-pack.zip, run install-aci-only.ps1'
    exit 1
  }
}

$grokb = Get-GrokExe
if (-not $grokb) { Write-Error 'grok not found - install Grok CLI first'; exit 1 }

Write-Host 'ASTRANOV COLLECTIVE INTELLIGENCE' -ForegroundColor Cyan
Write-Host "Session $COLLECTIVE_ID"
Write-Host "Workspace $WORKSPACE" -ForegroundColor DarkGray
& $grokb --resume $COLLECTIVE_ID @args