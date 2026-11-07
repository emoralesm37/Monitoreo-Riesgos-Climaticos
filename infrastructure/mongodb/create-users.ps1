# Run from PowerShell; no Bash/WSL required. Do not enable tracing/transcripts.
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$envFile = Join-Path $PSScriptRoot '.env'
$required = @(
    'MONGO_ROOT_USERNAME', 'MONGO_ROOT_PASSWORD',
    'MONGO_REPORT_USERNAME', 'MONGO_REPORT_PASSWORD',
    'MONGO_AUDIT_USERNAME', 'MONGO_AUDIT_PASSWORD'
)
$settings = @{}

if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    throw 'Falta infrastructure/mongodb/.env.'
}

# Parse data only: never source .env or evaluate its contents as PowerShell.
# Ignore unrelated variables (JWT, other services). Preserve literal $ characters.
foreach ($line in [System.IO.File]::ReadAllLines($envFile)) {
    if ($line -notmatch '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') { continue }
    $name = $Matches[1]
    $raw = $Matches[2].Trim()
    if ($name -notin $required) { continue }
    if ($settings.ContainsKey($name)) { throw "Variable duplicada en .env: $name." }

    if ($raw.StartsWith("'")) {
        if ($raw -notmatch "^'([^']*)'\s*(?:#.*)?$") {
            throw "Formato no admitido para $name; usa un valor de una sola linea."
        }
        $value = $Matches[1]
    } elseif ($raw.StartsWith('"')) {
        if ($raw -notmatch '^"((?:[^"\\]|\\.)*)"\s*(?:#.*)?$') {
            throw "Formato no admitido para $name; usa un valor de una sola linea."
        }
        # Decode only quote/backslash escapes; never expand variables or expressions.
        $value = $Matches[1].Replace('\"', '"').Replace('\\', '\')
    } else {
        $value = ($raw -replace '\s+#.*$', '').TrimEnd()
    }
    if ([string]::IsNullOrWhiteSpace($value) -or $value.StartsWith('REPLACE_WITH_')) {
        throw "Falta un valor local real para $name."
    }
    $settings[$name] = $value
}
foreach ($name in $required) {
    if (-not $settings.ContainsKey($name)) { throw "Falta la variable $name en .env." }
}

$docker = Get-Command docker.exe -CommandType Application -ErrorAction SilentlyContinue
if (-not $docker) { $docker = Get-Command docker -CommandType Application -ErrorAction Stop }

# Credentials travel only through redirected stdin, never command arguments,
# temporary files or process environment. Target is the existing local container.
$javascript = @'
try {
    const admin = db.getSiblingDB("admin");
    if (!admin.auth(config.MONGO_ROOT_USERNAME, config.MONGO_ROOT_PASSWORD)) {
        quit(1);
    }
    const targets = [
        ["ClimateGuardReports", config.MONGO_REPORT_USERNAME, config.MONGO_REPORT_PASSWORD, "REPORT"],
        ["ClimateGuardAudit", config.MONGO_AUDIT_USERNAME, config.MONGO_AUDIT_PASSWORD, "AUDIT"]
    ];
    for (const [database, username, password, label] of targets) {
        const target = db.getSiblingDB(database);
        if (target.getUser(username)) {
            print("CG_" + label + "_EXISTS");
        } else {
            target.createUser({user: username, pwd: password, roles: [{role: "readWrite", db: database}]});
            print("CG_" + label + "_CREATED");
        }
    }
} catch (_) {
    // Do not print MongoDB errors: they can contain sensitive command data.
    quit(1);
}
'@
$payload = 'const config = ' + (ConvertTo-Json -InputObject $settings -Compress) + ";`n" + $javascript
$process = New-Object System.Diagnostics.Process
$process.StartInfo.FileName = $docker.Source
$process.StartInfo.Arguments = 'exec -i climateguard-mongodb mongosh --quiet --norc --file /dev/stdin'
$process.StartInfo.UseShellExecute = $false
$process.StartInfo.CreateNoWindow = $true
$process.StartInfo.RedirectStandardInput = $true
$process.StartInfo.RedirectStandardOutput = $true
$process.StartInfo.RedirectStandardError = $true

try {
    if (-not $process.Start()) { throw 'No se pudo iniciar el cliente Docker.' }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $writer = New-Object System.IO.StreamWriter($process.StandardInput.BaseStream, (New-Object System.Text.UTF8Encoding($false)))
    try { $writer.WriteLine($payload) } finally { $writer.Dispose() }
    $process.WaitForExit()
    $output = $stdoutTask.GetAwaiter().GetResult()
    $null = $stderrTask.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0) {
        throw 'Inicializacion incompleta. Verifica Docker, el contenedor local y las credenciales existentes; no se imprimen detalles sensibles.'
    }
    foreach ($label in @('REPORT', 'AUDIT')) {
        if ($output -match "(?m)^CG_${label}_CREATED\r?$") {
            Write-Output "${label}: usuario creado."
        } elseif ($output -match "(?m)^CG_${label}_EXISTS\r?$") {
            Write-Output "${label}: usuario existente, sin cambios."
        } else {
            throw 'No se pudo confirmar el resultado completo. Revisar el entorno local antes de reintentar.'
        }
    }
} catch {
    # Avoid exposing native errors, stdin or credential data.
    throw 'No se pudo completar la inicializacion local. Revisa Docker, el contenedor y las credenciales de .env. Es seguro reintentar; los usuarios existentes se conservan.'
} finally {
    $process.Dispose()
    $settings.Clear()
    $payload = $null
    $output = $null
    $value = $null
    $raw = $null
}
