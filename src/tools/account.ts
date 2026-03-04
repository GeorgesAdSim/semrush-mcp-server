import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSemrushClient } from "../services/semrush-api.js";

export function registerAccountTools(server: McpServer): void {
  server.registerTool(
    "semrush_credits",
    {
      title: "SEMrush Account & Credits",
      description: `Check SEMrush API credits and usage. Available actions:

- balance: Current API units balance. Shows warning if < 1000 units remaining.
- usage_stats: API consumption from the current session (calls count, endpoints used, errors).`,
      inputSchema: {
        action: z
          .enum(["balance", "usage_stats"])
          .describe("Account action"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const client = getSemrushClient();
        let text: string;

        switch (params.action) {
          case "balance": {
            const balance = await client.getApiUnits();
            const warning =
              balance < 1000
                ? "\n\n**⚠️ ATTENTION : Solde API bas (< 1000 units). Limitez les appels volumineux.**"
                : "";
            text = [
              `## SEMrush API Credits`,
              "",
              `**Solde actuel : ${balance.toLocaleString()} API units**${warning}`,
            ].join("\n");
            break;
          }
          case "usage_stats": {
            const stats = client.getSessionStats();
            text = [
              `## Session Usage Stats`,
              "",
              "```json\n" + JSON.stringify(stats, null, 2) + "\n```",
            ].join("\n");
            break;
          }
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
