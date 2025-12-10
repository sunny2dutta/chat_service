# Use the official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install the application dependencies
# Note: We use npm install instead of ci because package-lock might not exist yet or be out of sync in dev
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript code
RUN npm run build

# Create a non-root user to run the application
RUN addgroup -g 1001 -S nodejs
RUN adduser -S chatuser -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R chatuser:nodejs /app
USER chatuser

# Expose the port the app runs on
EXPOSE 3001

# Define environment variable
ENV NODE_ENV=production
ENV PORT=3001

# Command to run the application
CMD ["npm", "start"]
