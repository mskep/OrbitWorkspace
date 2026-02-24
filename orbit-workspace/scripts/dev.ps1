# Development script for Personal Hub
# Runs both the Renderer (Vite) and Electron process

Write-Host "Starting Personal Hub in development mode..." -ForegroundColor Green

# Set environment variable
$env:NODE_ENV = "development"

# Start development
Set-Location -Path $PSScriptRoot\..
npm run dev
