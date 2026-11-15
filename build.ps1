# Prepares a clean folder to package (no example, README, .gitignore or key).
# Usage: powershell -File build.ps1 [-Out <output folder>]
param([string]$Out = (Join-Path (Split-Path $PSScriptRoot -Parent) 'offline-markdown-viewer-dist'))

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$dst = Join-Path $Out 'omv'
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Force $dst | Out-Null

Copy-Item (Join-Path $src 'manifest.json') $dst
foreach ($d in 'src', 'icons', 'vendor', '_locales') { Copy-Item (Join-Path $src $d) (Join-Path $dst $d) -Recurse }

$m = Get-Content (Join-Path $dst 'manifest.json') -Raw | ConvertFrom-Json
if ($m.PSObject.Properties.Name -contains 'key') { throw 'The manifest must not contain a key field.' }
if (Get-ChildItem $dst -Recurse -Include *.pem, *.key, *.crx) { throw 'Key file found in the build.' }

"Build ready: $dst (version $($m.version))"
Get-ChildItem $dst -Recurse -File | ForEach-Object { '{0,10:N0}  {1}' -f $_.Length, $_.FullName.Substring($dst.Length + 1) }
