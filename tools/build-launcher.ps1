param([switch]$WithoutRuntime)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskCompiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $taskCompiler)) { $taskCompiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework/v4.0.30319/csc.exe' }
if (-not (Test-Path -LiteralPath $taskCompiler)) { throw 'The Windows .NET Framework C# compiler is required.' }
& $taskCompiler /nologo /target:winexe /optimize+ /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/out:$(Join-Path $taskRoot 'MeshAvatarStudio.exe')" (Join-Path $PSScriptRoot 'launcher/StudioLauncher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Could not build the launcher.' }
if (-not $WithoutRuntime) {
    $taskNode = (Get-Command node.exe -ErrorAction Stop).Source
    $taskNpmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
    $taskNpmRoot = Join-Path (Split-Path $taskNpmCommand -Parent) 'node_modules/npm'
    if (-not (Test-Path -LiteralPath (Join-Path $taskNpmRoot 'bin/npm-cli.js'))) { throw 'Could not locate npm. Use -WithoutRuntime with a system Node.js installation.' }
    $taskRuntime = Join-Path $PSScriptRoot 'launcher-runtime'
    New-Item -ItemType Directory -Path (Join-Path $taskRuntime 'node_modules') -Force | Out-Null
    Copy-Item -LiteralPath $taskNode -Destination (Join-Path $taskRuntime 'node.exe') -Force
    Copy-Item -LiteralPath $taskNpmRoot -Destination (Join-Path $taskRuntime 'node_modules') -Recurse -Force
    $taskNodeLicense = Join-Path (Split-Path $taskNode -Parent) 'LICENSE'
    if (Test-Path -LiteralPath $taskNodeLicense) { Copy-Item -LiteralPath $taskNodeLicense -Destination (Join-Path $taskRuntime 'NODE-LICENSE.txt') -Force }
}
Write-Output 'Ready: double-click MeshAvatarStudio.exe in the repository folder.'
