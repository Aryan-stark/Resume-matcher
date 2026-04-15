FROM node:20-alpine

WORKDIR /app

# Install production deps first for better layer caching
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY samples ./samples

ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/api/server.js"]
