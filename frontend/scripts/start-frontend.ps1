$ErrorActionPreference = 'Stop'

Set-Location (Join-Path $PSScriptRoot '..')

$pids = netstat -ano |
  Select-String ':5300' |
  ForEach-Object { ($_ -split '\s+')[-1] } |
  Where-Object { $_ -match '^\d+$' -and $_ -ne '0' } |
  Select-Object -Unique

foreach ($id in $pids) {
  Stop-Process -Id ([int]$id) -Force -ErrorAction SilentlyContinue
}

npm --prefix frontend run dev
