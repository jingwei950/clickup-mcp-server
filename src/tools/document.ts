import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDocTools(
  server: McpServer,
  getApiKey: () => string,
  callClickUpApi: (
    path: string,
    method: string,
    apiKey: string,
    body?: any
  ) => Promise<any>
) {
  server.tool(
    "searchDocs",
    {
      workspaceId: z.number(),
      id: z.string().optional(),
      creator: z.number().optional(),
      deleted: z.boolean().optional(),
      archived: z.boolean().optional(),
      parent_id: z.string().optional(),
      parent_type: z.string().optional(),
      limit: z.number().optional(),
      next_cursor: z.string().optional(),
    },
    async ({
      workspaceId,
      id,
      creator,
      deleted,
      archived,
      parent_id,
      parent_type,
      limit,
      next_cursor,
    }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const qs = new URLSearchParams();
      if (id) qs.set("id", id);
      if (creator !== undefined) qs.set("creator", String(creator));
      qs.set("deleted", String(deleted ?? false));
      qs.set("archived", String(archived ?? false));
      if (parent_id) qs.set("parent_id", parent_id);
      if (parent_type) qs.set("parent_type", parent_type);
      qs.set("limit", String(limit ?? 50));
      if (next_cursor) qs.set("next_cursor", next_cursor);
      const qstr = qs.toString() ? `?${qs.toString()}` : "";
      const result = await callClickUpApi(
        `/v3/workspaces/${workspaceId}/docs${qstr}`,
        "GET",
        apiKey
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "createDoc",
    {
      workspaceId: z.string(),
      title: z.string(),
      content: z.string().optional(),
      parentDoc: z.string().optional(),
    },
    async ({ workspaceId, title, content: bodyContent, parentDoc }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const docData: any = { title };
      if (bodyContent) docData.content = bodyContent;
      if (parentDoc) docData.parentDoc = parentDoc;
      const result = await callClickUpApi(
        `team/${workspaceId}/doc`,
        "POST",
        apiKey,
        docData
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "getDoc",
    { workspaceId: z.number(), docId: z.string() },
    async ({ workspaceId, docId }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const result = await callClickUpApi(
        `/v3/workspaces/${workspaceId}/docs/${docId}`,
        "GET",
        apiKey
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "getDocPages",
    {
      workspaceId: z.number(),
      docId: z.string(),
      max_page_depth: z.number().optional(),
      content_format: z.string().optional(),
    },
    async ({ workspaceId, docId, max_page_depth, content_format }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const qs = new URLSearchParams();
      qs.set("max_page_depth", String(max_page_depth ?? -1));
      qs.set("content_format", content_format ?? "text/md");
      const qstr = qs.toString() ? `?${qs.toString()}` : "";
      const result = await callClickUpApi(
        `/v3/workspaces/${workspaceId}/docs/${docId}/pages${qstr}`,
        "GET",
        apiKey
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );
}
