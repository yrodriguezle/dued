<#
.SYNOPSIS
  Backup DB prod (MySQL in Docker, via SSH) -> restore in locale. Gemello Windows di restore-prod-to-local.sh.

.DESCRIPTION
  Config tramite .env nella stessa cartella. Vedi .env.example.
  Il dump viene compresso con gzip SUL SERVER remoto (Windows non ha gzip nativo),
  quindi scaricato come .sql.gz e decompresso in locale via .NET durante il restore.

  Autenticazione SSH:
    - SSH_KEY + SSH_PASSPHRASE -> chiave protetta, sbloccata via SSH_ASKPASS (non interattivo)
    - SSH_KEY senza passphrase -> ssh con chiave
    - SSH_PASSWORD + plink.exe (PuTTY) nel PATH -> plink non interattivo
    - altrimenti         -> ssh chiede la password al prompt (una sola connessione)

  Quando si usa una chiave, il fallback a password/keyboard-interactive e' DISATTIVATO
  di proposito: senza, una chiave che non si sblocca fa provare a ssh la password,
  e i tentativi falliti fanno bannare l'IP da fail2ban sul server.

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
function Die ([string]$msg) {
    Err $msg
    # Non lasciare in giro agent aperti e chiavi sbloccate se si esce a meta'.
    if (Get-Command 'Stop-SshAgent' -ErrorAction SilentlyContinue) { Stop-SshAgent }
    exit 1
}

# --- Carica .env ---
if (-not (Test-Path $EnvFile)) { Die '.env mancante. Copia .env.example -> .env e compila.' }
$cfg = @{}
foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^\s*(#|$)') { continue }
    if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        # Il nome va salvato SUBITO: lo -match che toglie gli apici qui sotto
        # sovrascrive $Matches, e la chiave andrebbe persa.
        $key = $Matches[1]
        $val = $Matches[2].Trim()
        if ($val -match '^"(.*)"$' -or $val -match "^'(.*)'$") { $val = $Matches[1] }
        $cfg[$key] = $val
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
$SshPassphrase   = Get-Cfg 'SSH_PASSPHRASE'
$SshPassword     = Get-Cfg 'SSH_PASSWORD'
$SshTarget       = "$SshUser@$SshHost"

# Escaping argomenti per ProcessStartInfo.Arguments (regole di quoting Windows)
function Esc-Arg([string]$s) {
    $s = $s -replace '(\\*)"', '$1$1\"'
    $s = $s -replace '(\\+)$', '$1$1'
    '"' + $s + '"'
}

# --- Askpass: sblocca una chiave con passphrase senza prompt ---
# Lo script temporaneo NON contiene il segreto: legge SSH_PASSPHRASE dall'ambiente
# del processo ssh, che non e' visibile agli altri utenti della macchina.
# Perche' l'agent e non SSH_ASKPASS passato direttamente a ssh: ssh offre la chiave,
# il server la accetta, ma poi non decifra la chiave privata e chiude con
# "No more authentication methods to try" senza alcun messaggio. ssh-add invece
# l'askpass lo usa, e ssh trova la chiave gia' sbloccata nell'agent.
# ssh-agent/ssh-add vanno presi dalla STESSA cartella di ssh: l'agent di Windows e
# quello di Git usano socket incompatibili, mescolarli non funziona.
$AskPassFile = $null
$AgentStarted = $false
if ($SshKey -and $SshPassphrase) {
    $SshBin      = Split-Path (Get-Command 'ssh').Source
    $SshAgentExe = Join-Path $SshBin 'ssh-agent.exe'
    $SshAddExe   = Join-Path $SshBin 'ssh-add.exe'
    if (-not (Test-Path $SshAgentExe) -or -not (Test-Path $SshAddExe)) {
        Die "ssh-agent/ssh-add non trovati in $SshBin (servono per una chiave con passphrase)."
    }

    $AskPassFile = Join-Path ([System.IO.Path]::GetTempPath()) ("dued-askpass-{0}.sh" -f [Guid]::NewGuid().ToString('N'))
    # A capo LF obbligatori: con CRLF lo shebang diventa "bad interpreter".
    $askBody = "#!/bin/sh`nprintf '%s\n' `"`$SSH_PASSPHRASE`"`n"
    [System.IO.File]::WriteAllText($AskPassFile, $askBody, (New-Object System.Text.UTF8Encoding($false)))

    # ssh-agent -s stampa righe stile shell: "SSH_AUTH_SOCK=/tmp/...; export SSH_AUTH_SOCK;"
    # L'output va preso da un FILE, e si aspetta solo il processo padre: ssh-agent
    # lascia un demone che eredita stdout e non lo chiude mai, quindi "& ssh-agent -s"
    # (come Start-Process -Wait, che aspetta anche i discendenti) resterebbe appeso
    # per sempre. Start-Process -PassThru + WaitForExit aspetta solo il padre.
    $AgentOutFile = Join-Path ([System.IO.Path]::GetTempPath()) ("dued-agent-{0}.txt" -f [Guid]::NewGuid().ToString('N'))
    $agentProc = Start-Process -FilePath $SshAgentExe -ArgumentList '-s' -NoNewWindow -PassThru -RedirectStandardOutput $AgentOutFile
    $agentProc.WaitForExit()
    $agentLines = @(Get-Content $AgentOutFile -ErrorAction SilentlyContinue)
    Remove-Item $AgentOutFile -Force -ErrorAction SilentlyContinue
    foreach ($l in $agentLines) {
        if ($l -match '^(SSH_AUTH_SOCK|SSH_AGENT_PID)=([^;]+);') {
            Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2]
        }
    }
    if (-not $env:SSH_AUTH_SOCK) { Die 'Avvio di ssh-agent fallito.' }
    $AgentStarted = $true

    # Le variabili sul processo corrente: ssh-add e ssh le ereditano.
    $env:SSH_PASSPHRASE      = $SshPassphrase
    $env:SSH_ASKPASS         = ($AskPassFile -replace '\\', '/')
    $env:SSH_ASKPASS_REQUIRE = 'force'
    $env:DISPLAY             = ':0'   # serve alle versioni che ignorano SSH_ASKPASS_REQUIRE

    # ssh-add scrive "Identity added" su STDERR anche quando riesce. In PowerShell 5.1
    # con ErrorActionPreference='Stop' quel testo diventa un errore terminante:
    # va abbassata la preferenza e giudicato solo il codice di uscita.
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $SshAddExe $SshKey 2>&1 | Out-Null
    $addExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP
    if ($addExit -ne 0) { Die 'Sblocco della chiave fallito: SSH_PASSPHRASE e'' sbagliata?' }
    Info 'Chiave sbloccata nell''agent.'
}

