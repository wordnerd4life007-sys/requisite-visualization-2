param(
    [string]$MigrationPath = "",
    [string]$Psql = "psql"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$migrationPaths = @()
if ($MigrationPath) {
    $migrationPaths += (Resolve-Path $MigrationPath).Path
} else {
    $migrationsDir = Join-Path $repoRoot "backend\db\migrations"
    $migrationPaths = Get-ChildItem -Path $migrationsDir -Filter "*.sql" |
        Sort-Object Name |
        ForEach-Object { $_.FullName }
}

if (-not $migrationPaths) {
    throw "No migration files found."
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

$baseArguments = @()
if ($databaseUrl) {
    $baseArguments += $databaseUrl
} else {
    $hostName = Get-ConfigValue -DotEnv $dotenv -Name "DB_HOST" -FallbackName "POSTGRES_HOST"
    $port = Get-ConfigValue -DotEnv $dotenv -Name "DB_PORT" -FallbackName "POSTGRES_PORT"
    $user = Get-ConfigValue -DotEnv $dotenv -Name "DB_USER" -FallbackName "POSTGRES_USER"
    $database = Get-ConfigValue -DotEnv $dotenv -Name "DB_NAME" -FallbackName "POSTGRES_DB"

    if ($hostName) { $baseArguments += @("--host", $hostName) }
    if ($port) { $baseArguments += @("--port", $port) }
    if ($user) { $baseArguments += @("--username", $user) }
    if ($database) { $baseArguments += @("--dbname", $database) }
}

$oldPassword = [Environment]::GetEnvironmentVariable("PGPASSWORD")
if ($password -and -not $oldPassword) {
    [Environment]::SetEnvironmentVariable("PGPASSWORD", $password)
}

try {
    foreach ($path in $migrationPaths) {
        Write-Host "Applying migration: $path"
        $arguments = $baseArguments + @("-v", "ON_ERROR_STOP=1", "-f", $path)
        & $Psql @arguments
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
    }
    exit 0
} finally {
    if ($password -and -not $oldPassword) {
        [Environment]::SetEnvironmentVariable("PGPASSWORD", $null)
    }
}
