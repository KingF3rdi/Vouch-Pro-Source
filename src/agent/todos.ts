/**
 * Lightweight todo list for Claude Code / Cursor-style agent planning.
 * Persisted under .helix/agent-todos.json in the workspace.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";

export type AgentTodo = {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
};

function todosPath(workspace: string) {
  return path.join(workspace, ".helix", "agent-todos.json");
}

async function loadTodos(workspace: string): Promise<AgentTodo[]> {
  try {
    const raw = await fs.readFile(todosPath(workspace), "utf8");
    const data = JSON.parse(raw) as { todos?: AgentTodo[] };
    return Array.isArray(data.todos) ? data.todos : [];
  } catch {
    return [];
  }
}

async function saveTodos(workspace: string, todos: AgentTodo[]) {
  await fs.mkdir(path.dirname(todosPath(workspace)), { recursive: true });
  await fs.writeFile(todosPath(workspace), JSON.stringify({ todos }, null, 2), "utf8");
}

export function createTodoTools(workspace: string) {
  return {
    todo_read: tool({
      description: "Read the current task list for this agent session.",
      inputSchema: z.object({}),
      execute: async () => ({ todos: await loadTodos(workspace) }),
    }),

    todo_write: tool({
      description:
        "Replace the task list. Use for multi-step work like Claude Code / Cursor Agent: plan briefly, mark in_progress, complete as you go.",
      inputSchema: z.object({
        todos: z
          .array(
            z.object({
              id: z.string().min(1),
              content: z.string().min(1),
              status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
            })
          )
          .max(30),
      }),
      execute: async ({ todos }) => {
        const inProgress = todos.filter((t) => t.status === "in_progress");
        if (inProgress.length > 1) {
          return {
            ok: false as const,
            error: "Only one todo may be in_progress at a time.",
            todos: await loadTodos(workspace),
          };
        }
        await saveTodos(workspace, todos);
        return { ok: true as const, todos };
      },
    }),
  };
}
