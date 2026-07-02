param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string[]]$SkillRoots = @(
    "C:\Users\yoliz\.codex\skills",
    (Join-Path $env:USERPROFILE ".codex\skills"),
    (Join-Path $RepoRoot ".agents\skills"),
    (Join-Path $RepoRoot ".skills"),
    (Join-Path $RepoRoot ".codex\skills"),
    (Join-Path $RepoRoot "skills")
  ),
  [string[]]$OfficialSkills = @(
    "graphify",
    "burgers-pr-workflow",
    "playwright-qa",
    "ui-ux-pro-max",
    "burgers-brand"
  )
)

$ErrorActionPreference = "Stop"

Write-Host "Repo root: $RepoRoot"
Write-Host ""
Write-Host "Skill roots"
$SkillRoots | ForEach-Object {
  [pscustomobject]@{
    Path = $_
    Exists = Test-Path -LiteralPath $_
  }
} | Format-Table -AutoSize

$results = foreach ($skill in $OfficialSkills) {
  $matches = foreach ($root in $SkillRoots) {
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
        Status = if (Test-Path -LiteralPath $skillMd) { "OK" } else { "INCOMPLETE" }
        Path = $match.FullName
        HasSkillMd = Test-Path -LiteralPath $skillMd
      }
    }
  } else {
    [pscustomobject]@{
      Skill = $skill
      Status = "MISSING"
      Path = ""
      HasSkillMd = $false
    }
  }
}

Write-Host ""
Write-Host "Official skills"
$results | Sort-Object Skill, Path | Format-Table -AutoSize

if (($results | Where-Object { $_.Status -eq "MISSING" }).Count -gt 0) {
  exit 1
}

exit 0
