<#
.SYNOPSIS
  Backup DB prod (MySQL in Docker, via SSH) -> restore in locale. Gemello Windows di restore-prod-to-local.sh.

.DESCRIPTION
  Config tramite .env nella stessa cartella. Vedi .env.example.
  Il dump viene compresso con gzip SUL SERVER remoto (Windows non ha gzip nativo),
  quindi scaricato come .sql.gz e decompresso in locale via .NET durante il restore.

  Autenticazione SSH:
    - SSH_KEY impostata  -> ssh con chiave
    - SSH_PASSWORD + plink.exe (PuTTY) nel PATH -> plink non interattivo
    - altrimenti         -> ssh chiede la password al prompt (una sola connessione)

.EXAMPLE
  .\restore-prod-to-local.ps1            # dump + restore
.EXAMPLE
  .\restore-prod-to-local.ps1 -Dump      # solo dump (scarica .sql.gz, no restore)
.EXAMPLE
  .\restore-prod-to-local.ps1 -NoDrop    # restore senza DROP/CREATE DB

.NOTES
  Se bloccato dalla execution policy:
  powershell -ExecutionPolicy Bypass -File .\restore-prod-to-local.ps1
#>
[CmdletBinding()]
param(
    [switch]$Dump,     # solo dump, niente restore (equivale a --dump)
    [switch]$NoDrop    # restore senza DROP/CREATE DB (equivale a --no-drop)
)

$ErrorActionPreference = 'Stop'

# --- Path ---
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile   = Join-Path $ScriptDir '.env'
$DumpDir   = Join-Path $ScriptDir 'dumps'

# --- Log ---
function Info([string]$msg) { Write-Host '[INFO] ' -ForegroundColor Green  -NoNewline; Write-Host $msg }
function Warn([string]$msg) { Write-Host '[WARN] ' -ForegroundColor Yellow -NoNewline; Write-Host $msg }
function Err ([string]$msg) { Write-Host '[ERR ] ' -ForegroundColor Red    -NoNewline; Write-Host $msg }
function Die ([string]$msg) { Err $msg; exit 1 }

# --- Carica .env ---
if (-not (Test-Path $EnvFile)) { Die '.env mancante. Copia .env.example -> .env e compila.' }
$cfg = @{}
foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^\s*(#|$)') { continue }
    if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $val = $Matches[2].Trim()
        if ($val -match '^"(.*)"$' -or $val -match "^'(.*)'$") { $val = $Matches[1] }
        $cfg[$Matches[1]] = $val
    }
}
function Get-Cfg([string]$name, [string]$default = '') {
    if ($cfg.ContainsKey($name) -and $cfg[$name] -ne '') { $cfg[$name] } else { $default }
}
function Require-Cfg([string]$name) {
    $v = Get-Cfg $name
    if (-not $v) { Die "$name mancante in .env" }
    $v
}

# --- Defaults ---
$SshPort   = Get-Cfg 'SSH_PORT' '22'
$LocalMode = Get-Cfg 'LOCAL_MODE' 'native'

# --- Validazione minima ---
$SshHost         = Require-Cfg 'SSH_HOST'
$SshUser         = Require-Cfg 'SSH_USER'
$RemoteContainer = Require-Cfg 'REMOTE_MYSQL_CONTAINER'
$ProdDbName      = Require-Cfg 'PROD_DB_NAME'
$ProdDbUser      = Require-Cfg 'PROD_DB_USER'
$ProdDbPassword  = Require-Cfg 'PROD_DB_PASSWORD'
$SshKey          = Get-Cfg 'SSH_KEY'
$SshPassword     = Get-Cfg 'SSH_PASSWORD'
$SshTarget       = "$SshUser@$SshHost"

# Escaping argomenti per ProcessStartInfo.Arguments (regole di quoting Windows)
function Esc-Arg([string]$s) {
    $s = $s -replace '(\\*)"', '$1$1\"'
    $s = $s -replace '(\\+)$', '$1$1'
    '"' + $s + '"'
}

