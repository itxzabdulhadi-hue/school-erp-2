FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci && npm run build && npm prune --omit=dev
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
VOLUME ["/app/uploads"]
CMD ["node", "dist/index.js"]
