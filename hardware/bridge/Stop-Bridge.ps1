$ErrorActionPreference = 'Stop'
$stopFile = Join-Path $env:LOCALAPPDATA 'ClimateGuard-private\arduino-bridge.stop'
Set-Content -LiteralPath $stopFile -Value 'stop' -Encoding ascii
Write-Host 'Solicitada parada del puente; esperara a terminar la peticion actual y conservara pendientes.'
