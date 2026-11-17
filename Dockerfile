FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev=false
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev
# The server talks MCP over stdio. It must start and list tools with no token set.
# APIFY_TOKEN is read only when a tool is called.
ENV NODE_ENV=production
ENTRYPOINT ["node", "dist/index.js"]
