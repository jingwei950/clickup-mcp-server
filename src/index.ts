import { McpAgent } from "agents/mcp";
import { unstable_context as context } from "agents";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerDocTools,
  registerListTools,
  registerTaskTools,
  registerSpaceTools,
  registerFolderTools,
  registerAuthorizationTools,
} from "./tools";

// Define environment type for Cloudflare Worker bindings
type Env = {
  CLICKUP_API_KEY: string;
};

// Helper function to call the ClickUp API
async function invokeClickUpApi(
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

    // Register all tool modules
    registerSpaceTools(this.server, getApiKey, invokeClickUpApi);
    registerFolderTools(this.server, getApiKey, invokeClickUpApi);
    registerListTools(this.server, getApiKey, invokeClickUpApi);
    registerAuthorizationTools(this.server, getApiKey, invokeClickUpApi);
    registerTaskTools(this.server, getApiKey, invokeClickUpApi);
    registerDocTools(this.server, getApiKey, invokeClickUpApi);
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
