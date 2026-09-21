import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentMode } from "../shared/types.js";

export type StoredSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode: AgentMode;
  skillIds: string[];
  messages: unknown[];
};

function sessionsDir(workspace: string) {
  return path.join(workspace, ".helix", "sessions");
}

function sessionPath(workspace: string, id: string) {
  return path.join(sessionsDir(workspace), `${id}.json`);
}

async function ensureDir(workspace: string) {
  await fs.mkdir(sessionsDir(workspace), { recursive: true });
}

export async function listSessions(workspace: string): Promise<StoredSession[]> {
  await ensureDir(workspace);
  const files = await fs.readdir(sessionsDir(workspace));
  const sessions: StoredSession[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(sessionsDir(workspace), file), "utf8");
      sessions.push(JSON.parse(raw) as StoredSession);
    } catch {
      // skip corrupt
    }
  }
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getSession(
  workspace: string,
  id: string
): Promise<StoredSession | null> {
  try {
    const raw = await fs.readFile(sessionPath(workspace, id), "utf8");
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function createSession(
  workspace: string,
  input?: Partial<Pick<StoredSession, "title" | "mode" | "skillIds">>
): Promise<StoredSession> {
  await ensureDir(workspace);
  const now = new Date().toISOString();
  const session: StoredSession = {
    id: randomUUID(),
    title: input?.title?.trim() || "New chat",
    createdAt: now,
    updatedAt: now,
    mode: input?.mode ?? "chat",
    skillIds: input?.skillIds ?? ["coding", "design", "research"],
    messages: [],
  };
  await fs.writeFile(sessionPath(workspace, session.id), JSON.stringify(session, null, 2));
  return session;
}

export async function saveSession(
  workspace: string,
  session: StoredSession
): Promise<StoredSession> {
  await ensureDir(workspace);
  const next = {
    ...session,
    updatedAt: new Date().toISOString(),
    title: deriveTitle(session),
  };
  await fs.writeFile(sessionPath(workspace, next.id), JSON.stringify(next, null, 2));
  return next;
}

export async function deleteSession(workspace: string, id: string): Promise<void> {
  await fs.unlink(sessionPath(workspace, id)).catch(() => undefined);
}

function deriveTitle(session: StoredSession): string {
  if (session.title && session.title !== "New chat") return session.title;
  for (const message of session.messages) {
    const msg = message as {
      role?: string;
      parts?: Array<{ type?: string; text?: string }>;
      content?: string;
    };
    if (msg.role !== "user") continue;
    const text =
      msg.parts
        ?.filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join(" ") || msg.content;
    if (text?.trim()) return text.trim().slice(0, 72);
  }
  return session.title || "New chat";
}
