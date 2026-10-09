FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run docs:build

FROM nginx:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/docs/.vitepress/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
