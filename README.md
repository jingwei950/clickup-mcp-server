# ClickUp MCP Server

A Model Context Protocol (MCP) server that provides an interface to the ClickUp API. This server runs on Cloudflare Workers and allows AI assistants to interact with ClickUp resources using the MCP protocol.

## Features

- OAuth authentication with ClickUp
- Support for both ClickUp API v2 and v3 endpoints
- CRUD operations for:
  - Workspaces (Teams)
  - Spaces
  - Lists
  - Tasks
  - Docs

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your Cloudflare Worker:
   - You'll need a KV namespace for storing OAuth tokens
   - Set up the necessary environment variables

## Development

```bash
npm run dev
```

## Deployment

```bash
npm run deploy
```

## API Tools

### Authentication

- `auth`: Exchange OAuth authorization code for an access token
  - Parameters: `clientId`, `clientSecret`, `code`, `redirectUri`

### User

- `getAuthorizedUser`: Get the currently authenticated user
  - Parameters: `accessToken`
- `getAuthorizedWorkspaces`: Get workspaces the user has access to
  - Parameters: `accessToken`

### Spaces

- `getSpaces`: Get all spaces in a workspace
  - Parameters: `accessToken`, `workspaceId`
- `createSpace`: Create a new space
  - Parameters: `accessToken`, `workspaceId`, `name`, `features` (optional)
- `getSpace`: Get details of a specific space
  - Parameters: `accessToken`, `spaceId`
- `updateSpace`: Update a space
  - Parameters: `accessToken`, `spaceId`, `name` (optional), `features` (optional)
- `deleteSpace`: Delete a space
  - Parameters: `accessToken`, `spaceId`

### Lists

- `getLists`: Get lists in a folder or space
  - Parameters: `accessToken`, `folderId` or `spaceId`
- `createList`: Create a new list
  - Parameters: `accessToken`, `folderId` or `spaceId`, `name`, plus optional fields

### Tasks

- `getTasks`: Get tasks in a list
  - Parameters: `accessToken`, `listId`, plus optional filtering parameters
- `createTask`: Create a new task
  - Parameters: `accessToken`, `listId`, `name`, plus optional fields
- `getTask`: Get details of a specific task
  - Parameters: `accessToken`, `taskId`
- `updateTask`: Update a task
  - Parameters: `accessToken`, `taskId`, plus fields to update
- `deleteTask`: Delete a task
  - Parameters: `accessToken`, `taskId`

### Docs

- `searchDocs`: Search for docs in a workspace
  - Parameters: `accessToken`, `workspaceId`, `query` (optional)
- `createDoc`: Create a new doc
  - Parameters: `accessToken`, `workspaceId` (optional), `parent`, `title`, `content` (optional)
- `getDoc`: Get a specific doc
  - Parameters: `accessToken`, `docId`

## ClickUp OAuth Flow

1. Register an OAuth application in ClickUp
2. Redirect users to the ClickUp authorization URL
3. User authorizes your application
4. ClickUp redirects back to your redirect URI with an authorization code
5. Exchange the authorization code for an access token using the `auth` tool

## License

MIT