# Chiude l'agent e cancella l'askpass. Da chiamare su OGNI uscita.
function Stop-SshAgent {
    if ($script:AgentStarted) {
        # Come per ssh-add: ssh-agent -k parla su stderr, e con EAP='Stop' un
        # messaggio innocuo farebbe fallire proprio la pulizia.
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & (Join-Path (Split-Path (Get-Command 'ssh').Source) 'ssh-agent.exe') -k 2>&1 | Out-Null
        $ErrorActionPreference = $prevEAP
        $script:AgentStarted = $false
    }
    if ($script:AskPassFile) {
        Remove-Item $script:AskPassFile -Force -ErrorAction SilentlyContinue
        $script:AskPassFile = $null
    }
    foreach ($v in 'SSH_PASSPHRASE','SSH_ASKPASS','SSH_ASKPASS_REQUIRE','SSH_AUTH_SOCK','SSH_AGENT_PID') {
        Remove-Item "Env:$v" -ErrorAction SilentlyContinue
    }
}

# --- Build comando SSH ---
# Con SSH_PASSWORD (senza chiave) si usa plink (PuTTY) come sshpass;
# se plink non c'e', ssh chiedera' la password al prompt.
$SshExe  = 'ssh'
$SshArgs = @()
if ($SshKey) {
    # PasswordAuthentication=no e NumberOfPasswordPrompts=0: se la chiave non si sblocca
    # si fallisce SUBITO, invece di bruciare tentativi a password che fanno scattare fail2ban.
    $SshArgs = @('-p', $SshPort, '-o', 'ConnectTimeout=15', '-i', $SshKey,
                 '-o', 'IdentitiesOnly=yes',
                 '-o', 'PasswordAuthentication=no',
                 '-o', 'KbdInteractiveAuthentication=no',
                 '-o', 'NumberOfPasswordPrompts=0',
                 $SshTarget)
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
    $proc.WaitForExit()
    Stop-SshAgent
}
if ($proc.ExitCode -ne 0) {
    # Niente .sql.gz da 0 byte in giro: sembrerebbe un dump valido.
    Remove-Item $DumpFile -Force -ErrorAction SilentlyContinue
    if ($SshKey -and -not $SshPassphrase) {
        Warn 'Se la chiave ha una passphrase, valorizza SSH_PASSPHRASE nel .env.'
    }
    Die "Dump fallito (exit $($proc.ExitCode))."
}

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
