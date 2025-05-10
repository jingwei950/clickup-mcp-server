import { z } from "zod";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerListTools(
  server: McpServer,
  getApiKey: () => string,
  callClickUpApi: (
    path: string,
    method: string,
    apiKey: string,
    body?: any
  ) => Promise<any>
) {
  server.tool("getLists", { folderId: z.string() }, async ({ folderId }) => {
    const apiKey = getApiKey();
    if (!apiKey)
      return { content: [{ type: "text", text: "API key missing." }] };
    const result = await callClickUpApi(
      `folder/${folderId}/list`,
      "GET",
      apiKey
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  server.tool(
    "createList",
    {
      folderId: z.string(),
      name: z.string(),
      content: z.string().optional(),
    },
    async ({ folderId, name, content: listContent }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const result = await callClickUpApi(
        `folder/${folderId}/list`,
        "POST",
        apiKey,
        { name, content: listContent }
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "getFolderlessList",
    { spaceId: z.string() },
    async ({ spaceId }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const result = await callClickUpApi(
        `space/${spaceId}/list`,
        "GET",
        apiKey
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool("getList", { listId: z.string() }, async ({ listId }) => {
    const apiKey = getApiKey();
    if (!apiKey)
      return { content: [{ type: "text", text: "API key missing." }] };
    const result = await callClickUpApi(`list/${listId}`, "GET", apiKey);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  server.tool(
    "updateList",
    {
      listId: z.string(),
      name: z.string().optional(),
      content: z.string().optional(),
      dueDate: z.number().optional(),
      dueDateTime: z.boolean().optional(),
      priority: z.number().optional(),
      assignee: z.string().optional(),
      status: z.string().optional(),
      unsetStatus: z.boolean().optional(),
    },
    async ({
      listId,
      name,
      content,
      dueDate,
      dueDateTime,
      priority,
      assignee,
      status,
      unsetStatus,
    }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const body: any = {};
      if (name !== undefined) body.name = name;
      if (content !== undefined) body.content = content;
      if (dueDate !== undefined) body.due_date = dueDate;
      if (dueDateTime !== undefined) body.due_date_time = dueDateTime;
      if (priority !== undefined) body.priority = priority;
      if (assignee !== undefined) body.assignee = assignee;
      if (status !== undefined) body.status = status;
      if (unsetStatus !== undefined) body.unset_status = unsetStatus;
      const result = await callClickUpApi(
        `list/${listId}`,
        "PUT",
        apiKey,
        body
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool("deleteList", { listId: z.string() }, async ({ listId }) => {
    const apiKey = getApiKey();
    if (!apiKey)
      return { content: [{ type: "text", text: "API key missing." }] };
    const result = await callClickUpApi(`list/${listId}`, "DELETE", apiKey);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  // Resource: fetch a list's metadata
  server.resource(
    "clickup_list",
    new ResourceTemplate("clickup://list/{list_id}", { list: undefined }),
    async (uri, { list_id }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ error: "API key missing." }),
            },
          ],
        };
      const result = await callClickUpApi(`list/${list_id}`, "GET", apiKey);
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

  // Resource: fetch all lists in a folder
  server.resource(
    "clickup_folder_lists",
    new ResourceTemplate("clickup://folder/{folder_id}/lists", {
      list: undefined,
    }),
    async (uri, { folder_id }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ error: "API key missing." }),
            },
          ],
        };
      const result = await callClickUpApi(
        `folder/${folder_id}/list`,
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

  // Resource: fetch all folderless lists in a space
  server.resource(
    "clickup_space_lists",
    new ResourceTemplate("clickup://space/{space_id}/lists", {
      list: undefined,
    }),
    async (uri, { space_id }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ error: "API key missing." }),
            },
          ],
        };
      const result = await callClickUpApi(
        `space/${space_id}/list`,
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
}
