# Prefer Windows PowerShell's own modules when launched through a PS7 child process.
if ($PSVersionTable.PSEdition -eq 'Desktop') {
  $env:PSModulePath = [IO.Path]::Combine($PSHOME, 'Modules') + [IO.Path]::PathSeparator + $env:PSModulePath
}
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$CapsuleDir = if ($env:PNGOUNG_CAPSULE_DIR) { $env:PNGOUNG_CAPSULE_DIR } else { Join-Path $HOME 'pngoung-capsule' }
$CapsuleUrl = if ($env:PNGOUNG_CAPSULE_ARCHIVE_URL) { $env:PNGOUNG_CAPSULE_ARCHIVE_URL } else { 'https://codeload.github.com/pgnoung/pngoung-capsule/zip/refs/heads/main' }
if (Test-Path $CapsuleDir) { throw 'Destination already exists. Launch its installer, or select a new PNGOUNG_CAPSULE_DIR. Existing files were preserved.' }
$parent = Split-Path -Parent ([IO.Path]::GetFullPath($CapsuleDir))
while ($parent) {
  if ((Test-Path $parent) -and ((Get-Item $parent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Destination parent must not be a link' }
  $parent = Split-Path -Parent $parent
}
$CapsuleTmp = Join-Path ([IO.Path]::GetTempPath()) ('capsule-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $CapsuleTmp | Out-Null
try {
  $archive = Join-Path $CapsuleTmp 'kit.zip'
  Invoke-WebRequest $CapsuleUrl -OutFile $archive -UseBasicParsing
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead($archive)
  try {
    foreach ($entry in $zip.Entries) {
      if ($entry.FullName -match '(^[/\\]|(^|[/\\])\.\.([/\\]|$)|:)') { throw 'Unsafe archive path' }
      $kind = ($entry.ExternalAttributes -shr 16) -band 0xF000
      if ($kind -notin 0,0x8000,0x4000) { throw 'Archive links and special files are not supported' }
    }
  } finally { $zip.Dispose() }
  $unpacked = Join-Path $CapsuleTmp 'src'
  Expand-Archive -LiteralPath $archive -DestinationPath $unpacked
  $roots = @(Get-ChildItem -LiteralPath $unpacked -Directory)
  if ($roots.Count -ne 1) { throw 'Invalid package root' }
  $src = $roots[0].FullName
  if ((Get-Content (Join-Path $src 'package.json') -Raw | ConvertFrom-Json).name -ne 'pngoung-capsule') { throw 'Wrong package' }
  New-Item -ItemType Directory -Force -Path $CapsuleDir | Out-Null
  Get-ChildItem -LiteralPath $src -Force | Copy-Item -Destination $CapsuleDir -Recurse -Force
  '{"owner":"pngoung-capsule"}' | Set-Content (Join-Path $CapsuleDir '.capsule-install.json') -Encoding UTF8
} finally { Remove-Item -LiteralPath $CapsuleTmp -Recurse -Force }
$mode = if ($env:PNGOUNG_CAPSULE_NO_START -eq '1') { 'install' } else { 'start' }
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $CapsuleDir 'install\pngoung-capsule.ps1') $mode
if ($LASTEXITCODE -ne 0) { throw 'Capsule setup failed; inspect the previous error' }
