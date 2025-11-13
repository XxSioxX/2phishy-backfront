# Use Node.js as the base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock) first for caching dependencies
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the rest of the application files
COPY . .

# Expose the port your Phaser.js server runs on (default 8000 if using `http-server`)
EXPOSE 9000

# Start the Phaser server (change if using a different method)
CMD ["yarn", "dev"]
