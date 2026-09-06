# Production Dockerfile for RoomieMatch Backend (Node.js 20 LTS)
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

# Copy dependencies definitions
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy source code and data
COPY . .

# Ensure data and uploads directories exist
RUN mkdir -p data uploads/profiles uploads/properties uploads/verifications

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

# Run migrations, seed demo data if fresh, and start the server
CMD ["sh", "-c", "node src/database/migrate.js && node src/database/seed.js && node src/index.js"]
