FROM node:24-bookworm-slim AS build
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build -- --configuration production

FROM nginx:1.28-alpine
COPY --from=build /src/frontend/dist/frontend/browser/ /usr/share/nginx/html/
COPY infrastructure/k8s/base/config/nginx.conf /etc/nginx/nginx.conf
USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx", "-g", "daemon off;"]
