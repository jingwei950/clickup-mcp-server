import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";

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
  // Resource: fetch authorized user metadata
  server.resource(
    "clickup_user",
    new ResourceTemplate("clickup://user", { list: undefined }),
    {
      description: "Fetch metadata for the authorized user",
      mimeType: "application/json",
    },
    async (uri) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ error: "API key missing." }),
            },
          ],
        };
      }
      const result = await callClickUpApi("user", "GET", apiKey);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  // Resource: fetch a workspace's metadata
  server.resource(
    "clickup_workspace",
    new ResourceTemplate("clickup://workspace/{workspace_id}", {
      list: undefined,
    }),
    {
      description: "Fetch metadata for a specific workspace",
      mimeType: "application/json",
    },
    async (uri, { workspace_id }) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ error: "API key missing." }),
            },
          ],
        };
      }
      const result = await callClickUpApi(
        `team/${workspace_id}`,
        "GET",
        apiKey
      );
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  server.tool(
    "getAuthorizedUser",
    "Fetch metadata for the authorized user",
    {},
    async () => {
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
    }
  );

  server.tool(
    "getWorkspaces",
    "List all workspaces accessible by the authorized user",
    {},
    async () => {
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
    }
  );
}
