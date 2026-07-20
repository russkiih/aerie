#!/usr/bin/env node
// Aerie MCP server — exposes read-only tools over your Firebase estate so agents
// (Claude, etc.) can answer questions across every project you own.
//
// Transport: stdio. Auth: FIREBASE_TOKEN or GOOGLE_APPLICATION_CREDENTIALS.
// All tools are read-only; nothing here mutates a Firebase account.
//
// Register with Claude Code:
//   claude mcp add aerie -- node /path/to/aerie/mcp/server.mjs

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  collectSnapshot,
  listProjects,
  enrichProject,
  listApps,
} from "../core/reader.mjs";

const server = new McpServer({ name: "aerie", version: "0.1.0" });

const asText = (obj) => ({
  content: [{ type: "text", text: JSON.stringify(obj, null, 2) }],
});

function resolveProject(projectId) {
  const p = listProjects().find((x) => x.projectId === projectId);
  if (!p) throw new Error(`Project not found: ${projectId}`);
  return enrichProject(p);
}

server.registerTool(
  "aerie_overview",
  {
    title: "Firebase estate overview",
    description:
      "Account-wide rollup across every Firebase project: project count, app count, platform breakdown, how many have Firestore / GA4 / live hosting.",
    inputSchema: {},
  },
  async () => asText(collectSnapshot().account)
);

server.registerTool(
  "aerie_list_projects",
  {
    title: "List Firebase projects",
    description:
      "List every Firebase project the connected account owns, each enriched with apps, platforms, Firestore status, GA4 wiring and hosting sites.",
    inputSchema: {},
  },
  async () => asText(listProjects().map(enrichProject))
);

server.registerTool(
  "aerie_get_project",
  {
    title: "Get one Firebase project",
    description:
      "Full detail for a single project: metadata, apps, Firestore status, GA4 measurement ID and live hosting sites.",
    inputSchema: {
      projectId: z.string().describe("The Firebase project ID, e.g. 'my-app'"),
    },
  },
  async ({ projectId }) => asText(resolveProject(projectId))
);

server.registerTool(
  "aerie_list_apps",
  {
    title: "List a project's apps",
    description:
      "List the registered apps (Web / iOS / Android) for a given Firebase project.",
    inputSchema: {
      projectId: z.string().describe("The Firebase project ID"),
    },
  },
  async ({ projectId }) => asText(listApps(projectId))
);

const transport = new StdioServerTransport();
await server.connect(transport);
// stderr is safe for logs; stdout is reserved for the JSON-RPC stream.
console.error("aerie-mcp ready (stdio)");
