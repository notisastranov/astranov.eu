# One-shot setup on a second PC. Fixes FS_NOT_FOUND / OS ERROR 3 from /resume.
param([string]$ZipPath = '')
$ErrorActionPreference = 'Stop'
$REPO = Split-Path $PSScriptRoot -Parent
$ACI_HOME = Join-Path $env:USERPROFILE '.astranov'
$zip = if ($ZipPath) { $ZipPath } else { Join-Path $REPO '.collective-exports\aci-session-pack.zip' }
if (-not (Test-Path -LiteralPath $zip)) { $zip = Join-Path $ACI_HOME 'aci-session-pack.zip' }
$installer = Join-Path $PSScriptRoot 'install-aci-only.ps1'
$sync = Join-Path $PSScriptRoot 'sync-collective-session.ps1'
$unify = Join-Path $PSScriptRoot 'unify-collective.ps1'

Write-Host '=== ASTRANOV OTHER-PC BOOTSTRAP ===' -ForegroundColor Cyan
Write-Host "User: $env:USERNAME"
Write-Host "Home: $env:USERPROFILE"
Write-Host ""

if (-not (Test-Path -LiteralPath $zip)) {
  Write-Host 'OS ERROR 3: aci-session-pack.zip not found.' -ForegroundColor Red
  Write-Host "Tried: $zip"
  Write-Host ''
  Write-Host 'Easiest fix - copy TWO files to a USB folder:' -ForegroundColor Yellow
  Write-Host '  aci-session-pack.zip'
  Write-Host '  install-aci-only.ps1'
  Write-Host 'On other PC run:'
  Write-Host '  powershell -ExecutionPolicy Bypass -File install-aci-only.ps1'
  exit 1
}

if (Test-Path -LiteralPath $installer) {
  & $installer -ZipPath $zip
} else {
  & $sync -Action install -ZipPath $zip
}
if (Test-Path -LiteralPath $unify) { & $unify }
if (Test-Path -LiteralPath $sync) { & $sync -Action status }

Write-Host ""
Write-Host "Do NOT use /resume (causes FS_NOT_FOUND on cloud entries)." -ForegroundColor Yellow
Write-Host "Open a NEW PowerShell window, then run:" -ForegroundColor Green
Write-Host "  aci"