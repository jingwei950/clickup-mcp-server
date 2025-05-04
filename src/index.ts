import { McpAgent } from "agents/mcp";
import { unstable_context as context } from "agents";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define environment type for Cloudflare Worker bindings
type Env = {
  CLICKUP_API_KEY: string;
};

// Helper function to call the ClickUp API
async function callClickUpApi(
  path: string,
  method: string,
  apiKey: string,
  body?: any
) {
  const apiVersion = path.startsWith("/v3") ? "v3" : "v2";
  const baseUrl = `https://api.clickup.com/api/${apiVersion}`;
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Authorization: apiKey,
    "Content-Type": "application/json",
  };
  const options: RequestInit = { method, headers };

  if (body && ["POST", "PUT", "PATCH"].includes(method)) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData, status: response.status };
    }
    return await response.json();
  } catch (error: any) {
    return { error: error.message || "Unknown error occurred" };
  }
}

// MCPAgent extension to host ClickUp tools
export class MyMCP extends McpAgent<Env> {
  server = new McpServer({
    name: "ClickUp MCP",
    version: "1.0.0",
  });

  async init() {
    // Helper to retrieve API key from either header or environment
    const getApiKey = () => {
      const store = context.getStore();
      const headerKey = store?.request?.headers.get("X-ClickUp-API-Key") || "";
      return headerKey || this.env.CLICKUP_API_KEY;
    };

    // Authorized User
    this.server.tool("getAuthorizedUser", {}, async () => {
      const apiKey = getApiKey();
      if (!apiKey) {
        return {
          content: [
            {
              type: "text",
              text: "API key missing. Set 'CLICKUP_API_KEY' binding or 'X-ClickUp-API-Key' header.",
            },
          ],
        };
      }
      const result = await callClickUpApi("user", "GET", apiKey);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });

    // Workspaces
    this.server.tool("getWorkspaces", {}, async () => {
      const apiKey = getApiKey();
      if (!apiKey) {
        return {
          content: [
            {
              type: "text",
              text: "API key missing. Set 'CLICKUP_API_KEY' binding or 'X-ClickUp-API-Key' header.",
            },
          ],
        };
      }
      const result = await callClickUpApi("team", "GET", apiKey);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });

    // Spaces
    this.server.tool(
      "getSpaces",
      {
        team_id: z.number(),
        archived: z.boolean().optional(),
      },
      async ({ team_id, archived }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const query = archived !== undefined ? `?archived=${archived}` : "";
        const result = await callClickUpApi(
          `team/${team_id}/space${query}`,
          "GET",
          apiKey
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
    this.server.tool(
      "createSpace",
      {
        workspaceId: z.string(),
        name: z.string(),
        multiple_assignees: z.boolean(),
        features: z.object({
          due_dates: z.object({ enabled: z.boolean() }),
          time_tracking: z.object({ enabled: z.boolean() }),
          tags: z.object({ enabled: z.boolean() }),
          time_estimates: z.object({ enabled: z.boolean() }),
          checklists: z.object({ enabled: z.boolean() }),
          custom_fields: z.object({ enabled: z.boolean() }),
          remap_dependencies: z.object({ enabled: z.boolean() }),
          dependency_warning: z.object({ enabled: z.boolean() }),
          portfolios: z.object({ enabled: z.boolean() }),
        }),
      },
      async ({ workspaceId, name, multiple_assignees, features }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const payload = { name, multiple_assignees, features };
        const result = await callClickUpApi(
          `team/${workspaceId}/space`,
          "POST",
          apiKey,
          payload
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
    this.server.tool(
      "getSpace",
      { spaceId: z.string() },
      async ({ spaceId }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const result = await callClickUpApi(`space/${spaceId}`, "GET", apiKey);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
    this.server.tool(
      "updateSpace",
      {
        spaceId: z.string(),
        name: z.string(),
        color: z.string().optional(),
        private: z.boolean(),
        admin_can_manage: z.boolean().optional(),
        multiple_assignees: z.boolean().optional(),
        features: z.object({
          due_dates: z.object({ enabled: z.boolean() }),
          time_tracking: z.object({ enabled: z.boolean() }),
          tags: z.object({ enabled: z.boolean() }),
          time_estimates: z.object({ enabled: z.boolean() }),
          checklists: z.object({ enabled: z.boolean() }),
          custom_fields: z.object({ enabled: z.boolean() }),
          remap_dependencies: z.object({ enabled: z.boolean() }),
          dependency_warning: z.object({ enabled: z.boolean() }),
          portfolios: z.object({ enabled: z.boolean() }),
        }),
      },
      async ({
        spaceId,
        name,
        color,
        private: isPrivate,
        admin_can_manage,
        multiple_assignees,
        features,
      }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const payload = {
          name,
          color: color || "#7B68EE",
          private: isPrivate,
          admin_can_manage,
          multiple_assignees,
          features,
        };
        const result = await callClickUpApi(
          `space/${spaceId}`,
          "PUT",
          apiKey,
          payload
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
    this.server.tool(
      "deleteSpace",
      { spaceId: z.string() },
      async ({ spaceId }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const result = await callClickUpApi(
          `space/${spaceId}`,
          "DELETE",
          apiKey
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Folders
    this.server.tool(
      "getFolders",
      { spaceId: z.string() },
      async ({ spaceId }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const result = await callClickUpApi(
          `space/${spaceId}/folder`,
          "GET",
          apiKey
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
    this.server.tool(
      "createFolder",
      { spaceId: z.string(), name: z.string() },
      async ({ spaceId, name }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const result = await callClickUpApi(
          `space/${spaceId}/folder`,
          "POST",
          apiKey,
          { name }
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
    // Get a specific folder by ID
    this.server.tool(
      "getFolder",
      { folderId: z.string() },
      async ({ folderId }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const result = await callClickUpApi(
          `folder/${folderId}`,
          "GET",
          apiKey
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Update a folder (rename)
    this.server.tool(
      "updateFolder",
      { folderId: z.string(), name: z.string() },
      async ({ folderId, name }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const result = await callClickUpApi(
          `folder/${folderId}`,
          "PUT",
          apiKey,
          { name }
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Delete a folder
    this.server.tool(
      "deleteFolder",
      { folderId: z.string() },
      async ({ folderId }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const result = await callClickUpApi(
          `folder/${folderId}`,
          "DELETE",
          apiKey
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Lists
    this.server.tool(
      "getLists",
      { folderId: z.string() },
      async ({ folderId }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const result = await callClickUpApi(
          `folder/${folderId}/list`,
          "GET",
          apiKey
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
    this.server.tool(
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
    this.server.tool(
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

    // Tasks
    this.server.tool(
      "getTasks",
      {
        listId: z.string(),
        page: z.number().optional(),
        statuses: z.array(z.string()).optional(),
        assignees: z.array(z.string()).optional(),
      },
      async ({ listId, ...params }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const query = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
          if (Array.isArray(v)) v.forEach((x) => query.append(k, x));
          else if (v !== undefined) query.append(k, String(v));
        });
        const qstr = query.toString() ? `?${query.toString()}` : "";
        const result = await callClickUpApi(
          `list/${listId}/task${qstr}`,
          "GET",
          apiKey
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
    this.server.tool(
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
    this.server.tool("getTask", { taskId: z.string() }, async ({ taskId }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const result = await callClickUpApi(`task/${taskId}`, "GET", apiKey);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });
    this.server.tool(
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
    this.server.tool(
      "deleteTask",
      { taskId: z.string() },
      async ({ taskId }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const result = await callClickUpApi(`task/${taskId}`, "DELETE", apiKey);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Docs
    this.server.tool(
      "searchDocs",
      {
        workspaceId: z.string(),
        query: z.string().optional(),
        page: z.number().optional(),
      },
      async ({ workspaceId, query, page }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const qs = new URLSearchParams();
        if (query) qs.set("query", query);
        if (page !== undefined) qs.set("page", String(page));
        const qstr = qs.toString() ? `?${qs.toString()}` : "";
        const result = await callClickUpApi(
          `team/${workspaceId}/doc${qstr}`,
          "GET",
          apiKey
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
    this.server.tool(
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
    this.server.tool("getDoc", { docId: z.string() }, async ({ docId }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };
      const result = await callClickUpApi(`doc/${docId}`, "GET", apiKey);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });

    // Comments
    this.server.tool(
      "getTaskComments",
      { taskId: z.string() },
      async ({ taskId }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const result = await callClickUpApi(
          `task/${taskId}/comment`,
          "GET",
          apiKey
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
    this.server.tool(
      "createTaskComment",
      {
        taskId: z.string(),
        comment_text: z.string(),
        assignee: z.string().optional(),
        notify_all: z.boolean().optional(),
      },
      async ({ taskId, comment_text, assignee, notify_all }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const commentData: any = { comment_text };
        if (assignee) commentData.assignee = assignee;
        if (notify_all !== undefined) commentData.notify_all = notify_all;
        const result = await callClickUpApi(
          `task/${taskId}/comment`,
          "POST",
          apiKey,
          commentData
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
  }
}

// Cloudflare Worker entrypoint
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    // Route SSE endpoint
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return MyMCP.serveSSE("/sse", { binding: "MCP_OBJECT" }).fetch(
        request,
        env as any,
        ctx
      );
    }
    // Route JSON-RPC endpoint
    if (url.pathname === "/mcp") {
      return MyMCP.serve("/mcp", { binding: "MCP_OBJECT" }).fetch(
        request,
        env as any,
        ctx
      );
    }
    return new Response("Not found", { status: 404 });
  },
};
