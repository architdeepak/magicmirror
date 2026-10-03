[CmdletBinding()]
param(
  [switch]$Kiosk
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Require-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required. $InstallHint"
  }
}

Require-Command 'git' 'Install Git for Windows, then run this script again.'
Require-Command 'git-lfs' 'Install Git LFS, then run this script again.'
Require-Command 'node' 'Install Node.js 20 LTS or newer, then run this script again.'
Require-Command 'npm' 'Install Node.js 20 LTS or newer, then run this script again.'

$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) { throw "Node.js 20+ is required; found $(node --version)." }

Write-Host 'Reflect Mirror setup' -ForegroundColor Cyan
git lfs install
git lfs pull

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Host 'Created .env (demo mode). Add GEMINI_API_KEY later for live AI voice.' -ForegroundColor Yellow
}

Write-Host 'Installing the locked dependency set…' -ForegroundColor Cyan
npm ci

if ($Kiosk) {
  Write-Host 'Launching Reflect Mirror in kiosk mode…' -ForegroundColor Green
  npm run kiosk
} else {
  Write-Host 'Launching Reflect Mirror…' -ForegroundColor Green
  npm start
}
