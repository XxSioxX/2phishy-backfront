param(
    [string]$TAG,
    [string]$ENV
)

# ========================
# VALIDATE PARAMETERS
# ========================
if (-not $TAG -or -not $ENV) {
    Write-Host "Usage: .\deploy.ps1 <tag> <env>"
    Write-Host "Example: .\deploy.ps1 andre-latest andre"
    exit 1
}

$REGISTRY = "100.83.34.98:5000"
$SERVER = "http://100.83.34.98:9000"

# ========================
# RESOLVE PATHS (FIX WINDOWS ISSUE)
# ========================
try {
    $FRONTEND_PATH = (Resolve-Path "./2Phishy/image-display-app").Path
    $BACKEND_PATH  = (Resolve-Path "./backend").Path
} catch {
    Write-Host "❌ Failed to resolve paths. Make sure you are in the project root."
    exit 1
}

Write-Host "📁 Frontend path: $FRONTEND_PATH"
Write-Host "📁 Backend path:  $BACKEND_PATH"

# ========================
# BUILD FRONTEND
# ========================
Write-Host "`n🔨 Building frontend..."
docker buildx build `
  --progress=plain `
  --tag "$REGISTRY/frontend:$TAG" `
  --push "$FRONTEND_PATH"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build FAILED. Aborting."
    exit 1
}

# ========================
# BUILD BACKEND
# ========================
Write-Host "`n🔨 Building backend..."
docker buildx build `
  --progress=plain `
  --tag "$REGISTRY/backend:$TAG" `
  --push "$BACKEND_PATH"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend build FAILED. Aborting."
    exit 1
}

# ========================
# VERIFY IMAGES EXIST (EXTRA SAFETY)
# ========================
Write-Host "`n🔍 Verifying images in registry..."

docker manifest inspect "$REGISTRY/frontend:$TAG" > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend image NOT found in registry. Aborting."
    exit 1
}

docker manifest inspect "$REGISTRY/backend:$TAG" > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend image NOT found in registry. Aborting."
    exit 1
}

Write-Host "✅ Images verified!"

# ========================
# DEPLOY
# ========================
Write-Host "`n🚀 Triggering deploy on VPS..."
$uri = '""{0}/deploy?env={1}`&tag={2}""' -f $SERVER, $ENV, $TAG

try {
    $response = Invoke-WebRequest -Uri $uri -UseBasicParsing
    Write-Host "`n📡 VPS Response:"
    Write-Host $response.Content
}
catch {
    Write-Host "❌ Failed to reach VPS deploy endpoint"
    Write-Host "Error: $_"
    exit 1
}

Write-Host "`n🎉 Deploy complete!"