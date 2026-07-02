param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"

function Test-Command {
  param(
    [string]$Name,
    [scriptblock]$Command,
    [bool]$Required = $true
  )

  try {
    $output = & $Command 2>&1
    [pscustomobject]@{
      Name = $Name
      Status = "OK"
      Required = $Required
      Detail = ($output | Select-Object -First 1) -join " "
    }
  } catch {
    [pscustomobject]@{
      Name = $Name
      Status = "MISSING"
      Required = $Required
      Detail = $_.Exception.Message
    }
  }
}

function Test-RepoFile {
  param([string]$RelativePath)

  $path = Join-Path $RepoRoot $RelativePath
  [pscustomobject]@{
    Path = $RelativePath
    Status = if (Test-Path -LiteralPath $path) { "OK" } else { "MISSING" }
  }
}

Write-Host "Repo root: $RepoRoot"
Write-Host ""

$toolResults = @(
  Test-Command "node" { node --version }
  Test-Command "npm" { npm --version }
  Test-Command "git" { git --version }
  Test-Command "gh" { gh --version }
  Test-Command "graphify" { graphify --version } $false
  Test-Command "wrangler" { npx wrangler --version } $false
  Test-Command "playwright" { npx playwright --version } $false
)

Write-Host "Tools"
$toolResults | Format-Table -AutoSize

$fileResults = @(
  Test-RepoFile "AGENTS.md"
  Test-RepoFile ".git"
  Test-RepoFile "docs/codex-memory/00-indice.md"
  Test-RepoFile "docs/codex-memory/10-migration-tracker.md"
  Test-RepoFile "docs/codex-memory/11-skills-and-tools.md"
  Test-RepoFile "docs/refactor-v2-clean-architecture.md"
  Test-RepoFile "docs/environments.md"
  Test-RepoFile "package.json"
  Test-RepoFile "README.md"
)

Write-Host ""
Write-Host "Repo files"
$fileResults | Format-Table -AutoSize

Push-Location $RepoRoot
try {
  Write-Host ""
  Write-Host "Git branch"
  git branch --show-current

  Write-Host ""
  Write-Host "Git status"
  $status = git status --short
  if ($status) {
    $status
  } else {
    Write-Host "Clean"
  }
} finally {
  Pop-Location
}

$hasRequiredFailure = ($toolResults | Where-Object { $_.Required -and $_.Status -ne "OK" }).Count -gt 0
$hasMissingFile = ($fileResults | Where-Object { $_.Status -ne "OK" }).Count -gt 0

if ($hasRequiredFailure -or $hasMissingFile) {
  exit 1
}

exit 0
