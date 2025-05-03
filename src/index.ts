import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define interface for Cloudflare Worker environment
interface Env {
  OAUTH_KV: KVNamespace;
  MCP_OBJECT: DurableObjectNamespace<MyMCP>;
  ASSETS: Fetcher;
}

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
  server = new McpServer({
    name: "ClickUp API Bridge",
    version: "1.0.0",
  });

  // Access to Cloudflare Worker environment
  env: Env | null = null;

  // Store OAuth tokens in KV
  async saveToken(clientId: string, token: any): Promise<void> {
    if (!this.env || !this.env.OAUTH_KV) {
      console.error("KV namespace not available");
      return;
    }

    try {
      await this.env.OAUTH_KV.put(`token:${clientId}`, JSON.stringify(token));
      console.log(`Token saved for client ${clientId}`);
    } catch (error: any) {
      console.error(`Failed to save token: ${error.message}`);
    }
  }

  async getToken(clientId: string): Promise<any | null> {
    if (!this.env || !this.env.OAUTH_KV) {
      console.error("KV namespace not available");
      return null;
    }

    try {
      const tokenData = await this.env.OAUTH_KV.get(`token:${clientId}`);
      if (!tokenData) {
        console.log(`No token found for client ${clientId}`);
        return null;
      }

      return JSON.parse(tokenData);
    } catch (error: any) {
      console.error(`Failed to retrieve token: ${error.message}`);
      return null;
    }
  }

  // Helper to determine API version for endpoints
  getApiUrl(endpoint: string, version: "v2" | "v3" = "v2"): string {
    return `https://api.clickup.com/api/${version}/${endpoint}`;
  }

  // Helper to make authenticated API calls to ClickUp
  async fetchClickUp(
    endpoint: string,
    accessToken: string,
    options: RequestInit = {},
    version: "v2" | "v3" = "v2"
  ): Promise<any> {
    const url = this.getApiUrl(endpoint, version);
    const headers = {
      Authorization: accessToken,
      "Content-Type": "application/json",
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`ClickUp API error: ${JSON.stringify(errorData)}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error("Error fetching from ClickUp API:", error);
      throw error;
    }
  }

  async init() {
    // Authentication tool
    this.server.tool(
      "auth",
      {
        clientId: z.string(),
        clientSecret: z.string(),
        code: z.string(),
        redirectUri: z.string(),
      },
      async ({ clientId, clientSecret, code, redirectUri }) => {
        try {
          // Exchange code for access token
          const response = await fetch(
            "https://api.clickup.com/api/v2/oauth/token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: "authorization_code",
                redirect_uri: redirectUri,
              }),
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            return {
              content: [
                {
                  type: "text",
                  text: `Authentication failed: ${JSON.stringify(errorData)}`,
                },
              ],
            };
          }

          const tokenData = await response.json();
          // Save token to KV storage
          await this.saveToken(clientId, tokenData);

          return {
            content: [
              {
                type: "text",
                text: "Authentication successful. You can now use the ClickUp API.",
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Authentication error: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    // Get authorized user
    this.server.tool(
      "getAuthorizedUser",
      {
        accessToken: z.string(),
      },
      async ({ accessToken }) => {
        try {
          const userData = await this.fetchClickUp("user", accessToken);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(userData),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching user data: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    // Get authorized workspaces
    this.server.tool(
      "getAuthorizedWorkspaces",
      {
        accessToken: z.string(),
      },
      async ({ accessToken }) => {
        try {
          const workspacesData = await this.fetchClickUp("team", accessToken);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(workspacesData),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching workspaces: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    // === Spaces operations ===
    this.server.tool(
      "getSpaces",
      {
        accessToken: z.string(),
        workspaceId: z.string(),
      },
      async ({ accessToken, workspaceId }) => {
        try {
          const spacesData = await this.fetchClickUp(
            `team/${workspaceId}/space`,
            accessToken
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(spacesData),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching spaces: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    this.server.tool(
      "createSpace",
      {
        accessToken: z.string(),
        workspaceId: z.string(),
        name: z.string(),
        features: z
          .object({
            multiple_assignees: z.boolean().optional(),
            due_dates: z.boolean().optional(),
            time_tracking: z.boolean().optional(),
            priorities: z.boolean().optional(),
            tags: z.boolean().optional(),
            time_estimates: z.boolean().optional(),
            checklists: z.boolean().optional(),
            custom_fields: z.boolean().optional(),
            remap_dependencies: z.boolean().optional(),
            dependency_warning: z.boolean().optional(),
            portfolios: z.boolean().optional(),
          })
          .optional(),
      },
      async ({ accessToken, workspaceId, name, features }) => {
        try {
          const response = await this.fetchClickUp(
            `team/${workspaceId}/space`,
            accessToken,
            {
              method: "POST",
              body: JSON.stringify({
                name,
                features,
              }),
            }
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error creating space: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    this.server.tool(
      "getSpace",
      {
        accessToken: z.string(),
        spaceId: z.string(),
      },
      async ({ accessToken, spaceId }) => {
        try {
          const spaceData = await this.fetchClickUp(
            `space/${spaceId}`,
            accessToken
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(spaceData),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching space: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    this.server.tool(
      "updateSpace",
      {
        accessToken: z.string(),
        spaceId: z.string(),
        name: z.string().optional(),
        features: z
          .object({
            multiple_assignees: z.boolean().optional(),
            due_dates: z.boolean().optional(),
            time_tracking: z.boolean().optional(),
            priorities: z.boolean().optional(),
            tags: z.boolean().optional(),
            time_estimates: z.boolean().optional(),
            checklists: z.boolean().optional(),
            custom_fields: z.boolean().optional(),
            remap_dependencies: z.boolean().optional(),
            dependency_warning: z.boolean().optional(),
            portfolios: z.boolean().optional(),
          })
          .optional(),
      },
      async ({ accessToken, spaceId, name, features }) => {
        try {
          const response = await this.fetchClickUp(
            `space/${spaceId}`,
            accessToken,
            {
              method: "PUT",
              body: JSON.stringify({
                name,
                features,
              }),
            }
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error updating space: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    this.server.tool(
      "deleteSpace",
      {
        accessToken: z.string(),
        spaceId: z.string(),
      },
      async ({ accessToken, spaceId }) => {
        try {
          const response = await this.fetchClickUp(
            `space/${spaceId}`,
            accessToken,
            {
              method: "DELETE",
            }
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error deleting space: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    // === Lists operations ===
    this.server.tool(
      "getLists",
      {
        accessToken: z.string(),
        folderId: z.string().optional(),
        spaceId: z.string().optional(),
      },
      async ({ accessToken, folderId, spaceId }) => {
        try {
          let endpoint;
          if (folderId) {
            endpoint = `folder/${folderId}/list`;
          } else if (spaceId) {
            endpoint = `space/${spaceId}/list`;
          } else {
            throw new Error("Either folderId or spaceId must be provided");
          }

          const listsData = await this.fetchClickUp(endpoint, accessToken);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(listsData),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching lists: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    this.server.tool(
      "createList",
      {
        accessToken: z.string(),
        folderId: z.string().optional(),
        spaceId: z.string().optional(),
        name: z.string(),
        content: z.string().optional(),
        due_date: z.number().optional(),
        due_date_time: z.boolean().optional(),
        priority: z
          .object({
            priority: z.string(),
            color: z.string(),
          })
          .optional(),
        assignee: z.string().optional(),
        status: z.string().optional(),
      },
      async ({ accessToken, folderId, spaceId, ...listData }) => {
        try {
          let endpoint;
          if (folderId) {
            endpoint = `folder/${folderId}/list`;
          } else if (spaceId) {
            endpoint = `space/${spaceId}/list`;
          } else {
            throw new Error("Either folderId or spaceId must be provided");
          }

          const response = await this.fetchClickUp(endpoint, accessToken, {
            method: "POST",
            body: JSON.stringify(listData),
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error creating list: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    // === Tasks operations ===
    this.server.tool(
      "getTasks",
      {
        accessToken: z.string(),
        listId: z.string(),
        page: z.number().optional(),
        order_by: z.string().optional(),
        reverse: z.boolean().optional(),
        subtasks: z.boolean().optional(),
        statuses: z.array(z.string()).optional(),
        include_closed: z.boolean().optional(),
        assignees: z.array(z.string()).optional(),
        due_date_gt: z.number().optional(),
        due_date_lt: z.number().optional(),
        date_created_gt: z.number().optional(),
        date_created_lt: z.number().optional(),
        date_updated_gt: z.number().optional(),
        date_updated_lt: z.number().optional(),
        custom_fields: z.array(z.any()).optional(),
      },
      async ({ accessToken, listId, ...queryParams }) => {
        try {
          // Convert query params to URL query string
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(queryParams)) {
            if (Array.isArray(value)) {
              value.forEach((v) => params.append(key, String(v)));
            } else if (value !== undefined) {
              params.append(key, String(value));
            }
          }

          const query = params.toString();
          const endpoint = `list/${listId}/task${query ? `?${query}` : ""}`;

          const tasksData = await this.fetchClickUp(endpoint, accessToken);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(tasksData),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching tasks: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    this.server.tool(
      "createTask",
      {
        accessToken: z.string(),
        listId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        assignees: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        status: z.string().optional(),
        priority: z.number().optional(),
        due_date: z.number().optional(),
        due_date_time: z.boolean().optional(),
        time_estimate: z.number().optional(),
        start_date: z.number().optional(),
        start_date_time: z.boolean().optional(),
        notify_all: z.boolean().optional(),
        parent: z.string().optional(),
        links_to: z.string().optional(),
        custom_fields: z.array(z.any()).optional(),
      },
      async ({ accessToken, listId, ...taskData }) => {
        try {
          const endpoint = `list/${listId}/task`;

          const response = await this.fetchClickUp(endpoint, accessToken, {
            method: "POST",
            body: JSON.stringify(taskData),
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error creating task: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    this.server.tool(
      "getTask",
      {
        accessToken: z.string(),
        taskId: z.string(),
      },
      async ({ accessToken, taskId }) => {
        try {
          const taskData = await this.fetchClickUp(
            `task/${taskId}`,
            accessToken
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(taskData),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching task: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    this.server.tool(
      "updateTask",
      {
        accessToken: z.string(),
        taskId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        assignees: z
          .object({
            add: z.array(z.string()).optional(),
            rem: z.array(z.string()).optional(),
          })
          .optional(),
        tags: z
          .object({
            add: z.array(z.string()).optional(),
            rem: z.array(z.string()).optional(),
          })
          .optional(),
        status: z.string().optional(),
        priority: z.number().optional(),
        due_date: z.number().optional(),
        due_date_time: z.boolean().optional(),
        time_estimate: z.number().optional(),
        start_date: z.number().optional(),
        start_date_time: z.boolean().optional(),
        notify_all: z.boolean().optional(),
        parent: z.string().optional(),
        links_to: z.string().optional(),
        custom_fields: z.record(z.any()).optional(),
      },
      async ({ accessToken, taskId, ...taskData }) => {
        try {
          const response = await this.fetchClickUp(
            `task/${taskId}`,
            accessToken,
            {
              method: "PUT",
              body: JSON.stringify(taskData),
            }
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error updating task: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    this.server.tool(
      "deleteTask",
      {
        accessToken: z.string(),
        taskId: z.string(),
      },
      async ({ accessToken, taskId }) => {
        try {
          const response = await this.fetchClickUp(
            `task/${taskId}`,
            accessToken,
            {
              method: "DELETE",
            }
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error deleting task: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    // === Docs operations ===
    this.server.tool(
      "searchDocs",
      {
        accessToken: z.string(),
        workspaceId: z.string(),
        query: z.string().optional(),
        page: z.number().optional(),
        include_archived: z.boolean().optional(),
      },
      async ({ accessToken, workspaceId, ...params }) => {
        try {
          // Convert query params to URL query string
          const queryParams = new URLSearchParams();
          for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) {
              queryParams.append(key, String(value));
            }
          }

          const queryString = queryParams.toString();
          const endpoint = `team/${workspaceId}/doc${
            queryString ? `?${queryString}` : ""
          }`;

          const docsData = await this.fetchClickUp(
            endpoint,
            accessToken,
            {},
            "v3"
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(docsData),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error searching docs: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    this.server.tool(
      "createDoc",
      {
        accessToken: z.string(),
        workspaceId: z.string().optional(),
        parent: z.object({
          id: z.string(),
          type: z.enum(["folder", "doc", "space", "list"]),
        }),
        title: z.string(),
        content: z.any().optional(),
      },
      async ({ accessToken, workspaceId, parent, title, content }) => {
        try {
          let endpoint = "doc";

          // For v3 API
          if (workspaceId) {
            endpoint = `team/${workspaceId}/doc`;
          }

          const response = await this.fetchClickUp(
            endpoint,
            accessToken,
            {
              method: "POST",
              body: JSON.stringify({
                parent,
                title,
                content,
              }),
            },
            "v3"
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error creating doc: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    this.server.tool(
      "getDoc",
      {
        accessToken: z.string(),
        docId: z.string(),
      },
      async ({ accessToken, docId }) => {
        try {
          const docData = await this.fetchClickUp(
            `doc/${docId}`,
            accessToken,
            {},
            "v3"
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(docData),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching doc: ${error.message}`,
              },
            ],
          };
        }
      }
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Initialize the env property on the class prototype
    // This makes it available to all instances created by the static methods
    MyMCP.prototype.env = env;

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      // @ts-ignore
      return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    if (url.pathname === "/mcp") {
      // @ts-ignore
      return MyMCP.serve("/mcp").fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};
