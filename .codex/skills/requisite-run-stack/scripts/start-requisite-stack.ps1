param(
    [ValidateSet("postgres", "csv")]
    [string]$DataSource = "postgres",
    [int]$ApiPort = 8080,
    [int]$FrontendPort = 5173,
    [switch]$ForcePortCleanup,
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
    $scriptDir = Split-Path -Parent $PSCommandPath
    return (Resolve-Path (Join-Path $scriptDir "..\..\..\..")).Path
}

function Test-CommandExists {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-PortListeners {
    param([int]$Port)

    $connections = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
        [PSCustomObject]@{
            Port = $Port
            ProcessId = $connection.OwningProcess
            ProcessName = if ($process) { $process.ProcessName } else { "<unknown>" }
        }
    }
}

function Clear-PortIfRequested {
    param(
        [int]$Port,
        [string]$Label
    )

    $listeners = @(Get-PortListeners -Port $Port)
    if ($listeners.Count -eq 0) {
        return
    }

    $summary = ($listeners | ForEach-Object { "$($_.ProcessName) pid=$($_.ProcessId)" }) -join ", "
    if (-not $ForcePortCleanup) {
        throw "$Label port ${Port} is already in use by: $summary. Re-run with -ForcePortCleanup only if these are stale local dev processes, or choose another port."
    }

    foreach ($listener in $listeners) {
        Write-Host "Stopping listener on $Label port ${Port}: $($listener.ProcessName) pid=$($listener.ProcessId)"
        Stop-Process -Id $listener.ProcessId -Force -ErrorAction Stop
    }

    Start-Sleep -Seconds 1
}

function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code $LASTEXITCODE`: $FilePath $($Arguments -join ' ')"
        }
    } finally {
        Pop-Location
    }
}

function Start-LoggedProcess {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [string]$LogPrefix
    )

    $stdout = Join-Path $LogDir "$LogPrefix.out.log"
    $stderr = Join-Path $LogDir "$LogPrefix.err.log"
    $startProcessArguments = @{
        FilePath = $FilePath
        WorkingDirectory = $WorkingDirectory
        WindowStyle = "Hidden"
        RedirectStandardOutput = $stdout
        RedirectStandardError = $stderr
        PassThru = $true
    }

    if ($Arguments.Count -gt 0) {
        $startProcessArguments.ArgumentList = $Arguments
    }

    $process = Start-Process @startProcessArguments

    Write-Host "$LogPrefix started pid=$($process.Id)"
    Write-Host "$LogPrefix logs: $stdout ; $stderr"
    return $process
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [string]$Label,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                Write-Host "$Label healthy at $Url"
                return
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    } while ((Get-Date) -lt $deadline)

    throw "$Label did not become healthy at $Url within $TimeoutSeconds seconds."
}

$RepoRoot = Resolve-RepoRoot
$LogDir = Join-Path $RepoRoot ".codex\run-stack-logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$ApiBaseUrl = "http://127.0.0.1:$ApiPort"
$FrontendUrl = "http://127.0.0.1:$FrontendPort"

Write-Host "Repo: $RepoRoot"
Write-Host "API: $ApiBaseUrl"
Write-Host "Frontend: $FrontendUrl"
Write-Host "Data source: $DataSource"

Clear-PortIfRequested -Port $ApiPort -Label "API"
Clear-PortIfRequested -Port $FrontendPort -Label "frontend"

if ($CheckOnly) {
    Wait-HttpOk -Url "$ApiBaseUrl/health" -Label "API"
    Wait-HttpOk -Url $FrontendUrl -Label "Frontend"
    exit 0
}

if (-not (Test-CommandExists "mingw32-make")) {
    throw "mingw32-make was not found on PATH. Use the repo-supported Windows build toolchain before starting the stack."
}

if ($DataSource -eq "postgres") {
    if (-not (Test-CommandExists "docker")) {
        throw "docker was not found on PATH. If Docker Desktop is installed, run .\scripts\enable-docker-path.ps1, then retry."
    }

    Invoke-Checked -FilePath "docker" -Arguments @("compose", "up", "-d", "postgres") -WorkingDirectory $RepoRoot
}

Invoke-Checked -FilePath "mingw32-make" -Arguments @("api") -WorkingDirectory $RepoRoot

$frontendDir = Join-Path $RepoRoot "frontend"
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    if (-not (Test-CommandExists "npm")) {
        throw "npm was not found on PATH and frontend/node_modules is missing."
    }
    Invoke-Checked -FilePath "npm" -Arguments @("install") -WorkingDirectory $frontendDir
}

$oldApiPort = $env:API_PORT
$oldApiDataSource = $env:API_DATA_SOURCE
$oldViteApiBaseUrl = $env:VITE_API_BASE_URL
$startedProcesses = @()
$stackStarted = $false

try {
    $env:API_PORT = [string]$ApiPort
    $env:API_DATA_SOURCE = $DataSource
    $apiProcess = Start-LoggedProcess `
        -FilePath (Join-Path $RepoRoot "build\requisite-api.exe") `
        -Arguments @() `
        -WorkingDirectory $RepoRoot `
        -LogPrefix "api"
    $startedProcesses += $apiProcess

    Wait-HttpOk -Url "$ApiBaseUrl/health" -Label "API" -TimeoutSeconds 45

    $env:VITE_API_BASE_URL = $ApiBaseUrl
    $npmFile = if ($IsWindows -or $env:OS -eq "Windows_NT") { "npm.cmd" } else { "npm" }
    $frontendProcess = Start-LoggedProcess `
        -FilePath $npmFile `
        -Arguments @("run", "dev", "--", "--host", "127.0.0.1", "--port", [string]$FrontendPort, "--strictPort") `
        -WorkingDirectory $frontendDir `
        -LogPrefix "frontend"
    $startedProcesses += $frontendProcess

    Wait-HttpOk -Url $FrontendUrl -Label "Frontend" -TimeoutSeconds 45

    Write-Host ""
    Write-Host "Stack is running:"
    Write-Host "  API pid=$($apiProcess.Id) $ApiBaseUrl"
    Write-Host "  Frontend pid=$($frontendProcess.Id) $FrontendUrl"
    Write-Host "  Logs: $LogDir"
    $stackStarted = $true
} finally {
    if (-not $stackStarted) {
        foreach ($process in $startedProcesses) {
            if ($process -and -not $process.HasExited) {
                Write-Host "Stopping process started by failed stack launch: pid=$($process.Id)"
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
        }
    }

    $env:API_PORT = $oldApiPort
    $env:API_DATA_SOURCE = $oldApiDataSource
    $env:VITE_API_BASE_URL = $oldViteApiBaseUrl
}
