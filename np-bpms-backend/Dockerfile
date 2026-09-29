# Use official lightweight Node.js runtime
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Cloud Run defaults to PORT 8080
ENV PORT=8080
EXPOSE 8080

# Start server
CMD ["node", "server.js"]
