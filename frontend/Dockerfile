# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

ARG APP_VERSION=dev
ARG BUILD_VERSION_ARG=dev

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Write version files so vite.config.ts can read them
RUN echo "${APP_VERSION}" > /app/VERSION && echo "${BUILD_VERSION_ARG}" > /app/BUILD_VERSION

RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