# --- Build comando SSH ---
# Con SSH_PASSWORD (senza chiave) si usa plink (PuTTY) come sshpass;
# se plink non c'e', ssh chiedera' la password al prompt.
$SshExe  = 'ssh'
$SshArgs = @()
if ($SshKey) {
    $SshArgs = @('-p', $SshPort, '-o', 'ConnectTimeout=15', '-i', $SshKey, $SshTarget)
} elseif ($SshPassword -and (Get-Command 'plink' -ErrorAction SilentlyContinue)) {
    $SshExe  = 'plink'
    $SshArgs = @('-ssh', '-batch', '-P', $SshPort, '-pw', $SshPassword, $SshTarget)
} else {
    if ($SshPassword) { Warn 'SSH_PASSWORD impostata ma plink.exe non trovato: ssh chiedera'' la password al prompt.' }
    $SshArgs = @('-p', $SshPort, '-o', 'ConnectTimeout=15', '-o', 'PubkeyAuthentication=no', $SshTarget)
}

if (-not (Test-Path $DumpDir)) { New-Item -ItemType Directory -Path $DumpDir | Out-Null }
$Stamp    = Get-Date -Format 'yyyyMMdd_HHmmss'
$DumpFile = Join-Path $DumpDir "${ProdDbName}_prod_${Stamp}.sql.gz"

# ============================================================
# 1. DUMP da prod (mysqldump dentro container, via SSH)
# ============================================================
Info "Dump da prod $SshTarget (container $RemoteContainer)..."

# Password passata al container via env MYSQL_PWD (non in process list).
# gzip eseguito sul server remoto: sul filo viaggia gia' compresso.
$RemoteCmd = "docker exec -e MYSQL_PWD='$ProdDbPassword' '$RemoteContainer' " +
             "mysqldump -u'$ProdDbUser' " +
             "--single-transaction --routines --triggers --events " +
             "--no-tablespaces '$ProdDbName' | gzip -c"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName               = $SshExe
$psi.Arguments              = (($SshArgs | ForEach-Object { Esc-Arg $_ }) + (Esc-Arg $RemoteCmd)) -join ' '
$psi.UseShellExecute        = $false
$psi.RedirectStandardOutput = $true   # stream binario, la pipeline PowerShell lo corromperebbe

$proc = [System.Diagnostics.Process]::Start($psi)
$out  = [System.IO.File]::Create($DumpFile)
try {
    $proc.StandardOutput.BaseStream.CopyTo($out)
} finally {
    $out.Close()
}
$proc.WaitForExit()
if ($proc.ExitCode -ne 0) { Die "Dump fallito (exit $($proc.ExitCode))." }

if (-not (Test-Path $DumpFile) -or (Get-Item $DumpFile).Length -eq 0) {
    Die "Dump vuoto o fallito: $DumpFile"
}
$DumpSize = '{0:N1} MB' -f ((Get-Item $DumpFile).Length / 1MB)
Info "Dump OK: $DumpFile ($DumpSize)"

if ($Dump) {
    Info 'Solo dump richiesto. Fine.'
    exit 0
}

# ============================================================
# 2. RESTORE in locale
# ============================================================
$LocalDbName = Get-Cfg 'LOCAL_DB_NAME' $ProdDbName
$DropSql = "DROP DATABASE IF EXISTS ``$LocalDbName``; CREATE DATABASE ``$LocalDbName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Import: decomprime il .sql.gz con GZipStream e lo scrive sullo stdin di mysql
function Import-Dump([string]$exe, [string[]]$importArgs, [hashtable]$envVars) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName              = $exe
    $psi.Arguments             = ($importArgs | ForEach-Object { Esc-Arg $_ }) -join ' '
    $psi.UseShellExecute       = $false
    $psi.RedirectStandardInput = $true
    foreach ($k in $envVars.Keys) { $psi.EnvironmentVariables[$k] = $envVars[$k] }

    $p  = [System.Diagnostics.Process]::Start($psi)
    $fs = [System.IO.File]::OpenRead($DumpFile)
    $gz = New-Object System.IO.Compression.GZipStream($fs, [System.IO.Compression.CompressionMode]::Decompress)
    try {
        $gz.CopyTo($p.StandardInput.BaseStream)
        $p.StandardInput.BaseStream.Flush()
    } finally {
        $gz.Close(); $fs.Close(); $p.StandardInput.Close()
    }
    $p.WaitForExit()
    if ($p.ExitCode -ne 0) { Die "Import fallito (exit $($p.ExitCode))." }
}

