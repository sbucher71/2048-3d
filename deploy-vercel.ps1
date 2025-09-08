param(
  [switch]$Prod
)

# Ensure Vercel CLI is available
$vercel = (Get-Command vercel -ErrorAction SilentlyContinue)
if (-not $vercel) {
  Write-Host "Vercel CLI not found. Installing globally via npm..."
  npm install -g vercel
}

# Move to the script directory (TestApp)
Set-Location -Path $PSScriptRoot

# First-time interactive deploy (links project) if .vercel not present
if (-not (Test-Path (Join-Path $PSScriptRoot ".vercel"))) {
  Write-Host "No .vercel project found. Running initial 'vercel' to set up..."
  vercel
}

# Deploy (preview or prod)
if ($Prod) {
  vercel --prod
} else {
  vercel
}
