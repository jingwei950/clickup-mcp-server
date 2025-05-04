import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerFolderTools(
  server: McpServer,
  getApiKey: () => string,
  callClickUpApi: (
    path: string,
    method: string,
    apiKey: string,
    body?: any
  ) => Promise<any>
) {
  server.tool("getFolders", { spaceId: z.string() }, async ({ spaceId }) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return { content: [{ type: "text", text: "API key missing." }] };
    }
    const result = await callClickUpApi(
      `space/${spaceId}/folder`,
      "GET",
      apiKey
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  server.tool(
    "createFolder",
    { spaceId: z.string(), name: z.string() },
    async ({ spaceId, name }) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        return { content: [{ type: "text", text: "API key missing." }] };
      }
      const result = await callClickUpApi(
        `space/${spaceId}/folder`,
        "POST",
        apiKey,
        { name }
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool("getFolder", { folderId: z.string() }, async ({ folderId }) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return { content: [{ type: "text", text: "API key missing." }] };
    }
    const result = await callClickUpApi(`folder/${folderId}`, "GET", apiKey);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  server.tool(
    "updateFolder",
    { folderId: z.string(), name: z.string() },
    async ({ folderId, name }) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        return { content: [{ type: "text", text: "API key missing." }] };
      }
      const result = await callClickUpApi(`folder/${folderId}`, "PUT", apiKey, {
        name,
      });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "deleteFolder",
    { folderId: z.string() },
    async ({ folderId }) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        return { content: [{ type: "text", text: "API key missing." }] };
      }
      const result = await callClickUpApi(
        `folder/${folderId}`,
        "DELETE",
        apiKey
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
