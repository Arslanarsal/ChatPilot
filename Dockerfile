# chat-pilot/Dockerfile

# Use Node.js 22 as the base image
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and lock file
COPY package*.json ./

# Install all dependencies
# This step is cached by Docker, so it only runs when package.json changes
RUN npm install

# Copy the rest of your application's source code
COPY . .

# The command to run the app in development mode
CMD ["npm", "run", "start:dev"]
