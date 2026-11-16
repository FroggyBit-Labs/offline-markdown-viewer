# Prepares a clean folder to package (no example, README, .gitignore or key).
# Usage: powershell -File build.ps1 [-Out <output folder>] [-Zip]
# With -Zip, also writes omv-<version>.zip next to the folder, ready to upload to a store:
# forward slashes in entry names (Compress-Archive in Windows PowerShell 5.1 writes backslashes, which
# stores and some unzip tools mishandle) and a fixed timestamp (file times would reveal the local time).
param(
  # Default: <workspace root's parent>\_Livrables\<workspace name>\builds, outside the repository and the open workspace.
  [string]$Out = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) ('_Livrables\' + (Split-Path (Split-Path $PSScriptRoot -Parent) -Leaf) + '\builds')),
  [switch]$Zip
)

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$dst = Join-Path $Out 'omv'
# Safety: the output folder must not be the source folder, one of its parents, or inside it
# (the next step deletes the output folder recursively).
$srcFull = [IO.Path]::GetFullPath($src).TrimEnd('\') + '\'
$dstFull = [IO.Path]::GetFullPath($dst).TrimEnd('\') + '\'
if ($srcFull.StartsWith($dstFull, [StringComparison]::OrdinalIgnoreCase) -or $dstFull.StartsWith($srcFull, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'The output folder must be outside the source folder.'
}
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Force $dst | Out-Null

Copy-Item (Join-Path $src 'manifest.json') $dst
foreach ($d in 'src', 'icons', 'vendor', '_locales') { Copy-Item (Join-Path $src $d) (Join-Path $dst $d) -Recurse }

$m = Get-Content (Join-Path $dst 'manifest.json') -Raw | ConvertFrom-Json
if ($m.PSObject.Properties.Name -contains 'key') { throw 'The manifest must not contain a key field.' }
if (Get-ChildItem $dst -Recurse -Include *.pem, *.key, *.crx) { throw 'Key file found in the build.' }

"Build ready: $dst (version $($m.version))"
Get-ChildItem $dst -Recurse -File | ForEach-Object { '{0,10:N0}  {1}' -f $_.Length, $_.FullName.Substring($dst.Length + 1) }

if ($Zip) {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zipPath = Join-Path $Out ("omv-{0}.zip" -f $m.version)
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  $fixedTime = [DateTimeOffset]::new(2026, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
  $archive = [IO.Compression.ZipFile]::Open($zipPath, [IO.Compression.ZipArchiveMode]::Create)
  try {
    Get-ChildItem $dst -Recurse -File | Sort-Object FullName | ForEach-Object {
      $name = $_.FullName.Substring($dst.Length + 1).Replace('\', '/')
      $entry = $archive.CreateEntry($name, [IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = $fixedTime
      $in = [IO.File]::OpenRead($_.FullName)
      $outStream = $entry.Open()
      try { $in.CopyTo($outStream) } finally { $outStream.Dispose(); $in.Dispose() }
    }
  } finally { $archive.Dispose() }
  "ZIP ready: $zipPath"
}
