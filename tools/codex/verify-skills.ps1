param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
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
  )
)

$ErrorActionPreference = "Stop"

$currentProfile = $env:USERPROFILE
$currentRoots = @(
  (Join-Path $currentProfile ".codex\skills"),
  (Join-Path $currentProfile ".agents\skills")
)

$historicalRoots = @()
$usersRoot = Split-Path -Parent $currentProfile
if (Test-Path -LiteralPath $usersRoot) {
  $historicalRoots = Get-ChildItem -LiteralPath $usersRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne $currentProfile } |
    ForEach-Object { Join-Path $_.FullName ".codex\skills" } |
    Where-Object { Test-Path -LiteralPath $_ }
}

$repoRoots = @(
  (Join-Path $RepoRoot ".agents\skills"),
  (Join-Path $RepoRoot ".skills"),
  (Join-Path $RepoRoot ".codex\skills"),
  (Join-Path $RepoRoot ".claude\skills"),
  (Join-Path $RepoRoot "skills")
)

$skillRoots = @($currentRoots + $historicalRoots + $repoRoots) | Select-Object -Unique

$skillTypes = @{
  "graphify" = "EXTERNAL"
  "ui-ux-pro-max" = "EXTERNAL"
  "burgers-pr-workflow" = "PROPIA"
  "playwright-qa" = "PROPIA"
  "burgers-brand" = "PROPIA"
  "obsidian-markdown" = "EXTERNAL"
  "obsidian-bases" = "EXTERNAL"
  "json-canvas" = "EXTERNAL"
  "obsidian-cli" = "EXTERNAL"
  "defuddle" = "EXTERNAL"
}

function Get-RootScope {
  param([string]$Path)

  foreach ($root in $currentRoots) {
    if ($Path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
      return "ACTUAL"
    }
  }

  foreach ($root in $historicalRoots) {
    if ($Path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
      return "HISTORICA"
    }
  }

  return "REPO"
}

Write-Host "Repo root: $RepoRoot"
Write-Host "Current user profile: $currentProfile"
Write-Host "Primary Codex skills path: $(Join-Path $currentProfile '.codex\skills')"
Write-Host ""
Write-Host "Skill roots"
$skillRoots | ForEach-Object {
  [pscustomobject]@{
    Scope = if ($currentRoots -contains $_) { "ACTUAL" } elseif ($historicalRoots -contains $_) { "HISTORICA" } else { "REPO" }
    Path = $_
    Exists = Test-Path -LiteralPath $_
  }
} | Format-Table -AutoSize

$results = foreach ($skill in $OfficialSkills) {
  $matches = foreach ($root in $skillRoots) {
    if (Test-Path -LiteralPath $root) {
      Get-ChildItem -LiteralPath $root -Recurse -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq $skill }
    }
  }

  if ($matches) {
    foreach ($match in $matches) {
      $skillMd = Join-Path $match.FullName "SKILL.md"
      [pscustomobject]@{
        Skill = $skill
        Type = $skillTypes[$skill]
        Scope = Get-RootScope $match.FullName
        Status = if (Test-Path -LiteralPath $skillMd) { "OK" } else { "INCOMPLETA" }
        Path = $match.FullName
        HasSkillMd = Test-Path -LiteralPath $skillMd
      }
    }
  } else {
    [pscustomobject]@{
      Skill = $skill
      Type = $skillTypes[$skill]
      Scope = ""
      Status = "FALTA"
      Path = ""
      HasSkillMd = $false
    }
  }
}

Write-Host ""
Write-Host "Official skills"
$results | Sort-Object Skill, Scope, Path | Format-Table -AutoSize

Write-Host ""
Write-Host "Current vs historical comparison"
$comparison = foreach ($skill in $OfficialSkills) {
  $skillRows = $results | Where-Object { $_.Skill -eq $skill }
  $currentOk = $skillRows | Where-Object { $_.Scope -eq "ACTUAL" -and $_.Status -eq "OK" }
  $historicalOk = $skillRows | Where-Object { $_.Scope -eq "HISTORICA" -and $_.Status -eq "OK" }
  $repoOk = $skillRows | Where-Object { $_.Scope -eq "REPO" -and $_.Status -eq "OK" }

  [pscustomobject]@{
    Skill = $skill
    CurrentUserPath = (($currentOk | Select-Object -ExpandProperty Path) -join "; ")
    Historical = (($historicalOk | Select-Object -ExpandProperty Path) -join "; ")
    Recommendation = if ($currentOk) {
      "conservar actual; ignorar historica"
    } elseif ($repoOk) {
      "repo OK; instalar en actual si se necesita runtime global"
    } elseif ($historicalOk) {
      "referencia historica; instalar en actual si se necesita"
    } else {
      "instalar o documentar pendiente"
    }
  }
}
$comparison | Format-Table -AutoSize

Write-Host ""
Write-Host "Graphify installs"
@(
  [pscustomobject]@{ Name = "Codex user skill"; Path = (Join-Path $currentProfile ".agents\skills\graphify\SKILL.md"); Exists = Test-Path -LiteralPath (Join-Path $currentProfile ".agents\skills\graphify\SKILL.md") }
  [pscustomobject]@{ Name = "Primary Codex skills path"; Path = (Join-Path $currentProfile ".codex\skills\graphify\SKILL.md"); Exists = Test-Path -LiteralPath (Join-Path $currentProfile ".codex\skills\graphify\SKILL.md") }
) | Format-Table -AutoSize

$missingEffective = foreach ($skill in $OfficialSkills) {
  $skillRows = $results | Where-Object { $_.Skill -eq $skill }
  if (-not ($skillRows | Where-Object { $_.Status -eq "OK" })) {
    $skill
  }
}

if ($missingEffective.Count -gt 0) {
  Write-Host ""
  Write-Host "Missing effective skills: $($missingEffective -join ', ')"
  exit 1
}

exit 0
