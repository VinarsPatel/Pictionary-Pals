FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY index.js ./

ENV NODE_ENV=production
ENV DB_PATH=/app/data/pictionary.db

EXPOSE 4000

CMD ["node", "index.js"]
