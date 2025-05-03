# Building a Remote MCP Server on Cloudflare (Without Auth)

This example allows you to deploy a remote MCP server that doesn't require authentication on Cloudflare Workers.

## Get started:

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless)

This will deploy your MCP server to a URL like: `remote-mcp-server-authless.<your-account>.workers.dev/sse`

Alternatively, you can use the command line below to get the remote MCP Server created on your local machine:

```bash
npm create cloudflare@latest -- my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless
```

## Deploying to Your Own Cloudflare Worker

Instead of using the one-click deploy button, you can clone this repository and deploy it manually to your Cloudflare account.

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Login to Cloudflare:**
    ```bash
    npx wrangler login
    ```
4.  **Deploy:**
    ```bash
    npx wrangler deploy
    ```
    This command will build and deploy your worker. Wrangler will provide you with the URL where your worker is deployed (e.g., `my-mcp-server.<your-account>.workers.dev/sse`).

## Managing Secrets (API Keys)

If your custom tools require API keys or other secrets, you need to configure them securely.

### Production Secrets (Cloudflare Dashboard/Wrangler)

For your deployed worker, use Cloudflare's secret management:

1.  **Using Wrangler:**

    ```bash
    npx wrangler secret put YOUR_SECRET_NAME
    ```

    Wrangler will prompt you to enter the secret value. This value will be encrypted and securely stored, accessible only to your worker code.

2.  **Using Cloudflare Dashboard:**
    Go to your Worker in the Cloudflare dashboard -> Settings -> Variables -> Environment Variables -> Add Variable. Make sure to click "Encrypt" to store it securely.

### Local Development Secrets (`.dev.vars`)

For local testing using `npx wrangler dev`, create a file named `.dev.vars` in the root of your project directory. **Do not commit this file to Git.** Add your secrets to this file like so:

```plaintext
# .dev.vars - For local development only!
YOUR_SECRET_NAME="your_secret_value_here"
ANOTHER_SECRET="another_value"
```

### Accessing Secrets in Code

In your `src/index.ts` or other TypeScript files, you can access these secrets via the `env` object passed to the `fetch` handler or within the `init()` method if you pass the `env` object during initialization:

```typescript
// Example in src/index.ts
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Access secrets like this:
    const apiKey = env.YOUR_SECRET_NAME;
    // ... rest of your code
  },
};

// Example structure if you need env in init()
class MyMCPImplementation {
  server: MCP;
  env: Env; // Store env if needed

  constructor(env: Env) {
    this.env = env;
    this.server = new MCP();
    this.init();
  }

  init() {
    // Access secrets here:
    const apiKey = this.env.YOUR_SECRET_NAME;

    // Define tools using the secrets if necessary
    this.server.tool(/* ... */);
  }
  // ... rest of the class
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const mcpImplementation = new MyMCPImplementation(env);
    return mcpImplementation.server.handle(request);
  },
};

// Define the Env interface (if not already defined)
interface Env {
  YOUR_SECRET_NAME: string;
  ANOTHER_SECRET: string;
  // Add other secrets/bindings here
}
```

Remember to define the types for your secrets in the `Env` interface, usually found or needed in `src/index.ts`.

## Customizing your MCP Server

To add your own [tools](https://developers.cloudflare.com/agents/model-context-protocol/tools/) to the MCP server, define each tool inside the `init()` method of `src/index.ts` using `this.server.tool(...)`.

## Connect to Cloudflare AI Playground

You can connect to your MCP server from the Cloudflare AI Playground, which is a remote MCP client:

1. Go to https://playground.ai.cloudflare.com/
2. Enter your deployed MCP server URL (`remote-mcp-server-authless.<your-account>.workers.dev/sse`)
3. You can now use your MCP tools directly from the playground!

## Connect Claude Desktop to your MCP server

You can also connect to your remote MCP server from local MCP clients, by using the [mcp-remote proxy](https://www.npmjs.com/package/mcp-remote).

To connect to your MCP server from Claude Desktop, follow [Anthropic's Quickstart](https://modelcontextprotocol.io/quickstart/user) and within Claude Desktop go to Settings > Developer > Edit Config.

Update with this configuration:

```json
{
  "mcpServers": {
    "calculator": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8787/sse" // or remote-mcp-server-authless.your-account.workers.dev/sse
      ]
    }
  }
}
```

Restart Claude and you should see the tools become available.
