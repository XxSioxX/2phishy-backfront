#!/bin/bash

set -euo pipefail

NO_CACHE=false
TAG=""

usage() {
  echo "Usage: ./deploy-prod.sh <tag> [--no-cache]"
}

for arg in "$@"; do
  case "$arg" in
    --no-cache)
      NO_CACHE=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $arg"
      usage
      exit 1
      ;;
    *)
      if [[ -n "$TAG" ]]; then
        echo "Unexpected extra argument: $arg"
        usage
        exit 1
      fi
      TAG="$arg"
      ;;
  esac
done

TAG=${TAG:-latest}

REGISTRY="100.76.69.118:5000"
SERVER="phishy"
BUILDER="phishy-builder"
LATEST_ALIAS="latest-dev"

FRONTEND_PATH="./2Phishy/image-display-app"
BACKEND_PATH="./backend"
BUILDKIT_CONFIG="./buildkitd.toml"

create_builder() {
  echo "Creating Buildx builder for the private HTTP registry..."

  docker buildx rm "$BUILDER" >/dev/null 2>&1 || true
  docker rm -f "buildx_buildkit_${BUILDER}0" >/dev/null 2>&1 || true

  docker buildx create \
    --name "$BUILDER" \
    --driver docker-container \
    --config "$BUILDKIT_CONFIG" \
    --use >/dev/null

  docker buildx inspect "$BUILDER" --bootstrap >/dev/null
}

if ! docker buildx inspect "$BUILDER" --bootstrap >/dev/null 2>&1; then
  echo "Buildx builder is missing or stale. Recreating it..."
  create_builder
fi

FRONTEND_TAGS=(-t "$REGISTRY/frontend:$TAG")
BACKEND_TAGS=(-t "$REGISTRY/backend:$TAG")

if [[ "$TAG" != "$LATEST_ALIAS" ]]; then
  FRONTEND_TAGS+=(-t "$REGISTRY/frontend:$LATEST_ALIAS")
  BACKEND_TAGS+=(-t "$REGISTRY/backend:$LATEST_ALIAS")
fi

echo ""
echo "========================================="
echo "Deploying version: $TAG"
echo "========================================="
echo ""

echo "[1/4] Building + pushing frontend..."

docker buildx build \
  --builder "$BUILDER" \
  --platform linux/amd64 \
  $([[ "$NO_CACHE" == true ]] && echo "--no-cache") \
  "${FRONTEND_TAGS[@]}" \
  --push \
  $FRONTEND_PATH

echo ""
echo "[2/4] Building + pushing backend..."

docker buildx build \
  --builder "$BUILDER" \
  --platform linux/amd64 \
  $([[ "$NO_CACHE" == true ]] && echo "--no-cache") \
  "${BACKEND_TAGS[@]}" \
  --push \
  $BACKEND_PATH

echo ""
echo "[3/4] Triggering remote deployment..."

ssh "$SERVER" "
  set -e
  cd /home/deploy/phishy && \
  ./deploy-prod.sh '$TAG'
"
echo ""
echo "[4/4] Deployment complete"
echo "Version deployed: $TAG"
echo ""
