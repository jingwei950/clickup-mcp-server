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
  // Choose version and adjust path for v3 endpoints
  let apiVersion = "v2";
  let endpointPath = path;
  if (path.startsWith("/v3")) {
    apiVersion = "v3";
    // drop leading '/v3' so we don't duplicate it in the URL
    endpointPath = path.slice(3);
  }
  const baseUrl = `https://api.clickup.com/api/${apiVersion}`;
  const url = `${baseUrl}${
    endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`
  }`;

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
      { teamId: z.number(), archived: z.boolean().optional() },
      async ({ teamId, archived }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const query = archived !== undefined ? `?archived=${archived}` : "";
        const result = await callClickUpApi(
          `team/${teamId}/space${query}`,
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
        multipleAssignees: z.boolean(),
        features: z.object({
          dueDates: z.object({ enabled: z.boolean() }),
          timeTracking: z.object({ enabled: z.boolean() }),
          tags: z.object({ enabled: z.boolean() }),
          timeEstimates: z.object({ enabled: z.boolean() }),
          checklists: z.object({ enabled: z.boolean() }),
          customFields: z.object({ enabled: z.boolean() }),
          remapDependencies: z.object({ enabled: z.boolean() }),
          dependencyWarning: z.object({ enabled: z.boolean() }),
          portfolios: z.object({ enabled: z.boolean() }),
        }),
      },
      async ({ workspaceId, name, multipleAssignees, features }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const payload = {
          name,
          multiple_assignees: multipleAssignees,
          features: {
            due_dates: features.dueDates,
            time_tracking: features.timeTracking,
            tags: features.tags,
            time_estimates: features.timeEstimates,
            checklists: features.checklists,
            custom_fields: features.customFields,
            remap_dependencies: features.remapDependencies,
            dependency_warning: features.dependencyWarning,
            portfolios: features.portfolios,
          },
        };
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
        isPrivate: z.boolean(),
        adminCanManage: z.boolean().optional(),
        multipleAssignees: z.boolean().optional(),
        features: z.object({
          dueDates: z.object({ enabled: z.boolean() }),
          timeTracking: z.object({ enabled: z.boolean() }),
          tags: z.object({ enabled: z.boolean() }),
          timeEstimates: z.object({ enabled: z.boolean() }),
          checklists: z.object({ enabled: z.boolean() }),
          customFields: z.object({ enabled: z.boolean() }),
          remapDependencies: z.object({ enabled: z.boolean() }),
          dependencyWarning: z.object({ enabled: z.boolean() }),
          portfolios: z.object({ enabled: z.boolean() }),
        }),
      },
      async ({
        spaceId,
        name,
        color,
        isPrivate,
        adminCanManage,
        multipleAssignees,
        features,
      }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const payload = {
          name,
          color: color || "#7B68EE",
          private: isPrivate,
          admin_can_manage: adminCanManage,
          multiple_assignees: multipleAssignees,
          features: {
            due_dates: features.dueDates,
            time_tracking: features.timeTracking,
            tags: features.tags,
            time_estimates: features.timeEstimates,
            checklists: features.checklists,
            custom_fields: features.customFields,
            remap_dependencies: features.remapDependencies,
            dependency_warning: features.dependencyWarning,
            portfolios: features.portfolios,
          },
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

    this.server.tool("getList", { listId: z.string() }, async ({ listId }) => {
      const apiKey = getApiKey();
      if (!apiKey)
        return { content: [{ type: "text", text: "API key missing." }] };

      const result = await callClickUpApi(`list/${listId}`, "GET", apiKey);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });

    // Add updateList tool under getList
    this.server.tool(
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

    // Add deleteList tool under updateList
    this.server.tool(
      "deleteList",
      { listId: z.string() },
      async ({ listId }) => {
        const apiKey = getApiKey();
        if (!apiKey)
          return { content: [{ type: "text", text: "API key missing." }] };
        const result = await callClickUpApi(`list/${listId}`, "DELETE", apiKey);
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

    this.server.tool(
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

    // Add getDocPages tool to list pages of a Doc
    this.server.tool(
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
