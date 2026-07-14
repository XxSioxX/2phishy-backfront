#!/bin/bash
set -e

TAG=$1
ENV=$2

if [ -z "$TAG" ] || [ -z "$ENV" ]; then
  echo "Usage: ./deploy.sh <tag> <env>"
  exit 1
fi

REGISTRY="100.83.34.98:5000"
SERVER="http://100.83.34.98:9000"

echo "🔨 Building frontend..."
docker buildx build \
  --tag $REGISTRY/frontend:$TAG \
  --cache-from=type=registry,ref=$REGISTRY/frontend:buildcache \
  --cache-to=type=registry,ref=$REGISTRY/frontend:buildcache,mode=max \
  --push ./2Phishy/image-display-app

echo "🔨 Building backend..."
docker buildx build \
  --tag $REGISTRY/backend:$TAG \
  --cache-from=type=registry,ref=$REGISTRY/backend:buildcache \
  --cache-to=type=registry,ref=$REGISTRY/backend:buildcache,mode=max \
  --push ./backend

echo "🚀 Triggering deploy..."
curl "$SERVER/deploy?env=$ENV&tag=$TAG"

echo "✅ Done!"