if ($LocalMode -eq 'native') {
    $LocalDbUser     = Require-Cfg 'LOCAL_DB_USER'
    $LocalDbPassword = Require-Cfg 'LOCAL_DB_PASSWORD'
    $LHost = Get-Cfg 'LOCAL_DB_HOST' 'localhost'
    $LPort = Get-Cfg 'LOCAL_DB_PORT' '3306'

    # mysql.exe: dal PATH, altrimenti dalle cartelle di installazione standard
    $MysqlExe = (Get-Command 'mysql' -ErrorAction SilentlyContinue).Source
    if (-not $MysqlExe) {
        $MysqlExe = Get-ChildItem 'C:\Program Files\MySQL\MySQL Server *\bin\mysql.exe' -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
    }
    if (-not $MysqlExe) {
        Die 'mysql.exe non trovato (ne'' nel PATH ne'' in C:\Program Files\MySQL). Installa MySQL o aggiungi la cartella bin al PATH.'
    }

    Warn "Restore su LOCALE nativo: ${LHost}:${LPort} db '$LocalDbName'"
    if (-not $NoDrop) {
        Warn "DROP + CREATE database '$LocalDbName' (dati locali esistenti PERSI)."
        $env:MYSQL_PWD = $LocalDbPassword
        try {
            & $MysqlExe -h $LHost -P $LPort -u $LocalDbUser -e $DropSql
            if ($LASTEXITCODE -ne 0) { Die "DROP/CREATE fallito (exit $LASTEXITCODE)." }
        } finally {
            Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
        }
    }
    Info 'Import in corso...'
    Import-Dump $MysqlExe @('-h', $LHost, '-P', $LPort, '-u', $LocalDbUser, $LocalDbName) @{ MYSQL_PWD = $LocalDbPassword }

} elseif ($LocalMode -eq 'docker') {
    $LocalContainer  = Require-Cfg 'LOCAL_MYSQL_CONTAINER'
    $LocalDockerPwd  = Require-Cfg 'LOCAL_DOCKER_DB_PASSWORD'
    $LocalDbUser     = Get-Cfg 'LOCAL_DB_USER' 'root'

    # Verifica container attivo
    $running = @(& docker ps --format '{{.Names}}')
    if ($LASTEXITCODE -ne 0) { Die 'docker non raggiungibile. Docker Desktop e'' avviato?' }
    if ($running -notcontains $LocalContainer) {
        Die "Container locale '$LocalContainer' non attivo. Avvia: docker compose up -d mysql"
    }

    Warn "Restore su LOCALE Docker: container '$LocalContainer' db '$LocalDbName'"
    if (-not $NoDrop) {
        Warn "DROP + CREATE database '$LocalDbName' (dati locali esistenti PERSI)."
        & docker exec -e "MYSQL_PWD=$LocalDockerPwd" $LocalContainer mysql "-u$LocalDbUser" -e $DropSql
        if ($LASTEXITCODE -ne 0) { Die "DROP/CREATE fallito (exit $LASTEXITCODE)." }
    }
    Info 'Import in corso...'
    Import-Dump 'docker' @('exec', '-i', '-e', "MYSQL_PWD=$LocalDockerPwd", $LocalContainer, 'mysql', "-u$LocalDbUser", $LocalDbName) @{}

} else {
    Die "LOCAL_MODE non valido: '$LocalMode' (usa native | docker)"
}

Info 'Restore COMPLETATO. DB locale allineato a prod.'
Info 'Avvia backend per applicare eventuali migrazioni: cd backend && dotnet run'
