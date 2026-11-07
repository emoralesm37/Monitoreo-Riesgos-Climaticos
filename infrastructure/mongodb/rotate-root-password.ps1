# LOCAL ONLY. Run interactively, without tracing, debugging or transcription.
# Does not restart/recreate containers. Read ROTATE-ROOT.md before execution.
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot '.env'
$original = [IO.File]::ReadAllText($envFile)
$pattern = '(?m)^[ \t]*MONGO_ROOT_PASSWORD[ \t]*=[^\r\n]*'
if ([regex]::Matches($original, $pattern).Count -ne 1) {
    throw 'Debe existir exactamente una asignacion MONGO_ROOT_PASSWORD en .env.'
}
$userPattern = @'
(?m)^[ \t]*MONGO_ROOT_USERNAME[ \t]*=[ \t]*['"]?climateguard_local_root['"]?[ \t]*\r?$
'@
if ([regex]::Matches($original, $userPattern).Count -ne 1) {
    throw 'El usuario local de .env debe ser climateguard_local_root.'
}
$docker = (Get-Command docker.exe -CommandType Application -ErrorAction Stop).Source

function Invoke-LocalMongo([string]$Mode, [string]$Password) {
    # Current credentials stay inside the container. Only the new password is
    # transferred via stdin, not argv/environment/temp files.
    $body = @'
try {
    const user = process.env.MONGO_INITDB_ROOT_USERNAME;
    const old = process.env.MONGO_INITDB_ROOT_PASSWORD;
    if (user !== "climateguard_local_root" || !old) quit(1);
    const admin = db.getSiblingDB("admin");
    if (input.mode === "verify") {
        if (!admin.auth(user, input.password)) quit(1);
    } else if (input.mode === "rollback") {
        if (!admin.auth(user, input.password)) quit(1);
        admin.changeUserPassword(user, old);
        const fresh = new Mongo("mongodb://127.0.0.1:27017").getDB("admin");
        if (!fresh.auth(user, old)) quit(1);
    } else {
        if (!admin.auth(user, old)) quit(1);
        const state = admin.runCommand({connectionStatus: 1});
        if (!state.authInfo.authenticatedUserRoles.some(r => r.role === "root" && r.db === "admin")) quit(1);
        if (input.mode === "rotate") {
            if (input.password === old) quit(1);
            admin.changeUserPassword(user, input.password);
            try {
                const fresh = new Mongo("mongodb://127.0.0.1:27017").getDB("admin");
                if (!fresh.auth(user, input.password)) throw new Error();
            } catch (_) {
                admin.changeUserPassword(user, old);
                quit(1);
            }
        } else if (input.mode !== "preflight") quit(1);
    }
    print("CG_ROOT_OK");
} catch (_) { quit(1); }
'@
    $payload = 'const input = ' + (@{ mode = $Mode; password = $Password } | ConvertTo-Json -Compress) + ";`n" + $body
    $proc = New-Object Diagnostics.Process
    $proc.StartInfo.FileName = $docker
    $proc.StartInfo.Arguments = 'exec -i climateguard-mongodb mongosh --quiet --norc --file /dev/stdin'
    $proc.StartInfo.UseShellExecute = $false
    $proc.StartInfo.CreateNoWindow = $true
    $proc.StartInfo.RedirectStandardInput = $true
    $proc.StartInfo.RedirectStandardOutput = $true
    $proc.StartInfo.RedirectStandardError = $true
    try {
        if (-not $proc.Start()) { throw 'No se pudo iniciar Docker.' }
        $outTask = $proc.StandardOutput.ReadToEndAsync()
        $errTask = $proc.StandardError.ReadToEndAsync()
        $writer = New-Object IO.StreamWriter($proc.StandardInput.BaseStream, (New-Object Text.UTF8Encoding($false)))
        try { $writer.WriteLine($payload) } finally { $writer.Dispose() }
        $proc.WaitForExit()
        $result = $outTask.GetAwaiter().GetResult()
        $null = $errTask.GetAwaiter().GetResult()
        if ($proc.ExitCode -ne 0 -or $result -notmatch '(?m)^CG_ROOT_OK\r?$') {
            throw 'Operacion MongoDB no confirmada; detalles sensibles omitidos.'
        }
    } finally {
        $proc.Dispose()
        $payload = $Password = $result = $null
    }
}

function Convert-SecretToText([Security.SecureString]$Secret) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$first = $second = $null
$newPassword = $confirmation = $updated = $null
$rotationAttempted = $false
$committed = $false
try {
    Invoke-LocalMongo 'preflight' ''
    Write-Warning 'Tras la rotacion, el healthcheck usara la clave antigua hasta una recreacion posterior autorizada con el mismo volumen.'
    $first = Read-Host 'Nueva clave root local (minimo 24 caracteres; guardala en tu gestor)' -AsSecureString
    $second = Read-Host 'Confirma la nueva clave' -AsSecureString
    $newPassword = Convert-SecretToText $first
    $confirmation = Convert-SecretToText $second
    if ($newPassword -cne $confirmation) { throw 'Las claves no coinciden.' }
    # Single-quoted dotenv form is compatible with Compose and create-users.ps1.
    if ($newPassword.Length -lt 24 -or $newPassword -match "['`r`n]" -or
        $newPassword -match '^REPLACE_WITH_' -or
        $newPassword -cnotmatch '[a-z]' -or $newPassword -cnotmatch '[A-Z]' -or
        $newPassword -notmatch '[0-9]' -or $newPassword -notmatch '[^a-zA-Z0-9]') {
        throw 'Usa una clave aleatoria de al menos 24 caracteres, con mayusculas, minusculas, numeros y simbolos; sin comilla simple ni saltos de linea.'
    }
    if ([IO.File]::ReadAllText($envFile) -cne $original) {
        throw '.env cambio durante la preparacion; no se inicio la rotacion.'
    }
    # Establish write access before changing MongoDB. No data is written here.
    $handle = [IO.File]::Open($envFile, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::Read)
    $handle.Dispose()
    $replacement = "MONGO_ROOT_PASSWORD='$newPassword'"
    $updated = [regex]::Replace($original, $pattern, [Text.RegularExpressions.MatchEvaluator]{ param($match) $replacement })
    $rotationAttempted = $true
    Invoke-LocalMongo 'rotate' $newPassword
    Invoke-LocalMongo 'verify' $newPassword
    if ([IO.File]::ReadAllText($envFile) -cne $original) {
        throw '.env cambio durante la rotacion; se intentara revertir MongoDB.'
    }
    try {
        [IO.File]::WriteAllText($envFile, $updated, (New-Object Text.UTF8Encoding($false)))
        if ([IO.File]::ReadAllText($envFile) -cne $updated) { throw 'Escritura no confirmada.' }
    } catch {
        # Restore the prior file if an incomplete write occurred.
        [IO.File]::WriteAllText($envFile, $original, (New-Object Text.UTF8Encoding($false)))
        throw 'No se pudo actualizar .env.'
    }
    $committed = $true
    Write-Output 'Nueva clave verificada; .env actualizado. No se recreo el contenedor ni se modificaron usuarios de servicios.'
    Write-Warning 'El entorno del contenedor conserva la clave anterior. No ejecutar Compose up hasta revisar ROTATE-ROOT.md.'
} catch {
    if ($rotationAttempted -and -not $committed) {
        try {
            Invoke-LocalMongo 'rollback' $newPassword
            Write-Warning 'MongoDB restaurado a la credencial anterior.'
        } catch {
            # A failed rotate may already have restored the old password.
            try {
                Invoke-LocalMongo 'preflight' ''
                Write-Warning 'La credencial anterior sigue funcionando.'
            } catch {
                Write-Warning 'Estado de credenciales no confirmado. Conserva ambas claves en tu gestor; no reinicies ni recrees MongoDB. Requiere recuperacion manual.'
            }
        }
    }
    throw 'Procedimiento detenido. No se imprimen credenciales. Revisa los avisos anteriores antes de cualquier otra operacion.'
} finally {
    if ($first) { $first.Dispose() }
    if ($second) { $second.Dispose() }
    $newPassword = $confirmation = $original = $updated = $replacement = $null
}
