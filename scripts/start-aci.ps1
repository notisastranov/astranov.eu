# Always open the single ASTRANOV COLLECTIVE INTELLIGENCE Grok session (no resume picker)
$COLLECTIVE_ID = $env:ASTRANOV_COLLECTIVE_SESSION
if (-not $COLLECTIVE_ID) { $COLLECTIVE_ID = '019efdcc-ee91-7572-9b29-240c4edaa26c' }
$env:GROK_MEMORY = '1'
$WORKSPACE = $env:USERPROFILE
$REPO = Join-Path $WORKSPACE 'Documents\GitHub\Astranov'
if (Test-Path (Join-Path $REPO 'package.json')) {
  Set-Location $REPO
} else {
  Set-Location $WORKSPACE
}

function Get-EncodedCwd([string]$Path) {
  return [uri]::EscapeDataString((Resolve-Path $Path).Path)
}

$enc = Get-EncodedCwd $WORKSPACE
$sessionDir = Join-Path $env:USERPROFILE ".grok\sessions\$enc\$COLLECTIVE_ID"
if (-not (Test-Path $sessionDir)) {
  $zip = Join-Path $REPO '.collective-exports\aci-session-pack.zip'
  $sync = Join-Path $REPO 'scripts\sync-collective-session.ps1'
  if ((Test-Path $zip) -and (Test-Path $sync)) {
    Write-Host 'Installing collective session for this PC...' -ForegroundColor Yellow
    & $sync -Action install -ZipPath $zip
  } else {
    Write-Host "Session not on this PC (path not found)." -ForegroundColor Red
    Write-Host "On your main PC run: scripts\sync-collective-session.ps1 -Action pack"
    Write-Host "Copy aci-session-pack.zip here, then run aci again."
    exit 1
  }
}

Write-Host 'ASTRANOV COLLECTIVE INTELLIGENCE' -ForegroundColor Cyan
Write-Host "Session $COLLECTIVE_ID · $WORKSPACE" -ForegroundColor DarkGray
$grokb = (Get-Command grok-native -CommandType Application -ErrorAction SilentlyContinue).Source
if (-not $grokb) { $grokb = (Get-Command grok -CommandType Application -ErrorAction SilentlyContinue).Source }
if (-not $grokb) { Write-Error 'grok not found in PATH'; exit 1 }
& $grokb --cwd $WORKSPACE --resume $COLLECTIVE_ID @args