import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSpaceTools(
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

  server.tool(
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

  server.tool("getSpace", { spaceId: z.string() }, async ({ spaceId }) => {
    const apiKey = getApiKey();
    if (!apiKey)
      return { content: [{ type: "text", text: "API key missing." }] };
    const result = await callClickUpApi(`space/${spaceId}`, "GET", apiKey);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  server.tool(
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

  server.tool("deleteSpace", { spaceId: z.string() }, async ({ spaceId }) => {
    const apiKey = getApiKey();
    if (!apiKey)
      return { content: [{ type: "text", text: "API key missing." }] };
    const result = await callClickUpApi(`space/${spaceId}`, "DELETE", apiKey);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });
}
