# Deny shell commands that start a new Grok session outside ASTRANOV COLLECTIVE INTELLIGENCE
$ErrorActionPreference = 'Stop'
$collective = $env:ASTRANOV_COLLECTIVE_SESSION
if (-not $collective) { $collective = '019efdcc-ee91-7572-9b29-240c4edaa26c' }

$raw = [Console]::In.ReadToEnd()
if (-not $raw) {
  Write-Output '{"decision":"allow"}'
  exit 0
}

$input = $raw | ConvertFrom-Json
$cmd = [string]($input.toolInput.command)
if (-not $cmd) {
  Write-Output '{"decision":"allow"}'
  exit 0
}

$maintenance = '(?i)\bgrok\s+(sessions|export|import|login|logout|mcp|memory|models|plugin|setup|trace|update|version|help|completions|inspect|leader|worktree)\b'
if ($cmd -match $maintenance) {
  Write-Output '{"decision":"allow"}'
  exit 0
}

if ($cmd -notmatch '(?i)\bgrok\b') {
  Write-Output '{"decision":"allow"}'
  exit 0
}

if ($cmd -match [regex]::Escape($collective)) {
  Write-Output '{"decision":"allow"}'
  exit 0
}

$deny = @(
  '(?i)\bgrok\s*$',
  '(?i)\bgrok\s+--continue\b',
  '(?i)\bgrok\s+-c\b',
  '(?i)\bgrok\s+--session-id\b',
  '(?i)\bgrok\s+-s\b',
  '(?i)\bgrok\s+--resume\b(?!\s+[0-9a-f-]{36})',
  '(?i)\bgrok\s+-r\b(?!\s+[0-9a-f-]{36})',
  '(?i)\bgrok\s+--resume\s+(?!' + [regex]::Escape($collective) + ')',
  '(?i)\bgrok\s+-r\s+(?!' + [regex]::Escape($collective) + ')',
  '(?i)\bgrok\s+agent\b',
  '(?i)\bgrok\s+dashboard\b',
  '(?i)\bgrok\s+--worktree\b',
  '(?i)\bgrok\s+-w\b'
)

foreach ($pat in $deny) {
  if ($cmd -match $pat) {
    $reason = "Blocked new Grok session. Use: aci  or  grok --resume $collective"
    Write-Output (@{ decision = 'deny'; reason = $reason } | ConvertTo-Json -Compress)
    exit 2
  }
}

# Bare grok or grok with prompt but no --resume collective id
if ($cmd -match '(?i)\bgrok\b' -and $cmd -notmatch '(?i)--resume\s+' + [regex]::Escape($collective)) {
  $reason = "Blocked Grok without collective session. Use: grok --resume $collective"
  Write-Output (@{ decision = 'deny'; reason = $reason } | ConvertTo-Json -Compress)
  exit 2
}

Write-Output '{"decision":"allow"}'
exit 0