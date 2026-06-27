# Unify Grok + Astranov under one user (ASTRANOV) and one session (ASTRANOV COLLECTIVE INTELLIGENCE)
$ErrorActionPreference = 'Stop'

$COLLECTIVE_ID = '019efdcc-ee91-7572-9b29-240c4edaa26c'
$COLLECTIVE_NAME = 'ASTRANOV COLLECTIVE INTELLIGENCE'
$WORKSPACE = 'C:\Users\Astranov'
$GROK_HOME = Join-Path $env:USERPROFILE '.grok'
$REPO = Split-Path $PSScriptRoot -Parent
$EXPORTS = Join-Path $REPO '.collective-exports'

Write-Host "=== ASTRANOV COLLECTIVE UNIFY ===" -ForegroundColor Cyan
Write-Host "User: ASTRANOV"
Write-Host "Session: $COLLECTIVE_NAME"
Write-Host "Session ID: $COLLECTIVE_ID"
Write-Host ""

if ($env:USERNAME -ne 'Astranov') {
  Write-Warning "Logged in as Windows user '$($env:USERNAME)' - use Astranov account on every device."
  Write-Host "On Users-N: export sessions then copy .collective-exports to this repo, or run Grok only as Astranov."
}

[Environment]::SetEnvironmentVariable('GROK_MEMORY', '1', 'User')
[Environment]::SetEnvironmentVariable('ASTRANOV_COLLECTIVE_SESSION', $COLLECTIVE_ID, 'User')
[Environment]::SetEnvironmentVariable('ASTRANOV_COLLECTIVE_USER', 'ASTRANOV', 'User')

$summaryPath = Join-Path $GROK_HOME "sessions\C%3A%5CUsers%5CAstranov\$COLLECTIVE_ID\summary.json"
if (Test-Path $summaryPath) {
  $raw = Get-Content $summaryPath -Raw
  $raw = $raw -replace '"session_summary"\s*:\s*"[^"]*"', ('"session_summary": "' + $COLLECTIVE_NAME + '"')
  $raw = $raw -replace '"generated_title"\s*:\s*"[^"]*"', ('"generated_title": "' + $COLLECTIVE_NAME + '"')
  Set-Content $summaryPath $raw -Encoding UTF8 -NoNewline
  Write-Host "Canonical session title set." -ForegroundColor Green
}

$toDelete = @(
  '019ef933-8f60-7573-843b-12ef3f4f1f7c',
  '019eda39-ef3e-7e00-9eb2-62343c966b13',
  '019eb26b-c8fc-7723-8810-948981bb0676',
  '019e739e-cf5c-7d11-8c5e-f036fec61b9c'
)

Set-Location $WORKSPACE
New-Item -ItemType Directory -Force -Path $EXPORTS | Out-Null

foreach ($id in $toDelete) {
  $safe = $id.Split('-')[0]
  $out = Join-Path $EXPORTS "archive-$safe.md"
  if (-not (Test-Path $out)) {
    try { grok export $id $out 2>$null } catch { }
  }
  try {
    grok sessions delete $id 2>$null
    Write-Host "Removed duplicate session $safe" -ForegroundColor Yellow
  } catch {
    Write-Host "Skip delete $safe (already gone or remote)" -ForegroundColor DarkGray
  }
}

Write-Host ""
Write-Host "Remaining sessions:" -ForegroundColor Cyan
grok sessions list

Write-Host ""
Write-Host "Start collective (this session only):" -ForegroundColor Green
Write-Host "  grok --resume $COLLECTIVE_ID"
Write-Host ('Or run: ' + (Join-Path $REPO 'scripts\start-aci.ps1'))