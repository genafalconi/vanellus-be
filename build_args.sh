#!/bin/bash

# Determine the environment file to use based on the branch
if [[ "$GITHUB_REF" == "refs/heads/development" ]]; then
  ENV_FILE=".env"
elif [[ "$GITHUB_REF" == "refs/heads/main" ]]; then
  ENV_FILE=".env"
else
  ENV_FILE=".env"
fi

# Create an empty string to hold all build arguments
BUILD_ARGS="--build-arg ENV_FILE=${ENV_FILE}"

# Create a string to hold all ARG and ENV directives for Dockerfile
DOCKERFILE_VARS=""

# Read the environment file and append each variable as a build argument
while IFS= read -r line; do
  if [[ ! -z "$line" && "$line" != \#* ]]; then
    VAR_NAME=$(echo $line | cut -d= -f1)
    VAR_VALUE=$(echo $line | cut -d= -f2-)

    BUILD_ARGS+=" --build-arg ${VAR_NAME}='${VAR_VALUE}'"
    DOCKERFILE_VARS+="ARG ${VAR_NAME}\nENV ${VAR_NAME}=\${${VAR_NAME}}\n"
  fi
done < "${ENV_FILE}"

# Output the build arguments
echo "BUILD_ARGS=${BUILD_ARGS}" >> $GITHUB_ENV
echo -e "${DOCKERFILE_VARS}" > dockerfile_vars.txt
