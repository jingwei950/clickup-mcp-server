import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
}
