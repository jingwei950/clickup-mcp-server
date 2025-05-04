import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAuthorizationTools(
  server: McpServer,
  getApiKey: () => string,
  callClickUpApi: (
    path: string,
    method: string,
    apiKey: string,
    body?: any
  ) => Promise<any>
) {
  server.tool("getAuthorizedUser", {}, async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return {
        content: [
          {
            type: "text",
            text: "API key missing.",
          },
        ],
      };
    }
    const result = await callClickUpApi("user", "GET", apiKey);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  server.tool("getWorkspaces", {}, async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return {
        content: [
          {
            type: "text",
            text: "API key missing.",
          },
        ],
      };
    }
    const result = await callClickUpApi("team", "GET", apiKey);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });
}
