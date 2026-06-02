# Node.js API container
FROM node:20-alpine
WORKDIR /app

COPY server/package*.json ./server/
RUN npm ci --prefix server --omit=dev

COPY server/ ./server/
COPY puro/ ./puro/

RUN mkdir -p ./server/data

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/server/data

CMD ["node", "server/index.js"]
