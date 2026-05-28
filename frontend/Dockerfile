# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install only production dependencies for build layer, then copy source.
COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

ARG VITE_API_BASE_URL=http://127.0.0.1:8080
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

FROM nginx:stable-alpine AS production

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
