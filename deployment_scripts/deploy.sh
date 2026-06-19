#!/bin/bash

TAG=$1
ENV=$2

if [ -z "$TAG" ] || [ -z "$ENV" ]; then
  echo "Usage: ./deploy.sh <tag> <env>"
  echo "Example: ./deploy.sh dev-v5 jahn"
  exit 1
fi

REGISTRY="100.83.34.98:5000"
SERVER="http://100.83.34.98:9000"

echo "🔨 Building frontend..."
docker buildx build \
  --tag $REGISTRY/frontend:$TAG \
  --push ./2Phishy/image-display-app

echo "🔨 Building backend..."
docker buildx build \
  --tag $REGISTRY/backend:$TAG \
  --push ./backend

echo "🚀 Triggering deploy on VPS..."
curl "$SERVER/deploy?env=$ENV&tag=$TAG"

echo "✅ Done!"