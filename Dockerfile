# Install dependencies only when needed
FROM node:16.18-alpine as deps
LABEL author="Victor Han"
LABEL name="backend"

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
RUN apk add --update --no-cache curl py-pip
RUN apk add --no-cache make python3 g++ gcc libgcc libstdc++
RUN npm install --quiet node-gyp -g

# install for sharp library
RUN apk add --update --no-cache --repository http://dl-3.alpinelinux.org/alpine/edge/community --repository http://dl-3.alpinelinux.org/alpine/edge/main vips-dev

# Set the Temp Working Directory inside the container
WORKDIR /temp-deps

# copy package json
COPY ["package.json", "yarn.lock", "./"]

RUN yarn install --frozen-lockfile

FROM node:16.18-alpine as build_base
LABEL author="Victor Han"
LABEL name="backend"

# Set the Temp Working Directory inside the container
WORKDIR /temp-build

RUN export NODE_OPTIONS=\"--max_old_space_size=4096\"

# copy base code
COPY . .

# copy environment
RUN cp .env.docker-production .env

COPY --from=deps /temp-deps/node_modules ./node_modules

# prune devDependencies
RUN yarn build && yarn install --production --ignore-scripts --prefer-offline

# image runner app
FROM node:16.18-alpine as runner
LABEL author="Victor Han"
LABEL name="backend"

RUN apk add ca-certificates

# install global package for runner
RUN npm config set scripts-prepend-node-path true
RUN npm i -g typescript
RUN npm i -g pm2

# Set the Current Working Directory inside the container
WORKDIR /app

ENV NODE_ENV production

# Setup Timezone
RUN apk add tzdata
ENV TZ=UTC

# editor cli with nano
RUN apk add nano

COPY --from=build_base /temp-build/public ./public
COPY --from=build_base /temp-build/node_modules ./node_modules
COPY --from=build_base /temp-build/package.json ./package.json
COPY --from=build_base /temp-build/tsconfig.json ./tsconfig.json
COPY --from=build_base /temp-build/.swcrc ./.swcrc
COPY --from=build_base /temp-build/.sequelizerc ./.sequelizerc
COPY --from=build_base /temp-build/logs ./logs
COPY --from=build_base /temp-build/dist ./dist
COPY --from=build_base /temp-build/src ./src
COPY --from=build_base /temp-build/.env ./.env

# initial app
RUN node ./dist/scripts/generate.js

# This container exposes port 8000 to the outside world
EXPOSE 8000

# Run for production
CMD ["yarn", "serve:production-docker"]
