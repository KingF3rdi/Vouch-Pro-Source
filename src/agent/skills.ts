import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SkillSummary } from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SKILLS_DIR = path.resolve(__dirname, "../../skills");

export async function listSkills(): Promise<SkillSummary[]> {
  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
  const skills: SkillSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(SKILLS_DIR, entry.name, "SKILL.md");
    try {
      const raw = await fs.readFile(skillPath, "utf8");
      const name = matchFrontmatter(raw, "name") ?? entry.name;
      const description =
        matchFrontmatter(raw, "description") ?? "Built-in Helix skill";
      skills.push({ id: entry.name, name, description });
    } catch {
      // ignore incomplete skill folders
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadSkillBodies(skillIds?: string[]): Promise<string> {
  const all = await listSkills();
  const selected = skillIds?.length
    ? all.filter((skill) => skillIds.includes(skill.id))
    : all;

  const chunks: string[] = [];
  for (const skill of selected) {
    const skillPath = path.join(SKILLS_DIR, skill.id, "SKILL.md");
    const raw = await fs.readFile(skillPath, "utf8");
    const body = stripFrontmatter(raw).trim();
    chunks.push(`## Skill: ${skill.name}\n\n${body}`);
  }
  return chunks.join("\n\n---\n\n");
}

function matchFrontmatter(raw: string, key: string): string | null {
  const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
}

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  return raw.slice(end + 4);
}
