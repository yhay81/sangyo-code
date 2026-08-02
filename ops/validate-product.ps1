[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$WorkerPath = Join-Path $RepoRoot "src\worker.tsx"
$MigrationPath = Join-Path $RepoRoot "migrations\0001_telemetry.sql"
$AppPath = Join-Path $RepoRoot "public\app.js"
$StylesPath = Join-Path $RepoRoot "public\styles.css"
$SourcePath = Join-Path $RepoRoot "SOURCE.md"
$WranglerPath = Join-Path $RepoRoot "wrangler.jsonc"
$PublicDirectory = Join-Path $RepoRoot "public"
$DataPath = Join-Path $PublicDirectory "data\index.json"

$RequiredFiles = @(
    "DECISIONS.md", "EXPERIMENT.md", "LICENSE", "METRICS.md", "PRIVACY.md", "README.md", "SECURITY.md", "SOURCE.md", "STACK.md",
    ".github\workflows\ci.yml", "migrations\0001_telemetry.sql", "ops\product-metrics.ps1", "ops\product-metrics.sql",
    "ops\submit-indexnow.ps1", "public\app.js", "public\data\index.json", "public\favicon.svg", "public\manifest.webmanifest", "public\og.svg", "public\robots.txt",
    "scripts\build-data.mjs", "src\worker.tsx", "test\industry-data.test.ts", "test\surface.test.ts"
)
foreach ($RelativePath in $RequiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $RelativePath))) { throw "Missing required release file: $RelativePath" }
}

$Worker = Get-Content -Raw -LiteralPath $WorkerPath
$Migration = Get-Content -Raw -LiteralPath $MigrationPath
$App = Get-Content -Raw -LiteralPath $AppPath
$Styles = Get-Content -Raw -LiteralPath $StylesPath
$Source = Get-Content -Raw -LiteralPath $SourcePath
$Wrangler = Get-Content -Raw -LiteralPath $WranglerPath
$Data = Get-Content -Raw -LiteralPath $DataPath | ConvertFrom-Json
$ProductSurface = @($Worker, $App) -join "`n"

if (-not $Worker.Contains('class="industry-town"') -or -not $Worker.Contains('class="town-line"') -or -not $Worker.Contains('class="classification-rail"') -or -not $Worker.Contains('class="major-grid"') -or -not $Worker.Contains('class="code-tray"') -or -not $App.Contains('element("article", `classification-card') -or -not $App.Contains('element("code", "classification-code"')) { throw "Expected the industry town, hierarchy rail, category map, classification cards, and carry-out tray" }
if ($ProductSurface -match '(?i)public validation|success criteria|experiment|仮説|成功条件|市場スコア|移行候補|収益性') { throw "Research copy must not appear on the product surface" }
if ($Styles -match '(?i)gradient') { throw "Product CSS must not use gradients" }
if ($Styles -match '(?s)h1\s*\{[^}]*font-size:\s*(?:[5-9]\d|[1-9]\d{2})px') { throw "Primary heading is too large" }
if ($ProductSurface -match '(?i)innerHTML|eval\(|new Function|dangerouslySetInnerHTML') { throw "Official classification data must not be interpreted as markup or code" }
if (-not $Worker.Contains('app.post("/api/telemetry"') -or $Worker.Contains('app.post("/api/search"') -or -not $App.Contains('fetch("/data/index.json"')) { throw "Industry search must stay in the browser and use the verified static dataset" }
if ($App -match 'history\.(pushState|replaceState)|location\.search\s*=') { throw "Search and classification details must not enter product URLs" }
if ($Migration -match '(?i)classification_code|classification_name|query|search_term|business_detail|email|phone_number|telephone|advertising_id|password') { throw "Classification, search, contact, advertising, and authentication data do not belong in telemetry storage" }
if (-not $Migration.Contains("CHECK(event_name IN") -or -not $Worker.Contains("35 * 86400")) { throw "Expected allowlisted telemetry and 35-day retention" }
if (-not $Source.Contains("令和5年［2023年］7月改定") -or -not $Source.Contains("2,128") -or -not $Source.Contains("e-Stat terms of use") -or -not $Source.Contains("加工") -or -not $Source.Contains("non-matching examples")) { throw "Source version, dimensions, terms, transformation, and limitations are incomplete" }
if (-not $App.Contains('saved.length >= 8') -or -not $App.Contains('saved.slice(0, 8)')) { throw "Expected an eight-classification local carry-out limit" }
if (-not $App.Contains('https://www.e-stat.go.jp/classifications/terms/10/04/') -or -not $App.Contains('trailItems(item)')) { throw "Expected official-detail links and complete hierarchy trails" }
if ($ProductSurface -match '(?i)better-auth|betterAuth') { throw "Account authentication is not needed for local public records" }
if ($Wrangler.Contains("00000000-0000-0000-0000-000000000000")) { throw "The production D1 database ID has not been configured" }

if ($Data.counts.total -ne 2128 -or $Data.counts.major -ne 20 -or $Data.counts.division -ne 99 -or $Data.counts.group -ne 536 -or $Data.counts.detail -ne 1473) { throw "Official industry-classification dimensions are incorrect" }
if ($Data.source.revision -ne "04" -or $Data.source.retrievedAt -ne "2026-08-02" -or $Data.source.interfaceRows -ne 2129 -or $Data.source.sha256 -ne "7b96fe5dee3c8da38d516a08041c605be7407492e3ee754bc39d7aa3f46f0fe3") { throw "Official classification source version or hash is incorrect" }
if ($Data.items.Count -ne 2128 -or $Data.majors.Count -ne 20) { throw "Classification data arrays are incomplete" }
$Codes = @($Data.items | ForEach-Object { [string]$_.c })
if (@($Codes | Sort-Object -Unique).Count -ne 2128) { throw "Classification codes are not unique" }
$CodeSet = [Collections.Generic.HashSet[string]]::new([string[]]$Codes)
foreach ($Item in $Data.items) {
    if ([string]$Item.p -and -not $CodeSet.Contains([string]$Item.p)) { throw "Missing parent $($Item.p) for $($Item.c)" }
}
if (-not $CodeSet.Contains("0111") -or -not $CodeSet.Contains("3911") -or -not $CodeSet.Contains("9999")) { throw "Known classification codes are missing" }
if ((Get-Item -LiteralPath $DataPath).Length -gt 750000) { throw "Static classification data exceeds 750 KB" }
if ((Get-Item -LiteralPath (Join-Path $PublicDirectory "og.svg")).Length -lt 1500) { throw "Expected a product-specific OG SVG larger than 1.5 KB" }
if ((Get-Item -LiteralPath $AppPath).Length -lt 15000) { throw "Expected a substantial classification client" }

$KeyFiles = @(Get-ChildItem -LiteralPath $PublicDirectory -File | Where-Object { $_.Name -match "^[a-zA-Z0-9-]{8,128}\.txt$" })
if ($KeyFiles.Count -ne 1) { throw "Expected exactly one generated IndexNow key file, found $($KeyFiles.Count)" }
$Key = (Get-Content -Raw -LiteralPath $KeyFiles[0].FullName).Trim()
if ($Key -ne $KeyFiles[0].BaseName) { throw "IndexNow key file name and content do not match" }

Write-Output "Product release contract is satisfied"
