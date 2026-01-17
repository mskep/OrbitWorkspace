# Package script for Personal Hub
# Creates Windows installer

Write-Host "Packaging Personal Hub for Windows..." -ForegroundColor Green

Set-Location -Path $PSScriptRoot\..

Write-Host "Building application..." -ForegroundColor Yellow
.\scripts\build.ps1

Write-Host "Creating Windows installer..." -ForegroundColor Yellow
npm run dist

Write-Host "Package created in dist/ folder!" -ForegroundColor Green
