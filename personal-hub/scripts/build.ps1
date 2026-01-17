# Build script for Personal Hub
# Builds the Renderer and prepares for packaging

Write-Host "Building Personal Hub..." -ForegroundColor Green

Set-Location -Path $PSScriptRoot\..

Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "Installing renderer dependencies..." -ForegroundColor Yellow
Set-Location -Path apps\desktop\renderer
npm install

Set-Location -Path $PSScriptRoot\..

Write-Host "Building renderer..." -ForegroundColor Yellow
npm run build:renderer

Write-Host "Build completed!" -ForegroundColor Green
Write-Host "Run 'npm run dist' to create distributable package" -ForegroundColor Cyan
