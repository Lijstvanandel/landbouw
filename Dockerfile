FROM node:22-alpine

WORKDIR /app

# Installeer dependencies (inclusief tsx & vite voor build + runtime)
COPY package.json bun.lock* package-lock.json* ./
RUN npm install

# Kopieer applicatiecode
COPY . .

# Bouw frontend productiebundel naar /app/dist
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3130

EXPOSE 3130

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3130/api/health || exit 1

CMD ["npm", "start"]
