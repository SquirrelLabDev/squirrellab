# Publie les .pbix de "asset/Power BI Report" dans My workspace (connexion interactive).
# Usage : pwsh scripts/publish-pbix.ps1 [-Only CV]
param([string]$Only)
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..\asset\Power BI Report' | Resolve-Path
$registry = Join-Path $root 'published-reports.json'

# clé = chemin relatif (sans extension), valeur = nom du rapport à la première publication.
# Ensuite le nom est repris du rapport existant (retrouvé par reportId), ce qui évite les doublons après renommage dans le portail.
$titles = [ordered]@{
  'Perso\CV'                          = 'CV interactif'
  'Perso\escape-game-data'            = 'Escape game data'
  'Perso\formation-power-bi'          = 'Formation Power BI'
  'World Challenge\semaine-1'         = 'World Challenge - Semaine 1 Saint-Valentin'
  'World Challenge\semaine-2'         = 'World Challenge - Semaine 2 The Power of Travel'
  'ECE\ep01-formule-1'                = 'ECE - La Formule 1'
  'ECE\ep02-tourisme'                 = 'ECE - Tourisme & habitudes dans le monde'
  'ECE\ep03-criminalite'              = 'ECE - La criminalité'
  'ECE\ep04-pokemon'                  = 'ECE - Pokémon'
  'ECE\ep05-inazuma-eleven'           = 'ECE - Inazuma Eleven'
  'ECE\ep06-finance'                  = 'ECE - La Finance'
  'ECE\ep07-musiques-hit'             = 'ECE - Les musiques qui font du Hit'
  'ECE\ep08-femmes-tech'              = 'ECE - Les femmes dans la Tech'
  'ECE\ep09-immobilier'               = 'ECE - L''immobilier'
  'ECE\ep10-politique'                = 'ECE - La politique'
}

Import-Module MicrosoftPowerBIMgmt.Profile, MicrosoftPowerBIMgmt.Reports
Connect-PowerBIServiceAccount | Out-Null

$known = @{}
if (Test-Path $registry) {
  foreach ($e in (Get-Content $registry -Raw | ConvertFrom-Json)) {
    # anciennes clés "Dashboards\..." -> "Perso\..."
    $known[($e.key -replace '^Dashboards\\', 'Perso\')] = $e
  }
}
$online = @{}
foreach ($r in (Get-PowerBIReport)) { $online[[string]$r.Id] = $r }

$results = @{}
foreach ($k in $known.Keys) { $results[$k] = $known[$k] }

foreach ($key in $titles.Keys) {
  $leaf = Split-Path $key -Leaf
  if ($Only -and $leaf -ne $Only) { continue }

  $file = Get-ChildItem (Join-Path $root (Split-Path $key)) -Filter "$leaf.pbix*" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $file) { Write-Warning "Introuvable : $key"; continue }

  $name = $titles[$key]
  if ($known.ContainsKey($key) -and $online.ContainsKey([string]$known[$key].reportId)) {
    $name = $online[[string]$known[$key].reportId].Name
  }

  Write-Host "Import : $name ..."
  $r = New-PowerBIReport -Path $file.FullName -Name $name -ConflictAction CreateOrOverwrite
  if ($known.ContainsKey($key) -and [string]$r.Id -ne [string]$known[$key].reportId) {
    Write-Warning "reportId changé pour $key : $($known[$key].reportId) -> $($r.Id) (le lien Publish to web est à régénérer)"
  }
  $results[$key] = [pscustomobject]@{ key = $key; name = $name; reportId = $r.Id; webUrl = $r.WebUrl }
}

$results.Values | Sort-Object key | ConvertTo-Json | Set-Content $registry -Encoding utf8
Write-Host "`nRegistre mis à jour -> $registry"
