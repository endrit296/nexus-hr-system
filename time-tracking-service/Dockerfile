# Përdorim versionin e fundit të qëndrueshëm të Node.js
FROM node:18-alpine

# Caktojmë folderin e punës brenda kontinerit
WORKDIR /app

# Kopjojmë listën e paketave
COPY package*.json ./

# Instalojmë varësitë
RUN npm install --production

# Kopjojmë të gjithë kodin tonë
COPY . .

# Hapim portin 3005
EXPOSE 3005

# Komanda për nisjen e shërbimit
CMD ["node", "server.js"]