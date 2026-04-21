# Stage 1 — build the React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Delete the Windows-generated lockfile so npm resolves Linux-specific
# optional dependencies (e.g. @rollup/rollup-linux-x64-musl) correctly
RUN rm -f package-lock.json && npm install
COPY . .
RUN npm run build

# Stage 2 — serve the built files with Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
