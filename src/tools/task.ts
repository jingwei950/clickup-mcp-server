import { z } from "zod";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";

const convertEpochToSGT = (epochMs: number): string => {
  const offsetMs = epochMs + 8 * 60 * 60 * 1000;
  const dt = new Date(offsetMs);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  const hours = String(dt.getUTCHours()).padStart(2, "0");
  const minutes = String(dt.getUTCMinutes()).padStart(2, "0");
  const seconds = String(dt.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

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
  // Prompt for getTasks tool: instruct using 13-digit Unix timestamps with default Asia/Singapore (SGT) timezone
  server.prompt(
    "getTasks",
    "When calling the getTasks tool, include any time-based filter parameters as 13-digit Unix timestamps (ms since epoch) in the user's timezone. If no timezone is provided, default to Asia/Singapore (SGT). If only filtering by date_closed, do not add due_date, date_created, or date_done filters unless explicitly requested.",
    { timezone: z.string().optional() },
    ({ timezone }) => {
      const tz = timezone ?? "Asia/Singapore (SGT)";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Convert all date/time filter parameters to 13-digit Unix timestamps (ms since epoch) in timezone ${tz} when calling getTasks. If only filtering by date_closed, do not add due_date, date_created, or date_done filters unless explicitly requested.`,
            },
          },
        ],
      };
    }
  );

  // Resource: fetch a single task's metadata
  server.resource(
    "clickup_list_tasks",
    new ResourceTemplate("clickup://list/{list_id}/tasks", { list: undefined }),
    {
      description: "Fetch tasks/subtasks for a specific list",
      mimeType: "application/json",
    },
    async (uri, { list_id }) => {
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
        `list/${list_id}/task`,
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
    "getTasks",
    "Retrieve tasks/subtasks for a ClickUp list. When using time-based filters (due_date_gt, date_created_lt, etc.), supply 13-digit Unix timestamps (ms since epoch) in the user's timezone (default Asia/Singapore (SGT)). Do not include other date filters (due_date, date_created, date_done) unless explicitly requested.",
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
      // Enforce 13-digit Unix timestamp format for time-based filters
      const p = params as Record<string, any>;
      const timeFilters = [
        "due_date_gt",
        "due_date_lt",
        "date_created_gt",
        "date_created_lt",
        "date_updated_gt",
        "date_updated_lt",
        "date_done_gt",
        "date_done_lt",
      ];
      const invalidFilters = timeFilters.filter(
        (key) => p[key] !== undefined && String(p[key]).length !== 13
      );
      if (invalidFilters.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: `Please provide 13-digit Unix timestamps (milliseconds) for the following filters: ${invalidFilters.join(
                ", "
              )}`,
            },
          ],
        };
      }
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
      const convertedTasks = (result.tasks || []).map((task: any) => {
        const converted = { ...task };
        [
          "date_created",
          "date_updated",
          "due_date",
          "date_closed",
          "start_date",
        ].forEach((field) => {
          if (task[field]) {
            converted[`${field}_sgt`] = convertEpochToSGT(task[field]);
          }
        });
        return converted;
      });
      const convertedResult = { ...result, tasks: convertedTasks };
      return {
        content: [{ type: "text", text: JSON.stringify(convertedResult) }],
      };
    }
  );

  server.tool(
    "createTask",
    "Create a new task in the specified list",
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

  server.tool(
    "getTask",
    "Fetch metadata for a specific task",
    { taskId: z.string() },
    async ({ taskId }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const result = await callClickUpApi(`task/${taskId}`, "GET", apiKey);
      const dateFields = [
        "date_created",
        "date_updated",
        "due_date",
        "date_closed",
        "start_date",
      ];
      const convertedTask: any = { ...result };
      dateFields.forEach((field) => {
        if (result[field]) {
          convertedTask[`${field}_sgt`] = convertEpochToSGT(result[field]);
        }
      });
      return {
        content: [{ type: "text", text: JSON.stringify(convertedTask) }],
      };
    }
  );

  server.tool(
    "updateTask",
    "Update properties of a specific task",
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

  server.tool(
    "deleteTask",
    "Delete a specific task",
    { taskId: z.string() },
    async ({ taskId }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const result = await callClickUpApi(`task/${taskId}`, "DELETE", apiKey);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }
  );

  server.resource(
    "clickup_task",
    new ResourceTemplate("clickup://task/{task_id}", { list: undefined }),
    {
      description: "Fetch metadata for a specific task",
      mimeType: "application/json",
    },
    async (uri, { task_id }) => {
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
      const result = await callClickUpApi(`task/${task_id}`, "GET", apiKey);
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
