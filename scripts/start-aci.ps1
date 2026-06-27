# Always open the single ASTRANOV COLLECTIVE INTELLIGENCE Grok session
$COLLECTIVE_ID = $env:ASTRANOV_COLLECTIVE_SESSION
if (-not $COLLECTIVE_ID) { $COLLECTIVE_ID = '019efdcc-ee91-7572-9b29-240c4edaa26c' }
$env:GROK_MEMORY = '1'
Set-Location 'C:\Users\Astranov'
Write-Host 'ASTRANOV COLLECTIVE INTELLIGENCE' -ForegroundColor Cyan
grok --resume $COLLECTIVE_ID @args