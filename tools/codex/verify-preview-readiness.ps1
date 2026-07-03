param(
  [switch]$CloudflareReadOnly
)

$ErrorActionPreference = "Stop"

function Write-Section {
  param([string]$Title)
  Write-Output ""
  Write-Output $Title
  Write-Output ("-" * $Title.Length)
}

function Test-CommandAvailable {
  param([string]$Name)
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { "OK" } else { "MISSING" }
}

Write-Section "Preview readiness read-only check"
Write-Output "Repo: $(Get-Location)"
Write-Output "Branch: $(git branch --show-current)"
Write-Output "Git status:"
$status = git status --short
if ($status) { $status } else { "Clean" }

Write-Section "Tooling"
Write-Output "node: $(Test-CommandAvailable node)"
Write-Output "npm: $(Test-CommandAvailable npm)"
Write-Output "git: $(Test-CommandAvailable git)"
Write-Output "npx: $(Test-CommandAvailable npx)"
try {
  $wranglerVersion = npx wrangler --version
  Write-Output "wrangler: OK $wranglerVersion"
} catch {
  Write-Output "wrangler: MISSING_OR_FAILED"
}

Write-Section "NPM scripts"
$packageJson = Get-Content -Raw "package.json" | ConvertFrom-Json
$packageJson.scripts.PSObject.Properties | Sort-Object Name | ForEach-Object {
  $name = $_.Name
  $value = [string]$_.Value
  $risk = if ($value -match "--remote|pages deploy|r2 object put|secret put|d1 create|r2 bucket create|pages project create") { "MUTATING_OR_REMOTE" } elseif ($value -match "--local") { "LOCAL_MUTATION" } else { "READ_OR_BUILD" }
  Write-Output ("{0} = {1} [{2}]" -f $name, $value, $risk)
}

Write-Section "Expected resources in repo references"
$patterns = @(
  "burgers-exe-public-v2-preview",
  "burgers-exe-internal-v2-preview",
  "burgers-exe-menu-v2-preview",
  "burgers-exe-assets-v2-preview",
  "burgers-exe-menu-live",
  "burgers-exe-menu-assets",
  "BOG_MENU_DB",
  "BOG_MENU_ASSETS",
  "BOG_INTERNAL_PIN",
  "ORDERS_V2_WRITE_ENABLED"
)
foreach ($pattern in $patterns) {
  $matches = git grep -n $pattern -- README.md docs package.json wrangler.example.toml functions 2>$null
  $count = @($matches).Count
  Write-Output ("{0}: {1} reference(s)" -f $pattern, $count)
}

Write-Section "Seed status"
if (Test-Path ".\migrations\0008_preview_realistic_orders_seed.sql") {
  Write-Output "migrations/0008_preview_realistic_orders_seed.sql: PRESENT"
} else {
  Write-Output "migrations/0008_preview_realistic_orders_seed.sql: MISSING"
}

if ($CloudflareReadOnly) {
  Write-Section "Cloudflare read-only inventory"
  Write-Output "Running read-only list commands only. No deploy, migration, seed, secret, create, put, or delete commands."
  npx wrangler pages project list
  npx wrangler d1 list
  npx wrangler r2 bucket list
}
