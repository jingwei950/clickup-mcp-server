import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerTaskTools(
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
    "getTasks",
    {
      list_id: z.number(),
      archived: z.boolean().optional(),
      include_markdown_description: z.boolean().optional(),
      page: z.number().optional(),
      order_by: z.string().optional(),
      reverse: z.boolean().optional(),
      subtasks: z.boolean().optional(),
      statuses: z.array(z.string()).optional(),
      include_closed: z.boolean().optional(),
      assignees: z.array(z.string()).optional(),
      watchers: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      due_date_gt: z.number().optional(),
      due_date_lt: z.number().optional(),
      date_created_gt: z.number().optional(),
      date_created_lt: z.number().optional(),
      date_updated_gt: z.number().optional(),
      date_updated_lt: z.number().optional(),
      date_done_gt: z.number().optional(),
      date_done_lt: z.number().optional(),
      custom_fields: z.array(z.string()).optional(),
      custom_field: z.array(z.string()).optional(),
      custom_items: z.array(z.number()).optional(),
    },
    async ({ list_id, ...params }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (Array.isArray(v)) v.forEach((x) => query.append(k, String(x)));
        else if (v !== undefined) query.append(k, String(v));
      });
      const qstr = query.toString() ? `?${query.toString()}` : "";
      const result = await callClickUpApi(
        `list/${list_id}/task${qstr}`,
        "GET",
        apiKey
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    "createTask",
    {
      listId: z.string(),
      name: z.string(),
      description: z.string().optional(),
      status: z.string().optional(),
      priority: z.number().optional(),
      dueDate: z.number().optional(),
      assignees: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    },
    async ({ listId, ...taskData }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const result = await callClickUpApi(
        `list/${listId}/task`,
        "POST",
        apiKey,
        taskData
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool("getTask", { taskId: z.string() }, async ({ taskId }) => {
    const apiKey = getApiKey();
    if (!apiKey)
      return { content: [{ type: "text", text: "API key missing." }] };
    const result = await callClickUpApi(`task/${taskId}`, "GET", apiKey);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  server.tool(
    "updateTask",
    {
      taskId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      priority: z.number().optional(),
      dueDate: z.number().optional(),
    },
    async ({ taskId, ...taskData }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const result = await callClickUpApi(
        `task/${taskId}`,
        "PUT",
        apiKey,
        taskData
      );
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.tool("deleteTask", { taskId: z.string() }, async ({ taskId }) => {
    const apiKey = getApiKey();
    if (!apiKey)
      return { content: [{ type: "text", text: "API key missing." }] };
    const result = await callClickUpApi(`task/${taskId}`, "DELETE", apiKey);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });
}
