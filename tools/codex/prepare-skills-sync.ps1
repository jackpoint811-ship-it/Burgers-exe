param(
  [string]$SourceRoot,
  [string]$DestinationRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path ".agents\skills"),
  [string[]]$OfficialSkills = @(
    "graphify",
    "ui-ux-pro-max",
    "burgers-pr-workflow",
    "playwright-qa",
    "burgers-brand",
    "obsidian-markdown",
    "obsidian-bases",
    "json-canvas",
    "obsidian-cli",
    "defuddle"
  ),
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

Write-Host "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"
Write-Host "Source root: $SourceRoot"
Write-Host "Destination root: $DestinationRoot"
Write-Host ""

if (-not $SourceRoot) {
  Write-Host "No SourceRoot was provided. Nothing to copy."
  Write-Host "Example dry-run:"
  Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\codex\prepare-skills-sync.ps1 -SourceRoot `$env:USERPROFILE\.codex\skills"
  exit 0
}

if (-not (Test-Path -LiteralPath $SourceRoot)) {
  throw "SourceRoot does not exist: $SourceRoot"
}

if (-not (Test-Path -LiteralPath $DestinationRoot)) {
  if ($Apply) {
    New-Item -ItemType Directory -Path $DestinationRoot | Out-Null
  } else {
    Write-Host "Would create destination root: $DestinationRoot"
  }
}

$plan = foreach ($skill in $OfficialSkills) {
  $source = Join-Path $SourceRoot $skill
  $destination = Join-Path $DestinationRoot $skill
  $sourceSkillMd = Join-Path $source "SKILL.md"

  if (-not (Test-Path -LiteralPath $source)) {
    [pscustomobject]@{ Skill = $skill; Action = "skip"; Reason = "source missing"; Source = $source; Destination = $destination }
    continue
  }

  if (-not (Test-Path -LiteralPath $sourceSkillMd)) {
    [pscustomobject]@{ Skill = $skill; Action = "skip"; Reason = "source missing SKILL.md"; Source = $source; Destination = $destination }
    continue
  }

  if (Test-Path -LiteralPath $destination) {
    [pscustomobject]@{ Skill = $skill; Action = "skip"; Reason = "destination exists"; Source = $source; Destination = $destination }
    continue
  }

  [pscustomobject]@{ Skill = $skill; Action = if ($Apply) { "copy" } else { "would copy" }; Reason = "official skill"; Source = $source; Destination = $destination }
}

$plan | Format-Table -AutoSize

if ($Apply) {
  foreach ($item in $plan | Where-Object { $_.Action -eq "copy" }) {
    Copy-Item -LiteralPath $item.Source -Destination $item.Destination -Recurse
  }
}

Write-Host ""
Write-Host "No existing skill folders are overwritten. Dry-run is the default."
