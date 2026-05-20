FROM node:18-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3002
CMD ["sh", "-c", "npx sequelize-cli db:migrate && exec node index.js"]
