# Base image.
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the packaged application files into the container
COPY ./package*.json ./

# Install NestJS CLI globally
RUN npm install -g @nestjs/cli

# Install app dependencies
RUN npm install

# Copy all files
COPY . .

# Accept the environment file as an argument
ARG ENV_FILE=local.env
COPY ./env/${ENV_FILE} .env

# Placeholder for dynamically generated ARG and ENV directives
# DOCKERFILE_VARS_PLACEHOLDER

# Creates a "dist" folder with the production build
RUN npm run build

# Expose the port on which the app will run, default to 4002 if APP_PORT is not set
EXPOSE ${APP_PORT:-4000}

# Start the server using the production build
CMD ["npm", "run", "start:prod"]
