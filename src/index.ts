import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define environment type
interface Env {
  CLICKUP_API_KEY: string;
}

// Global storage for API key to ensure it's accessible everywhere
let GLOBAL_CLICKUP_API_KEY: string | undefined;

// Helper function to make API calls to ClickUp
async function callClickUpApi(
  path: string,
  method: string,
  apiKey: string,
  body?: any
) {
  const apiVersion = path.startsWith("/v3") ? "v3" : "v2";
  const baseUrl = `https://api.clickup.com/api/${apiVersion}`;
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = {
    Authorization: apiKey,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
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

// Define our MCP agent with ClickUp tools
export class MyMCP extends McpAgent {
  server = new McpServer({
    name: "ClickUp MCP",
    version: "1.0.0",
  });

  // Store environment variables
  public static clickupApiKey: string | undefined;

  // Override DO initialization to pick up API key from the DO environment
  async _init(props: any) {
    // If the DO environment has the API key, set it on the class and global variable
    if ((this as any).env?.CLICKUP_API_KEY) {
      GLOBAL_CLICKUP_API_KEY = (this as any).env.CLICKUP_API_KEY;
      MyMCP.clickupApiKey = (this as any).env.CLICKUP_API_KEY;
      console.log(
        "API key set from DO env in _init:",
        !!GLOBAL_CLICKUP_API_KEY
      );
    }
    // Proceed with base initialization logic (props storage and init)
    await super._init(props);
  }

  async init(options?: any) {
    console.log("Init options:", JSON.stringify(options || {}, null, 2));

    // Check for API key in the static property
    if (MyMCP.clickupApiKey) {
      GLOBAL_CLICKUP_API_KEY = MyMCP.clickupApiKey;
      console.log(
        "API key set from static property:",
        !!GLOBAL_CLICKUP_API_KEY
      );
    }
    // Set the global API key from options if available
    else if (options?.env?.CLICKUP_API_KEY) {
      GLOBAL_CLICKUP_API_KEY = options.env.CLICKUP_API_KEY;
      console.log("API key set from options.env:", !!GLOBAL_CLICKUP_API_KEY);
    }

    // Try to get API key from request headers
    try {
      const request = options?.request || options?.req;
      if (request && request.headers && request.headers.get) {
        const headerApiKey = request.headers.get("X-ClickUp-API-Key");
        if (headerApiKey) {
          GLOBAL_CLICKUP_API_KEY = headerApiKey;
          console.log(
            "API key set from request header:",
            !!GLOBAL_CLICKUP_API_KEY
          );
        }
      }
    } catch (e) {
      console.error("Error getting API key from request headers:", e);
    }

    // Log global API key availability
    console.log(
      "In init - Global API Key available:",
      !!GLOBAL_CLICKUP_API_KEY
    );

    // Workspaces tools
    this.server.tool("getWorkspaces", {}, async (_args: any, extra: any) => {
      console.log(
        "Extra object in getWorkspaces:",
        JSON.stringify(extra || {}, null, 2)
      );

      let apiKey: string | undefined;

      // Priority 1: Check extra.env (passed via serve options)
      if (extra?.env?.CLICKUP_API_KEY) {
        apiKey = extra.env.CLICKUP_API_KEY;
        console.log("Found API key in extra.env");
      }

      // Priority 2: Check request headers in extra object
      if (!apiKey) {
        try {
          const request = extra?.request || extra?.req;
          if (request && request.headers && request.headers.get) {
            const headerApiKey = request.headers.get("X-ClickUp-API-Key");
            if (headerApiKey) {
              apiKey = headerApiKey;
              console.log("Found API key in extra request header");
            }
          }
        } catch (e) {
          console.error("Error checking extra request headers:", e);
        }
      }

      // Priority 3: Fallback to static class property (set in fetch)
      if (!apiKey && MyMCP.clickupApiKey) {
        apiKey = MyMCP.clickupApiKey;
        console.log("Using API key from static property as fallback");
      }

      // Priority 4: Fallback to global variable (set in fetch)
      if (!apiKey && GLOBAL_CLICKUP_API_KEY) {
        apiKey = GLOBAL_CLICKUP_API_KEY;
        console.log("Using API key from global variable as fallback");
      }

      if (!apiKey) {
        console.error("API Key is missing in getWorkspaces context.");
        return {
          content: [
            {
              type: "text",
              text: "API key could not be found in the execution context. Ensure CLICKUP_API_KEY is set correctly.",
            },
          ],
        };
      }

      console.log("Using API key for call (getWorkspaces)");
      const result = await callClickUpApi("team", "GET", apiKey);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });

    // Spaces tools
    this.server.tool(
      "getSpaces",
      { workspaceId: z.string() },
      async ({ workspaceId }: { workspaceId: string }, extra: any) => {
        // Try both sources for API key
        const apiKey = GLOBAL_CLICKUP_API_KEY || MyMCP.clickupApiKey;

        if (!apiKey)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `team/${workspaceId}/space`,
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
        features: z
          .object({
            lists: z.object({ enabled: z.boolean() }).optional(),
            tasks: z.object({ enabled: z.boolean() }).optional(),
            docs: z.object({ enabled: z.boolean() }).optional(),
            whiteboards: z.object({ enabled: z.boolean() }).optional(),
          })
          .optional(),
      },
      async (args: any, extra: any) => {
        const { workspaceId, name, features } = args;
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `team/${workspaceId}/space`,
          "POST",
          GLOBAL_CLICKUP_API_KEY,
          { name, features }
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      "getSpace",
      { spaceId: z.string() },
      async ({ spaceId }: { spaceId: string }, extra: any) => {
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `space/${spaceId}`,
          "GET",
          GLOBAL_CLICKUP_API_KEY
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      "updateSpace",
      {
        spaceId: z.string(),
        name: z.string().optional(),
        features: z
          .object({
            lists: z.object({ enabled: z.boolean() }).optional(),
            tasks: z.object({ enabled: z.boolean() }).optional(),
            docs: z.object({ enabled: z.boolean() }).optional(),
            whiteboards: z.object({ enabled: z.boolean() }).optional(),
          })
          .optional(),
      },
      async (args: any, extra: any) => {
        const { spaceId, ...data } = args;
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `space/${spaceId}`,
          "PUT",
          GLOBAL_CLICKUP_API_KEY,
          data
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      "deleteSpace",
      { spaceId: z.string() },
      async ({ spaceId }: { spaceId: string }, extra: any) => {
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `space/${spaceId}`,
          "DELETE",
          GLOBAL_CLICKUP_API_KEY
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Folders tools
    this.server.tool(
      "getFolders",
      { spaceId: z.string() },
      async ({ spaceId }: { spaceId: string }, extra: any) => {
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `space/${spaceId}/folder`,
          "GET",
          GLOBAL_CLICKUP_API_KEY
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      "createFolder",
      {
        spaceId: z.string(),
        name: z.string(),
      },
      async (
        { spaceId, name }: { spaceId: string; name: string },
        extra: any
      ) => {
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `space/${spaceId}/folder`,
          "POST",
          GLOBAL_CLICKUP_API_KEY,
          { name }
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Lists tools
    this.server.tool(
      "getLists",
      { folderId: z.string() },
      async ({ folderId }: { folderId: string }, extra: any) => {
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `folder/${folderId}/list`,
          "GET",
          GLOBAL_CLICKUP_API_KEY
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      "getFolderlessList",
      { spaceId: z.string() },
      async ({ spaceId }: { spaceId: string }, extra: any) => {
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `space/${spaceId}/list`,
          "GET",
          GLOBAL_CLICKUP_API_KEY
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
      async (args: any, extra: any) => {
        const { folderId, name, content } = args;
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `folder/${folderId}/list`,
          "POST",
          GLOBAL_CLICKUP_API_KEY,
          { name, content }
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Tasks tools
    this.server.tool(
      "getTasks",
      {
        listId: z.string(),
        page: z.number().optional(),
        statuses: z.array(z.string()).optional(),
        assignees: z.array(z.string()).optional(),
      },
      async (args: any, extra: any) => {
        const { listId, ...params } = args;
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach((v) => queryParams.append(key, v));
          } else if (value !== undefined) {
            queryParams.append(key, String(value));
          }
        });

        const query = queryParams.toString()
          ? `?${queryParams.toString()}`
          : "";
        const result = await callClickUpApi(
          `list/${listId}/task${query}`,
          "GET",
          GLOBAL_CLICKUP_API_KEY
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
      async (args: any, extra: any) => {
        const { listId, ...taskData } = args;
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `list/${listId}/task`,
          "POST",
          GLOBAL_CLICKUP_API_KEY,
          taskData
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      "getTask",
      { taskId: z.string() },
      async ({ taskId }: { taskId: string }, extra: any) => {
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `task/${taskId}`,
          "GET",
          GLOBAL_CLICKUP_API_KEY
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

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
      async (args: any, extra: any) => {
        const { taskId, ...taskData } = args;
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `task/${taskId}`,
          "PUT",
          GLOBAL_CLICKUP_API_KEY,
          taskData
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      "deleteTask",
      { taskId: z.string() },
      async ({ taskId }: { taskId: string }, extra: any) => {
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `task/${taskId}`,
          "DELETE",
          GLOBAL_CLICKUP_API_KEY
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Docs tools
    this.server.tool(
      "searchDocs",
      {
        workspaceId: z.string(),
        query: z.string().optional(),
        page: z.number().optional(),
      },
      async (args: any, extra: any) => {
        const { workspaceId, ...params } = args;
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, String(value));
          }
        });

        const query = queryParams.toString()
          ? `?${queryParams.toString()}`
          : "";
        const result = await callClickUpApi(
          `team/${workspaceId}/doc${query}`,
          "GET",
          GLOBAL_CLICKUP_API_KEY
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
      async (args: any, extra: any) => {
        const { workspaceId, ...docData } = args;
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `team/${workspaceId}/doc`,
          "POST",
          GLOBAL_CLICKUP_API_KEY,
          docData
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    this.server.tool(
      "getDoc",
      { docId: z.string() },
      async ({ docId }: { docId: string }, extra: any) => {
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `doc/${docId}`,
          "GET",
          GLOBAL_CLICKUP_API_KEY
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Comments tools
    this.server.tool(
      "getTaskComments",
      { taskId: z.string() },
      async ({ taskId }: { taskId: string }, extra: any) => {
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `task/${taskId}/comment`,
          "GET",
          GLOBAL_CLICKUP_API_KEY
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
      async (args: any, extra: any) => {
        const { taskId, ...commentData } = args;
        if (!GLOBAL_CLICKUP_API_KEY)
          return { content: [{ type: "text", text: "API key not provided" }] };

        const result = await callClickUpApi(
          `task/${taskId}/comment`,
          "POST",
          GLOBAL_CLICKUP_API_KEY,
          commentData
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    console.log(
      "Incoming request - CLICKUP_API_KEY available:",
      !!env.CLICKUP_API_KEY
    );

    // Set the global API key directly
    GLOBAL_CLICKUP_API_KEY = env.CLICKUP_API_KEY;
    console.log("API key set globally:", !!GLOBAL_CLICKUP_API_KEY);

    // Explicitly set on MyMCP class as well
    MyMCP.clickupApiKey = env.CLICKUP_API_KEY;
    console.log("API key set on class:", !!MyMCP.clickupApiKey);

    // Save the API key in the headers for the SSE context
    const modifiedRequest = new Request(request.url, {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
    });
    modifiedRequest.headers.set("X-ClickUp-API-Key", env.CLICKUP_API_KEY || "");

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      // @ts-ignore - Force type to work with Cloudflare
      return MyMCP.serveSSE("/sse", {
        // Use binding for any potential DO binding
      }).fetch(modifiedRequest, env as any, ctx);
    }

    if (url.pathname === "/mcp") {
      // @ts-ignore - Force type to work with Cloudflare
      return MyMCP.serve("/mcp", {
        // Use binding for any potential DO binding
      }).fetch(modifiedRequest, env as any, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};
