# Use Node.js 18 for stability and compatibility
FROM node:18

# Set working directory inside the container
WORKDIR /app

# Copy package.json and install only prod dependencies
COPY package*.json ./
RUN npm install

# Copy the entire project
COPY . .

# Expose the port Render will use
EXPOSE 10000

# Start the app
CMD ["npm", "start"]
