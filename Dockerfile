FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
# prepare runs tsc; skip scripts here because src and tsconfig are copied next.
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev
# The server talks MCP over stdio. It must start and list tools with no token set.
# APIFY_TOKEN is read only when a tool is called.
# Required by the official MCP Registry to prove ownership of this image.
LABEL io.modelcontextprotocol.server.name="io.github.datlabhq/datlab-mcp"
ENV NODE_ENV=production
ENTRYPOINT ["node", "dist/index.js"]
