$ErrorActionPreference = 'Stop'
$privateFolder = Join-Path $env:LOCALAPPDATA 'ClimateGuard-private'
$configFile = Join-Path $privateFolder 'arduino-bridge.json'
$stopFile = Join-Path $privateFolder 'arduino-bridge.stop'
if (-not (Test-Path -LiteralPath $configFile)) { throw 'Falta la configuracion privada del puente.' }
if (Test-Path -LiteralPath $stopFile) { Remove-Item -LiteralPath $stopFile }
Write-Host 'Puente USB -> ClimateGuard. Cierra Monitor Serie. Ctrl+C para detener.'
py (Join-Path $PSScriptRoot 'bridge.py') --config $configFile
exit $LASTEXITCODE
