/**
 * Yeet Extension
 *
 * /yeet - Commits all changes, pushes, and creates a PR using the gh CLI.
 * Usage: /yeet [optional PR title]
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function yeetExtension(pi: ExtensionAPI) {
  pi.registerCommand("yeet", {
    description: "Commit, push, and create a PR via gh CLI",
    handler: async (args, ctx) => {
      const run = async (cmd: string): Promise<{ stdout: string; stderr: string; code: number | null }> => {
        const result = await pi.exec("bash", ["-c", cmd], { timeout: 30000 });
        return result;
      };

      // 1. Check we're in a git repo
      const gitCheck = await run("git rev-parse --is-inside-work-tree");
      if (gitCheck.code !== 0) {
        ctx.ui.notify("Not a git repository!", "error");
        return;
      }

      // 2. Check for changes
      const status = await run("git status --porcelain");
      if (!status.stdout.trim()) {
        ctx.ui.notify("No changes to commit!", "warning");
        return;
      }

      // 3. Get current branch
      const branchResult = await run("git branch --show-current");
      const branch = branchResult.stdout.trim();

      if (branch === "main" || branch === "master") {
        const ok = await ctx.ui.confirm("⚠️ Warning", `You're on '${branch}'. Continue anyway?`);
        if (!ok) return;
      }

      // 4. Stage all changes
      ctx.ui.notify("Staging changes...", "info");
      const addResult = await run("git add -A");
      if (addResult.code !== 0) {
        ctx.ui.notify(`Failed to stage: ${addResult.stderr}`, "error");
        return;
      }

      // 5. Generate commit message from diff
      const diff = await run("git diff --cached --stat");
      const prTitle = args.trim() || `Updates from ${branch}`;
      const commitMsg = prTitle;

      ctx.ui.notify(`Committing: "${commitMsg}"`, "info");
      const commitResult = await run(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
      if (commitResult.code !== 0) {
        ctx.ui.notify(`Commit failed: ${commitResult.stderr}`, "error");
        return;
      }

      // 6. Push
      ctx.ui.notify(`Pushing to origin/${branch}...`, "info");
      const pushResult = await run(`git push -u origin ${branch}`);
      if (pushResult.code !== 0) {
        ctx.ui.notify(`Push failed: ${pushResult.stderr}`, "error");
        return;
      }

      // 7. Create PR
      ctx.ui.notify("Creating PR...", "info");
      const prResult = await run(
        `gh pr create --title "${prTitle.replace(/"/g, '\\"')}" --body "Yeeted from pi 🚀" --fill 2>&1`
      );

      if (prResult.code !== 0) {
        // PR might already exist
        if (prResult.stdout.includes("already exists") || prResult.stderr.includes("already exists")) {
          ctx.ui.notify("PR already exists! Changes pushed.", "warning");
        } else {
          ctx.ui.notify(`PR creation failed: ${prResult.stderr || prResult.stdout}`, "error");
        }
        return;
      }

      const prUrl = prResult.stdout.trim().split("\n").pop() || "";
      ctx.ui.notify(`🚀 Yeeted! PR: ${prUrl}`, "success");
    },
  });
}
