param(
    [string]$MigrationPath = "",
    [string]$Psql = "psql"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $MigrationPath) {
    $MigrationPath = Join-Path $repoRoot "backend\db\migrations\001_initial_schema.sql"
}

function Read-DotEnv {
    param([string]$Path)

    $values = @{}
    if (-not (Test-Path $Path)) {
        return $values
    }

    foreach ($line in Get-Content $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
            continue
        }

        $parts = $trimmed.Split("=", 2)
        $name = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"').Trim("'")
        if ($name) {
            $values[$name] = $value
        }
    }
    return $values
}

function Get-ConfigValue {
    param(
        [hashtable]$DotEnv,
        [string]$Name,
        [string]$FallbackName = ""
    )

    $value = [Environment]::GetEnvironmentVariable($Name)
    if ($value) {
        return $value
    }
    if ($DotEnv.ContainsKey($Name) -and $DotEnv[$Name]) {
        return $DotEnv[$Name]
    }
    if ($FallbackName) {
        return Get-ConfigValue -DotEnv $DotEnv -Name $FallbackName
    }
    return ""
}

$dotenv = Read-DotEnv (Join-Path $repoRoot ".env")
$databaseUrl = Get-ConfigValue -DotEnv $dotenv -Name "DATABASE_URL"
$password = Get-ConfigValue -DotEnv $dotenv -Name "DB_PASSWORD" -FallbackName "POSTGRES_PASSWORD"

$arguments = @()
if ($databaseUrl) {
    $arguments += $databaseUrl
} else {
    $hostName = Get-ConfigValue -DotEnv $dotenv -Name "DB_HOST" -FallbackName "POSTGRES_HOST"
    $port = Get-ConfigValue -DotEnv $dotenv -Name "DB_PORT" -FallbackName "POSTGRES_PORT"
    $user = Get-ConfigValue -DotEnv $dotenv -Name "DB_USER" -FallbackName "POSTGRES_USER"
    $database = Get-ConfigValue -DotEnv $dotenv -Name "DB_NAME" -FallbackName "POSTGRES_DB"

    if ($hostName) { $arguments += @("--host", $hostName) }
    if ($port) { $arguments += @("--port", $port) }
    if ($user) { $arguments += @("--username", $user) }
    if ($database) { $arguments += @("--dbname", $database) }
}

$arguments += @("-v", "ON_ERROR_STOP=1", "-f", $MigrationPath)

$oldPassword = [Environment]::GetEnvironmentVariable("PGPASSWORD")
if ($password -and -not $oldPassword) {
    [Environment]::SetEnvironmentVariable("PGPASSWORD", $password)
}

try {
    & $Psql @arguments
    exit $LASTEXITCODE
} finally {
    if ($password -and -not $oldPassword) {
        [Environment]::SetEnvironmentVariable("PGPASSWORD", $null)
    }
}
