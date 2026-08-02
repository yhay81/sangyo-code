[CmdletBinding()]
param([switch]$Local)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SqlPath = Join-Path $PSScriptRoot "product-metrics.sql"
$Wrangler = Join-Path $RepoRoot "node_modules\.bin\wrangler.cmd"
$Target = if ($Local) { "--local" } else { "--remote" }
$Sql = (Get-Content $SqlPath) -join " "

$Output = & $Wrangler d1 execute sangyo-code $Target --json --command $Sql
if ($LASTEXITCODE -ne 0) { throw "D1 metrics query failed with exit code $LASTEXITCODE" }
$Payload = ($Output -join [Environment]::NewLine) | ConvertFrom-Json
$Row = $Payload[0].results[0]
if (-not $Row) { throw "D1 metrics query returned no result" }

function Get-Percent {
    param([int]$Numerator, [int]$Denominator)
    if ($Denominator -eq 0) { return $null }
    return [Math]::Round(($Numerator / $Denominator) * 100, 1)
}

$Users = [int]$Row.users
$Successful = [int]$Row.successful_searches
$NoResult = [int]$Row.no_result_searches
$Searches = $Successful + $NoResult

[ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    service = "sangyo-code"
    environment = if ($Local) { "local" } else { "production" }
    funnel = [ordered]@{
        users = $Users
        category_selectors = [int]$Row.category_selectors
        searchers = [int]$Row.searchers
        successful_searches = $Successful
        no_result_searches = $NoResult
        level_changers = [int]$Row.level_changers
        savers = [int]$Row.savers
        copiers = [int]$Row.copiers
        official_openers = [int]$Row.official_openers
        returned = [int]$Row.returned
        searchers_7d = [int]$Row.searchers_7d
        copiers_7d = [int]$Row.copiers_7d
        qa_rows = [int]$Row.qa_rows
    }
    rates = [ordered]@{
        category_selection_percent = Get-Percent ([int]$Row.category_selectors) $Users
        search_percent = Get-Percent ([int]$Row.searchers) $Users
        successful_search_percent = Get-Percent $Successful $Searches
        level_change_percent = Get-Percent ([int]$Row.level_changers) $Users
        save_percent = Get-Percent ([int]$Row.savers) $Users
        copy_percent = Get-Percent ([int]$Row.copiers) $Users
        official_open_percent = Get-Percent ([int]$Row.official_openers) $Users
        return_percent = Get-Percent ([int]$Row.returned) $Users
    }
} | ConvertTo-Json -Depth 4
