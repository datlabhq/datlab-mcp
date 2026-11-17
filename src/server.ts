import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { ApifyError } from "./apify.js";
import { tools } from "./tools.js";

export const SERVER_NAME = "datlab-mcp";
export const SERVER_VERSION = "0.1.0";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const status = err instanceof ApifyError ? err.status : undefined;
  return {
    isError: true as const,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: message, ...(status ? { status } : {}) }),
      },
    ],
  };
}

export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.schema,
      },
      async (args) => {
        try {
          const items = await tool.run((args ?? {}) as Record<string, unknown>);
          return toolResult({ actor: tool.name, itemCount: items.length, items });
        } catch (err) {
          return toolError(err);
        }
      },
    );
  }

  return server;
}
