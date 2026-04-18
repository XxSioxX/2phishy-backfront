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
$SERVER   = "http://100.83.34.98:9000"

function Test-ManifestExists {
    param(
        [string]$ImageTag
    )

    # Suppress CLI noise (e.g., "no such manifest") and rely on exit code.
    docker manifest inspect $ImageTag *> $null
    if ($LASTEXITCODE -eq 0) {
        return $true
    }

    # Fallback for registries where `docker manifest inspect` is unreliable.
    if ($ImageTag -match '^[^/]+/(.+):([^:]+)$') {
        $repository = $Matches[1]
        $tag = $Matches[2]
        $tagsUri = "http://$REGISTRY/v2/$repository/tags/list"

        try {
            $response = Invoke-WebRequest -Uri $tagsUri -UseBasicParsing -ErrorAction Stop
            $json = $response.Content | ConvertFrom-Json
            if ($json.tags -and ($json.tags -contains $tag)) {
                return $true
            }
        } catch {
            # Ignore and return false below.
        }
    }

    return $false
}

function Invoke-DockerBuildWithRetry {
    param(
        [string]$Label,
        [string]$ImageTag,
        [string]$ContextPath
    )

    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $buildArgs = @("build", "--pull", "--tag", $ImageTag)

        if ($attempt -eq 3) {
            # Last attempt bypasses local cache in case of corrupted build layers.
            $buildArgs += "--no-cache"
        }

        $buildArgs += $ContextPath

        Write-Host "Attempt $attempt/3: Building $Label..."
        docker @buildArgs | Out-Host
        if ($LASTEXITCODE -ne 0) {
            if ($attempt -lt 3) {
                Write-Host "$Label build failed on attempt $attempt. Retrying in 5 seconds..."
                Start-Sleep -Seconds 5
            }
            continue
        }

        Write-Host "Attempt $attempt/3: Pushing $Label..."
        docker push $ImageTag | Out-Host
        if ($LASTEXITCODE -ne 0) {
            if ($attempt -lt 3) {
                Write-Host "$Label push failed on attempt $attempt. Retrying in 5 seconds..."
                Start-Sleep -Seconds 5
            }
            continue
        }

        for ($verifyAttempt = 1; $verifyAttempt -le 3; $verifyAttempt++) {
            if (Test-ManifestExists -ImageTag $ImageTag) {
                return $true
            }

            Write-Host "$Label manifest not visible yet after push (check $verifyAttempt/3). Waiting 3 seconds..."
            Start-Sleep -Seconds 3
        }

        Write-Host "$Label push completed but manifest is still missing in registry."
    }

    return $false
}

# ========================
# RESOLVE PATHS
# ========================
try {
    $FRONTEND_PATH = (Resolve-Path "./2Phishy/image-display-app").Path
    $BACKEND_PATH  = (Resolve-Path "./backend").Path
} catch {
    Write-Host "Failed to resolve paths. Make sure you are in the project root."
    exit 1
}

Write-Host "Frontend path: $FRONTEND_PATH"
Write-Host "Backend path:  $BACKEND_PATH"

# ========================
# BUILD FRONTEND
# ========================
Write-Host "`nBuilding frontend..."
if (-not [bool](Invoke-DockerBuildWithRetry -Label "frontend" -ImageTag "$REGISTRY/frontend:$TAG" -ContextPath $FRONTEND_PATH)) {
    Write-Host "Frontend build FAILED. Aborting."
    exit 1
}

# ========================
# BUILD BACKEND
# ========================
Write-Host "`nBuilding backend..."
if (-not [bool](Invoke-DockerBuildWithRetry -Label "backend" -ImageTag "$REGISTRY/backend:$TAG" -ContextPath $BACKEND_PATH)) {
    Write-Host "Backend build FAILED. Aborting."
    exit 1
}

# ========================
# VERIFY IMAGES EXIST
# ========================
Write-Host "`nVerifying images in registry..."

if (-not (Test-ManifestExists -ImageTag "$REGISTRY/frontend:$TAG")) {
    Write-Host "Frontend image NOT found in registry. Aborting."
    exit 1
}

if (-not (Test-ManifestExists -ImageTag "$REGISTRY/backend:$TAG")) {
    Write-Host "Backend image NOT found in registry. Aborting."
    exit 1
}

Write-Host "Images verified!"

# ========================
# DEPLOY
# ========================
Write-Host "`nTriggering deploy on VPS..."
$uri = $SERVER + '/deploy?env=' + $ENV + '&tag=' + $TAG

try {
    $response = Invoke-WebRequest -Uri $uri -UseBasicParsing -ErrorAction Stop
    Write-Host "`nVPS Response:"
    Write-Host $response.Content
} catch {
    Write-Host "Failed to reach VPS deploy endpoint"
    Write-Host "Error: $_"
    exit 1
}

Write-Host "`nDeploy complete!"