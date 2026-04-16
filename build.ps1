# build.ps1 - Bundle with esbuild and produce a single inline index.html
param(
  [string]$ProjectRoot = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'
$ReleaseDir = Join-Path $ProjectRoot 'release'

Write-Host '[1] Cleaning release\ ...'
if (Test-Path $ReleaseDir) { Remove-Item $ReleaseDir -Recurse -Force }
New-Item -ItemType Directory -Path $ReleaseDir | Out-Null

Write-Host '[2] Bundling with esbuild ...'
$bundle = Join-Path $ReleaseDir 'bundle.js'
& npx esbuild src/main.ts --bundle --minify --target=es2020 --outfile=$bundle
if ($LASTEXITCODE -ne 0) { throw 'esbuild failed' }

Write-Host '[3] Generating single index.html ...'
$html = Get-Content (Join-Path $ProjectRoot 'index.html') -Raw -Encoding UTF8
$css  = Get-Content (Join-Path $ProjectRoot 'style.css')  -Raw -Encoding UTF8
$js   = Get-Content $bundle                               -Raw -Encoding UTF8

$out = $html `
  -replace [regex]::Escape('<link rel="stylesheet" href="style.css" />'),
           "<style>`n$css`n</style>" `
  -replace [regex]::Escape('<script type="module" src="dist/main.js"></script>'),
           "<script>`n$js`n</script>"

$outPath = Join-Path $ReleaseDir 'index.html'
[System.IO.File]::WriteAllText($outPath, $out, [System.Text.Encoding]::UTF8)

Write-Host '[4] Removing temporary bundle.js ...'
Remove-Item $bundle

$size = (Get-Item $outPath).Length
Write-Host ""
Write-Host "Build complete!"
Write-Host ("    Output : $outPath")
Write-Host ("    Size   : {0} bytes ({1:F1} KB)" -f $size, ($size / 1024))
Write-Host ""
Write-Host "Open release\index.html directly in your browser."
