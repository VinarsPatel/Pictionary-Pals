FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# CRA inlines REACT_APP_* variables at build time, not at container start —
# they must be supplied as build args (see docker-compose.yml).
ARG REACT_APP_SERVER_URL
ARG REACT_APP_WS_URL
ENV REACT_APP_SERVER_URL=$REACT_APP_SERVER_URL
ENV REACT_APP_WS_URL=$REACT_APP_WS_URL

COPY public ./public
COPY src ./src
COPY tailwind.config.js ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
