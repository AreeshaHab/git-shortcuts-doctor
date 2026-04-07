"use strict";

const vscode = require("vscode");
const cp = require("child_process");
let outputChannel;
let lastGitError = "";

function getExtensionConfig() {
  const config = vscode.workspace.getConfiguration("gitShortcutsDoctor");
  return {
    defaultTargetBranch: config.get("defaultTargetBranch", "main"),
    preferredPrMode: config.get("preferredPrMode", "auto"),
    prTitleTemplate: config.get("prTitleTemplate", "{firstCommit}"),
    prBodyTemplate: config.get(
      "prBodyTemplate",
      "Target branch: {target}\n\nSummary\n- Update this section before submitting the PR.\n\nIncluded commits\n{commitBullets}\n\nWorking tree clean: {workingTreeClean}"
    )
  };
}

function activate(context) {
  outputChannel = vscode.window.createOutputChannel("Git Shortcuts Doctor");
  context.subscriptions.push(outputChannel);
  context.subscriptions.push(createStatusBarItem());

  const register = (command, handler) => {
    context.subscriptions.push(vscode.commands.registerCommand(command, handler));
  };

  register("gitShortcutsDoctor.openDashboard", openDashboard);
  register("gitShortcutsDoctor.startFeature", startFeature);
  register("gitShortcutsDoctor.startPrBranch", startPrBranch);
  register("gitShortcutsDoctor.syncWithTargetBranch", syncWithTargetBranch);
  register("gitShortcutsDoctor.checkPrReadiness", checkPrReadiness);
  register("gitShortcutsDoctor.preparePr", preparePr);
  register("gitShortcutsDoctor.createPr", createPr);
  register("gitShortcutsDoctor.syncBranch", syncBranch);
  register("gitShortcutsDoctor.saveWorkQuickly", saveWorkQuickly);
  register("gitShortcutsDoctor.undoLastMistake", undoLastMistake);
  register("gitShortcutsDoctor.conflictCenter", openConflictCenter);
  register("gitShortcutsDoctor.gitStatus", () => runGitAndReport(["status", "--short", "--branch"], "Git status"));
  register("gitShortcutsDoctor.fetchAll", () => runGitAndReport(["fetch", "--all", "--prune"], "Fetch all"));
  register("gitShortcutsDoctor.pullLatest", () => runGitAndReport(["pull"], "Pull latest"));
  register("gitShortcutsDoctor.pullRebase", () => runGitAndReport(["pull", "--rebase"], "Pull rebase"));
  register("gitShortcutsDoctor.addAll", () => runGitAndReport(["add", "."], "Add all"));
  register("gitShortcutsDoctor.addCurrentFile", addCurrentFile);
  register("gitShortcutsDoctor.commit", createCommit);
  register("gitShortcutsDoctor.commitAmend", amendCommit);
  register("gitShortcutsDoctor.push", () => runGitAndReport(["push"], "Push"));
  register("gitShortcutsDoctor.pushForceLease", forcePushWithLease);
  register("gitShortcutsDoctor.createBranch", createBranch);
  register("gitShortcutsDoctor.checkoutBranch", checkoutBranch);
  register("gitShortcutsDoctor.mergeBranch", mergeBranch);
  register("gitShortcutsDoctor.stashPush", stashPush);
  register("gitShortcutsDoctor.stashPop", () => runGitAndReport(["stash", "pop"], "Stash pop"));
  register("gitShortcutsDoctor.abortMerge", () => runGitAndReport(["merge", "--abort"], "Abort merge"));
  register("gitShortcutsDoctor.abortRebase", () => runGitAndReport(["rebase", "--abort"], "Abort rebase"));
  register("gitShortcutsDoctor.runCustomGit", runCustomGit);
  register("gitShortcutsDoctor.acceptCurrent", () => vscode.commands.executeCommand("merge-conflict.accept.current"));
  register("gitShortcutsDoctor.acceptIncoming", () => vscode.commands.executeCommand("merge-conflict.accept.incoming"));
  register("gitShortcutsDoctor.acceptBoth", () => vscode.commands.executeCommand("merge-conflict.accept.both"));
  register("gitShortcutsDoctor.nextConflict", () => vscode.commands.executeCommand("merge-conflict.next"));
  register("gitShortcutsDoctor.previousConflict", () => vscode.commands.executeCommand("merge-conflict.previous"));
  register("gitShortcutsDoctor.gitDoctor", showGitDoctor);
}

function deactivate() {}

function createStatusBarItem() {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.name = "Git Shortcuts Doctor";
  item.text = "$(source-control) Git Keys";
  item.tooltip = [
    "Git Shortcuts Doctor",
    "Open dashboard: Ctrl+Alt+G D",
    "Conflict Center: Ctrl+Alt+G Q",
    "Start feature: Ctrl+Alt+G W",
    "Start PR branch: Ctrl+Alt+G J",
    "Sync with target: Ctrl+Alt+G I",
    "PR readiness: Ctrl+Alt+G V",
    "Prepare PR: Ctrl+Alt+G Shift+V",
    "Create PR: Ctrl+Alt+G Shift+J",
    "Sync branch: Ctrl+Alt+G Y",
    "Status: Ctrl+Alt+G S",
    "Pull latest: Ctrl+Alt+G U",
    "Commit: Ctrl+Alt+G C",
    "Push: Ctrl+Alt+G P",
    "Merge branch: Ctrl+Alt+G E",
    "Git Doctor: Ctrl+Alt+G H"
  ].join("\n");
  item.command = "gitShortcutsDoctor.openDashboard";
  item.show();
  return item;
}

function quickPickItem(label, shortcut, description, command) {
  return {
    label,
    description,
    detail: `Shortcut: ${shortcut}`,
    command
  };
}

function workflowSeparator(label) {
  return {
    label,
    kind: vscode.QuickPickItemKind.Separator
  };
}

async function openDashboard() {
  const picked = await vscode.window.showQuickPick(
    [
      workflowSeparator("Workflows"),
      quickPickItem("Start Feature", "Ctrl+Alt+G W", "Create a new branch for feature work", "gitShortcutsDoctor.startFeature"),
      quickPickItem("Start PR Branch", "Ctrl+Alt+G J", "Create a branch from main or another target branch", "gitShortcutsDoctor.startPrBranch"),
      quickPickItem("Sync With Target Branch", "Ctrl+Alt+G I", "Update current branch from main or another PR target", "gitShortcutsDoctor.syncWithTargetBranch"),
      quickPickItem("Check PR Readiness", "Ctrl+Alt+G V", "Check branch, changes, upstream, and conflicts before PR", "gitShortcutsDoctor.checkPrReadiness"),
      quickPickItem("Prepare PR", "Ctrl+Alt+G Shift+V", "Generate title/body context before creating a PR", "gitShortcutsDoctor.preparePr"),
      quickPickItem("Create PR", "Ctrl+Alt+G Shift+J", "Open or create a PR/MR for GitHub or GitLab", "gitShortcutsDoctor.createPr"),
      quickPickItem("Sync Branch", "Ctrl+Alt+G Y", "Fetch and choose how to pull latest changes", "gitShortcutsDoctor.syncBranch"),
      quickPickItem("Save Work Quickly", "Ctrl+Alt+G K", "Stage, commit, or stash from one guided flow", "gitShortcutsDoctor.saveWorkQuickly"),
      quickPickItem("Undo Last Mistake", "Ctrl+Alt+G Z", "Common undo and recovery actions", "gitShortcutsDoctor.undoLastMistake"),
      workflowSeparator("Conflicts"),
      quickPickItem("Conflict Center", "Ctrl+Alt+G Q", "See conflicted files and recovery actions", "gitShortcutsDoctor.conflictCenter"),
      quickPickItem("Accept Current Change", "Ctrl+Alt+G 1", "Use the current side of a conflict", "gitShortcutsDoctor.acceptCurrent"),
      quickPickItem("Accept Incoming Change", "Ctrl+Alt+G 2", "Use the incoming side of a conflict", "gitShortcutsDoctor.acceptIncoming"),
      quickPickItem("Accept Both Changes", "Ctrl+Alt+G 3", "Keep both sides of a conflict", "gitShortcutsDoctor.acceptBoth"),
      quickPickItem("Previous Conflict", "Ctrl+Alt+G [", "Jump to the previous conflict", "gitShortcutsDoctor.previousConflict"),
      quickPickItem("Next Conflict", "Ctrl+Alt+G ]", "Jump to the next conflict", "gitShortcutsDoctor.nextConflict"),
      quickPickItem("Abort Merge", "Ctrl+Alt+G M", "Cancel the current merge", "gitShortcutsDoctor.abortMerge"),
      quickPickItem("Abort Rebase", "Ctrl+Alt+G R", "Cancel the current rebase", "gitShortcutsDoctor.abortRebase"),
      workflowSeparator("Branches"),
      quickPickItem("Create Branch", "Ctrl+Alt+G N", "Create and switch to a new branch", "gitShortcutsDoctor.createBranch"),
      quickPickItem("Checkout Branch", "Ctrl+Alt+G B", "Switch to an existing branch", "gitShortcutsDoctor.checkoutBranch"),
      quickPickItem("Merge Branch", "Ctrl+Alt+G E", "Merge another branch into the current branch", "gitShortcutsDoctor.mergeBranch"),
      workflowSeparator("Changes"),
      quickPickItem("Git Status", "Ctrl+Alt+G S", "Show current branch and file changes", "gitShortcutsDoctor.gitStatus"),
      quickPickItem("Add All", "Ctrl+Alt+G A", "Stage all current changes", "gitShortcutsDoctor.addAll"),
      quickPickItem("Add Current File", "Ctrl+Alt+G .", "Stage the file open in the editor", "gitShortcutsDoctor.addCurrentFile"),
      quickPickItem("Commit", "Ctrl+Alt+G C", "Create a commit with a message", "gitShortcutsDoctor.commit"),
      quickPickItem("Commit Amend", "Ctrl+Alt+G Shift+C", "Amend the last commit message", "gitShortcutsDoctor.commitAmend"),
      quickPickItem("Stash Push", "Ctrl+Alt+G T", "Save local changes to stash", "gitShortcutsDoctor.stashPush"),
      quickPickItem("Stash Pop", "Ctrl+Alt+G O", "Restore the latest stash", "gitShortcutsDoctor.stashPop"),
      workflowSeparator("Remote"),
      quickPickItem("Fetch All", "Ctrl+Alt+G F", "Download latest remote refs", "gitShortcutsDoctor.fetchAll"),
      quickPickItem("Pull Latest", "Ctrl+Alt+G U", "Pull latest remote changes", "gitShortcutsDoctor.pullLatest"),
      quickPickItem("Pull Rebase", "Ctrl+Alt+G L", "Pull remote commits with rebase", "gitShortcutsDoctor.pullRebase"),
      quickPickItem("Push", "Ctrl+Alt+G P", "Push current branch to remote", "gitShortcutsDoctor.push"),
      quickPickItem("Push Force With Lease", "Ctrl+Alt+G Shift+P", "Safer forced push", "gitShortcutsDoctor.pushForceLease"),
      workflowSeparator("Recovery"),
      quickPickItem("Diagnose Git State", "Ctrl+Alt+G H", "Explain common Git problems and suggest next steps", "gitShortcutsDoctor.gitDoctor"),
      quickPickItem("Run Custom Git Command", "Ctrl+Alt+G X", "Run any git command from an input box", "gitShortcutsDoctor.runCustomGit")
    ],
    { placeHolder: "Choose a workflow, action, or shortcut" }
  );

  if (picked && picked.command) {
    await vscode.commands.executeCommand(picked.command);
  }
}

async function createCommit() {
  const message = await vscode.window.showInputBox({
    prompt: "Commit message",
    placeHolder: "feat: explain what changed"
  });

  if (!message) {
    return;
  }

  await runGitAndReport(["commit", "-m", message], "Commit");
}

async function startFeature() {
  const branchName = await vscode.window.showInputBox({
    prompt: "Feature branch name",
    placeHolder: "feature/login-page"
  });

  if (!branchName) {
    return;
  }

  await runGitAndReport(["checkout", "-b", branchName], `Start feature ${branchName}`);
}

async function startPrBranch() {
  const settings = getExtensionConfig();
  const targetBranch = await pickTargetBranch("Choose the target branch for the PR", settings.defaultTargetBranch);
  if (!targetBranch) {
    return;
  }

  const branchName = await vscode.window.showInputBox({
    prompt: "PR branch name",
    placeHolder: `feature/my-change-from-${targetBranch.replace(/[\/ ]/g, "-")}`
  });

  if (!branchName) {
    return;
  }

  const fetchResult = await runGit(["fetch", "--all", "--prune"]);
  if (!fetchResult.ok) {
    showGitFailure("Start PR branch", fetchResult.stderr);
    return;
  }

  const checkoutBaseResult = await checkoutBestAvailableBranch(targetBranch);
  if (!checkoutBaseResult.ok) {
    showGitFailure("Start PR branch", checkoutBaseResult.stderr);
    return;
  }

  await runGitAndReport(["checkout", "-b", branchName], `Start PR branch ${branchName}`);
}

async function syncWithTargetBranch() {
  const settings = getExtensionConfig();
  const targetBranch = await pickTargetBranch("Choose the branch your PR targets", settings.defaultTargetBranch);
  if (!targetBranch) {
    return;
  }

  const mode = await vscode.window.showQuickPick(
    [
      { label: "Rebase current branch on target", description: "Cleaner history for PRs", args: ["rebase", targetBranch] },
      { label: "Merge target into current branch", description: "Safer if you want a merge commit", args: ["merge", targetBranch] }
    ],
    { placeHolder: `How should current branch sync with ${targetBranch}?` }
  );

  if (!mode) {
    return;
  }

  const fetchResult = await runGit(["fetch", "--all", "--prune"]);
  if (!fetchResult.ok) {
    showGitFailure("Sync with target branch", fetchResult.stderr);
    return;
  }

  const localTarget = await resolveLocalBranchName(targetBranch);
  await runGitAndReport(mode.args[0] === "rebase" ? ["rebase", localTarget] : ["merge", localTarget], "Sync with target branch");
}

async function checkPrReadiness() {
  const settings = getExtensionConfig();
  const targetBranch = await pickTargetBranch("Choose the branch you will open the PR against", settings.defaultTargetBranch);
  if (!targetBranch) {
    return;
  }

  const results = await Promise.all([
    runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
    runGit(["status", "--short", "--branch"]),
    runGit(["diff", "--name-only", "--diff-filter=U"]),
    runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]),
    runGit(["rev-list", "--left-right", "--count", `${targetBranch}...HEAD`]),
    runGit(["log", "--oneline", `${targetBranch}..HEAD`])
  ]);

  const branch = results[0].ok ? results[0].stdout.trim() : "unknown";
  const statusText = results[1].ok ? results[1].stdout : "";
  const conflictText = results[2].ok ? results[2].stdout : "";
  const upstream = results[3].ok ? results[3].stdout.trim() : "";
  const aheadBehind = results[4].ok ? results[4].stdout.trim().split(/\s+/) : [];
  const commitList = results[5].ok ? results[5].stdout.split(/\r?\n/).filter(Boolean) : [];

  const readiness = [];
  const actions = [];

  if (!upstream) {
    readiness.push("No upstream is configured for this branch. First push may need `git push -u origin <branch>`.");
    actions.push("Push Branch");
  }

  if (/^UU /m.test(statusText) || conflictText.trim()) {
    readiness.push("Unresolved conflicts exist. Resolve them before opening or updating a PR.");
    actions.push("Open Conflict Center");
  }

  if (/^\s?[MADRCU\?]{1,2}\s/m.test(statusText)) {
    readiness.push("Working tree is not clean. Commit, stash, or discard local changes before final PR checks.");
    actions.push("Save Work Quickly");
  }

  if (aheadBehind.length === 2) {
    const behind = Number(aheadBehind[0]);
    const ahead = Number(aheadBehind[1]);
    if (behind > 0) {
      readiness.push(`Current branch is behind ${targetBranch} by ${behind} commit(s). Sync before opening or updating the PR.`);
      actions.push("Sync With Target Branch");
    }
    if (ahead === 0) {
      readiness.push(`No commits are ahead of ${targetBranch}. There may be nothing new to include in the PR.`);
    }
  }

  if (commitList.length > 0) {
    readiness.push(`PR currently contains ${commitList.length} commit(s) compared with ${targetBranch}.`);
  }

  if (!readiness.length) {
    readiness.push(`Branch ${branch} looks ready for a PR against ${targetBranch}.`);
  }

  outputChannel.show(true);
  outputChannel.appendLine("=== PR Readiness ===");
  outputChannel.appendLine(`Current branch: ${branch}`);
  outputChannel.appendLine(`Target branch: ${targetBranch}`);
  outputChannel.appendLine(`Upstream: ${upstream || "not configured"}`);
  outputChannel.appendLine("");
  outputChannel.appendLine("Readiness:");
  readiness.forEach((line) => outputChannel.appendLine(`- ${line}`));
  if (commitList.length) {
    outputChannel.appendLine("");
    outputChannel.appendLine("Commits in PR:");
    commitList.forEach((line) => outputChannel.appendLine(`- ${line}`));
  }

  const primaryAction = actions[0];
  const picked = await vscode.window.showInformationMessage(
    `PR readiness checked for ${branch} -> ${targetBranch}. See output panel.`,
    ...(primaryAction ? [primaryAction] : [])
  );

  if (picked === "Open Conflict Center") {
    await vscode.commands.executeCommand("gitShortcutsDoctor.conflictCenter");
  } else if (picked === "Save Work Quickly") {
    await vscode.commands.executeCommand("gitShortcutsDoctor.saveWorkQuickly");
  } else if (picked === "Push Branch") {
    await vscode.commands.executeCommand("gitShortcutsDoctor.push");
  } else if (picked === "Sync With Target Branch") {
    await vscode.commands.executeCommand("gitShortcutsDoctor.syncWithTargetBranch");
  }
}

async function preparePr() {
  const prContext = await collectPrContext({
    targetPrompt: "Choose the branch you want to open the PR against",
    defaultTarget: getExtensionConfig().defaultTargetBranch
  });

  if (!prContext) {
    return;
  }

  outputChannel.show(true);
  outputChannel.appendLine("=== Prepare PR ===");
  outputChannel.appendLine(`Host: ${prContext.remote.hostType || "unknown"}`);
  outputChannel.appendLine(`Remote: ${prContext.remote.webBaseUrl || prContext.remote.rawUrl || "unknown"}`);
  outputChannel.appendLine(`Head: ${prContext.currentBranch}`);
  outputChannel.appendLine(`Base: ${prContext.targetBranch}`);
  outputChannel.appendLine("");
  outputChannel.appendLine(`Suggested title: ${prContext.suggestedTitle}`);
  outputChannel.appendLine("Suggested body:");
  outputChannel.appendLine(prContext.suggestedBody);

  const action = await vscode.window.showInformationMessage(
    "PR details prepared. See output panel.",
    "Create PR"
  );

  if (action === "Create PR") {
    await createPr(prContext);
  }
}

async function createPr(existingContext) {
  const prContext = existingContext || (await collectPrContext({
    targetPrompt: "Choose the branch you want to open the PR against",
    defaultTarget: getExtensionConfig().defaultTargetBranch
  }));

  if (!prContext) {
    return;
  }

  if (!prContext.remote.hostType || !prContext.remote.repoPath || !prContext.remote.webBaseUrl) {
    vscode.window.showErrorMessage("PR creation currently supports GitHub and GitLab remotes only.");
    return;
  }

  const preferredMode = getExtensionConfig().preferredPrMode;
  const availableModes = await getAvailablePrModes(prContext.remote.hostType);
  const picked = await choosePrMode(preferredMode, availableModes);
  if (!picked) {
    return;
  }

  if (picked.type === "cli-gh") {
    await runToolAndReport(
      "gh",
      [
        "pr",
        "create",
        "--base",
        prContext.targetBranch,
        "--head",
        prContext.currentBranch,
        "--title",
        prContext.suggestedTitle,
        "--body",
        prContext.suggestedBody
      ],
      "Create PR with gh"
    );
    return;
  }

  if (picked.type === "cli-glab") {
    await runToolAndReport(
      "glab",
      [
        "mr",
        "create",
        "--source-branch",
        prContext.currentBranch,
        "--target-branch",
        prContext.targetBranch,
        "--title",
        prContext.suggestedTitle,
        "--description",
        prContext.suggestedBody
      ],
      "Create MR with glab"
    );
    return;
  }

  const url = buildPrUrl(prContext.remote, prContext.targetBranch, prContext.currentBranch, prContext.suggestedTitle, prContext.suggestedBody);
  if (!url) {
    vscode.window.showErrorMessage("Could not build a PR URL for this remote.");
    return;
  }

  await vscode.env.openExternal(vscode.Uri.parse(url));
  vscode.window.showInformationMessage("Opened PR creation page in your browser.");
}

async function syncBranch() {
  const choice = await vscode.window.showQuickPick(
    [
      { label: "Safe sync (fetch + pull)", description: "Simple pull from remote", mode: "pull" },
      { label: "Clean sync (fetch + pull --rebase)", description: "Replay local commits on top of remote", mode: "rebase" }
    ],
    { placeHolder: "How do you want to sync this branch?" }
  );

  if (!choice) {
    return;
  }

  const fetchResult = await runGit(["fetch", "--all", "--prune"]);
  if (!fetchResult.ok) {
    showGitFailure("Sync branch", fetchResult.stderr);
    return;
  }

  if (choice.mode === "rebase") {
    await runGitAndReport(["pull", "--rebase"], "Sync branch");
    return;
  }

  await runGitAndReport(["pull"], "Sync branch");
}

async function saveWorkQuickly() {
  const choice = await vscode.window.showQuickPick(
    [
      { label: "Stage all and commit", description: "Fast save point with a commit", action: "commit" },
      { label: "Stash changes", description: "Save work without committing", action: "stash" },
      { label: "Stage only current file", description: "Keep the save focused", action: "current-file" }
    ],
    { placeHolder: "How do you want to save your work?" }
  );

  if (!choice) {
    return;
  }

  if (choice.action === "commit") {
    const addResult = await runGit(["add", "."]);
    if (!addResult.ok) {
      showGitFailure("Save work quickly", addResult.stderr);
      return;
    }
    await vscode.commands.executeCommand("gitShortcutsDoctor.commit");
    return;
  }

  if (choice.action === "stash") {
    await vscode.commands.executeCommand("gitShortcutsDoctor.stashPush");
    return;
  }

  await vscode.commands.executeCommand("gitShortcutsDoctor.addCurrentFile");
}

async function undoLastMistake() {
  const choice = await vscode.window.showQuickPick(
    [
      { label: "Undo last commit, keep changes", description: "git reset --soft HEAD~1", action: "soft-reset" },
      { label: "Revert last commit safely", description: "git revert HEAD", action: "revert-head" },
      { label: "Discard current file changes", description: "Restore file from HEAD", action: "restore-file" }
    ],
    { placeHolder: "Choose the recovery action" }
  );

  if (!choice) {
    return;
  }

  if (choice.action === "soft-reset") {
    const confirm = await vscode.window.showWarningMessage(
      "Undo the last commit but keep the file changes staged?",
      { modal: true },
      "Undo Commit"
    );
    if (confirm === "Undo Commit") {
      await runGitAndReport(["reset", "--soft", "HEAD~1"], "Undo last commit");
    }
    return;
  }

  if (choice.action === "revert-head") {
    await runGitAndReport(["revert", "HEAD"], "Revert last commit");
    return;
  }

  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showWarningMessage("Open a file first to discard its changes.");
    return;
  }

  const targetPath = vscode.workspace.asRelativePath(activeEditor.document.uri.fsPath, false);
  const confirm = await vscode.window.showWarningMessage(
    `Discard changes in ${targetPath}?`,
    { modal: true },
    "Discard File Changes"
  );
  if (confirm === "Discard File Changes") {
    await runGitAndReport(["restore", "--source=HEAD", "--", targetPath], `Restore ${targetPath}`);
  }
}

async function amendCommit() {
  const message = await vscode.window.showInputBox({
    prompt: "Amended commit message",
    placeHolder: "feat: updated commit message"
  });

  if (!message) {
    return;
  }

  await runGitAndReport(["commit", "--amend", "-m", message], "Commit amend");
}

async function addCurrentFile() {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showWarningMessage("Open a file first to stage it.");
    return;
  }

  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showWarningMessage("Open a workspace folder first.");
    return;
  }

  const targetPath = vscode.workspace.asRelativePath(activeEditor.document.uri.fsPath, false);
  await runGitAndReport(["add", "--", targetPath], `Add ${targetPath}`);
}

async function forcePushWithLease() {
  const answer = await vscode.window.showWarningMessage(
    "Run git push --force-with-lease on the current branch?",
    { modal: true },
    "Run"
  );

  if (answer !== "Run") {
    return;
  }

  await runGitAndReport(["push", "--force-with-lease"], "Push force with lease");
}

async function createBranch() {
  const branchName = await vscode.window.showInputBox({
    prompt: "New branch name",
    placeHolder: "feature/my-branch"
  });

  if (!branchName) {
    return;
  }

  await runGitAndReport(["checkout", "-b", branchName], `Create branch ${branchName}`);
}

async function checkoutBranch() {
  const result = await runGit(["branch", "--all", "--format=%(refname:short)"]);
  if (!result.ok) {
    showGitFailure("Checkout branch", result.stderr);
    return;
  }

  const branches = normalizeBranchList(result.stdout);

  const picked = await vscode.window.showQuickPick(branches, {
    placeHolder: "Select a branch to checkout"
  });

  if (!picked) {
    return;
  }

  await runGitAndReport(["checkout", picked], `Checkout ${picked}`);
}

async function mergeBranch() {
  const branchesResult = await runGit(["branch", "--all", "--format=%(refname:short)"]);
  if (!branchesResult.ok) {
    showGitFailure("Merge branch", branchesResult.stderr);
    return;
  }

  const currentBranchResult = await runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  const currentBranch = currentBranchResult.ok ? currentBranchResult.stdout.trim() : "";
  const branches = normalizeBranchList(branchesResult.stdout).filter((branch) => branch !== currentBranch);

  const picked = await vscode.window.showQuickPick(branches, {
    placeHolder: currentBranch ? `Merge a branch into ${currentBranch}` : "Select a branch to merge"
  });

  if (!picked) {
    return;
  }

  await runGitAndReport(["merge", picked], `Merge ${picked}`);
}

async function stashPush() {
  const message = await vscode.window.showInputBox({
    prompt: "Optional stash message",
    placeHolder: "WIP before switching branch"
  });

  const args = message ? ["stash", "push", "-m", message] : ["stash", "push"];
  await runGitAndReport(args, "Stash push");
}

async function openConflictCenter() {
  const conflictResult = await runGit(["diff", "--name-only", "--diff-filter=U"]);
  if (!conflictResult.ok) {
    showGitFailure("Conflict Center", conflictResult.stderr);
    return;
  }

  const conflictedFiles = conflictResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!conflictedFiles.length) {
    const followUp = await vscode.window.showQuickPick(
      [
        { label: "Run Git Doctor", description: "Check for other Git problems", command: "gitShortcutsDoctor.gitDoctor" },
        { label: "Show Git Status", description: "Inspect the working tree", command: "gitShortcutsDoctor.gitStatus" }
      ],
      { placeHolder: "No unresolved conflicts found." }
    );

    if (followUp) {
      await vscode.commands.executeCommand(followUp.command);
    }
    return;
  }

  const items = [
    workflowSeparator("Conflicted Files"),
    ...conflictedFiles.map((file) => ({
      label: file,
      description: "Open file",
      detail: "Review and resolve this file",
      action: "open-file",
      file
    })),
    workflowSeparator("Recovery Actions"),
    { label: "Accept Current Change", description: "Use current side", detail: "Shortcut: Ctrl+Alt+G 1", action: "command", command: "gitShortcutsDoctor.acceptCurrent" },
    { label: "Accept Incoming Change", description: "Use incoming side", detail: "Shortcut: Ctrl+Alt+G 2", action: "command", command: "gitShortcutsDoctor.acceptIncoming" },
    { label: "Accept Both Changes", description: "Keep both sides", detail: "Shortcut: Ctrl+Alt+G 3", action: "command", command: "gitShortcutsDoctor.acceptBoth" },
    { label: "Next Conflict", description: "Jump to next conflict", detail: "Shortcut: Ctrl+Alt+G ]", action: "command", command: "gitShortcutsDoctor.nextConflict" },
    { label: "Abort Merge", description: "Exit merge recovery", detail: "Shortcut: Ctrl+Alt+G M", action: "command", command: "gitShortcutsDoctor.abortMerge" },
    { label: "Abort Rebase", description: "Exit rebase recovery", detail: "Shortcut: Ctrl+Alt+G R", action: "command", command: "gitShortcutsDoctor.abortRebase" },
    { label: "Show Git Doctor", description: "See recommended next action", detail: "Shortcut: Ctrl+Alt+G H", action: "command", command: "gitShortcutsDoctor.gitDoctor" }
  ];

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: `${conflictedFiles.length} conflicted file(s) found`
  });

  if (!picked) {
    return;
  }

  if (picked.action === "open-file") {
    const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
    if (!folder) {
      return;
    }
    const fileUri = vscode.Uri.joinPath(folder.uri, picked.file);
    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc);
    return;
  }

  if (picked.command) {
    await vscode.commands.executeCommand(picked.command);
  }
}

async function runCustomGit() {
  const rawCommand = await vscode.window.showInputBox({
    prompt: "Run a custom Git command",
    placeHolder: "git cherry-pick <commit> or checkout feature/login"
  });

  if (!rawCommand) {
    return;
  }

  const parsedArgs = parseGitCommand(rawCommand);
  if (!parsedArgs.length) {
    vscode.window.showWarningMessage("Enter a valid Git command.");
    return;
  }

  if (parsedArgs[0] === "git") {
    parsedArgs.shift();
  }

  if (!parsedArgs.length) {
    vscode.window.showWarningMessage("Enter the part after git, for example: status or pull origin main.");
    return;
  }

  await runGitAndReport(parsedArgs, `Git ${parsedArgs[0]}`);
}

async function showGitDoctor() {
  const checks = await Promise.all([
    runGit(["rev-parse", "--is-inside-work-tree"]),
    runGit(["status", "--short", "--branch"]),
    runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
    runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"])
  ]);

  if (!checks[0].ok) {
    vscode.window.showErrorMessage("Git Doctor: open a folder inside a Git repository first.");
    return;
  }

  const statusText = checks[1].ok ? checks[1].stdout : "";
  const branch = checks[2].ok ? checks[2].stdout.trim() : "unknown";
  const upstream = checks[3].ok ? checks[3].stdout.trim() : "";
  const advice = buildDoctorAdvice(statusText, lastGitError, branch, upstream);
  const suggestion = pickDoctorSuggestion(advice);

  outputChannel.show(true);
  outputChannel.appendLine("=== Git Doctor ===");
  outputChannel.appendLine(`Branch: ${branch}`);
  outputChannel.appendLine(`Upstream: ${upstream || "not configured"}`);
  outputChannel.appendLine("");
  outputChannel.appendLine("Status:");
  outputChannel.appendLine(statusText || "(empty)");
  outputChannel.appendLine("");
  outputChannel.appendLine("Advice:");
  advice.forEach((line) => outputChannel.appendLine(`- ${line}`));

  const picked = await vscode.window.showInformationMessage(
    `Git Doctor reported ${advice.length} item(s). See output panel.`,
    ...(suggestion ? [suggestion.label] : [])
  );

  if (suggestion && picked === suggestion.label) {
    await vscode.commands.executeCommand(suggestion.command);
  }
}

function buildDoctorAdvice(statusText, errorText, branch, upstream) {
  const advice = [];

  if (/^## HEAD \(no branch\)/m.test(statusText)) {
    advice.push("You are in detached HEAD. Create or checkout a branch before committing long-lived work.");
  }

  if (/^UU /m.test(statusText) || /^AA /m.test(statusText) || /^DD /m.test(statusText)) {
    advice.push("Merge conflicts are present. Use the conflict shortcuts or open the Merge Editor, then git add the resolved files.");
  }

  if (/rebase in progress/i.test(statusText)) {
    advice.push("A rebase is in progress. Finish with git rebase --continue after resolving conflicts, or abort with the rebase shortcut.");
  }

  if (/You are currently merging/i.test(errorText) || /MERGE_HEAD exists/i.test(errorText)) {
    advice.push("A merge is incomplete. Resolve conflicts and commit, or use Abort Merge to back out.");
  }

  if (/CONFLICT/i.test(errorText)) {
    advice.push("Git reported a conflict. Inspect conflicted files, accept the desired hunks, stage them, then continue the merge or rebase.");
  }

  if (/not possible because you have unmerged files/i.test(errorText)) {
    advice.push("Unmerged files are blocking the command. Resolve every conflict marker before retrying.");
  }

  if (/Your branch is ahead of/i.test(statusText)) {
    advice.push("Local commits have not been pushed yet. Use Push when ready.");
  }

  if (/have diverged/i.test(statusText)) {
    advice.push("Local and remote history diverged. Fetch first, inspect the branch, then rebase or merge intentionally.");
  }

  if (/behind /i.test(statusText)) {
    advice.push("Your branch is behind its upstream. Sync the branch before pushing more work.");
  }

  if (/^\s?[MADRCU\?]{1,2}\s/m.test(statusText)) {
    advice.push("Working tree has changes. Save them with a commit or stash before risky branch operations.");
  }

  if (!upstream) {
    advice.push(`Branch ${branch} has no upstream. First push may need: git push -u origin ${branch}.`);
  }

  if (/nothing to commit, working tree clean/i.test(statusText)) {
    advice.push("Working tree is clean. If Git still failed, inspect the last error in the output panel.");
  }

  if (!advice.length) {
    advice.push("No obvious Git problem detected. Run Git Status and inspect the output panel for the last command result.");
  }

  return advice;
}

function pickDoctorSuggestion(advice) {
  const rules = [
    {
      pattern: /Merge conflicts are present|Git reported a conflict|Unmerged files are blocking/i,
      suggestion: { label: "Open Conflict Center", command: "gitShortcutsDoctor.conflictCenter" }
    },
    {
      pattern: /behind its upstream|diverged/i,
      suggestion: { label: "Sync Branch", command: "gitShortcutsDoctor.syncBranch" }
    },
    {
      pattern: /has no upstream/i,
      suggestion: { label: "Push Branch", command: "gitShortcutsDoctor.push" }
    },
    {
      pattern: /Working tree has changes/i,
      suggestion: { label: "Save Work Quickly", command: "gitShortcutsDoctor.saveWorkQuickly" }
    }
  ];

  for (const line of advice) {
    for (const rule of rules) {
      if (rule.pattern.test(line)) {
        return rule.suggestion;
      }
    }
  }

  return null;
}

async function collectPrContext(options) {
  const settings = getExtensionConfig();
  const targetBranch = await pickTargetBranch(options.targetPrompt, options.defaultTarget);
  if (!targetBranch) {
    return null;
  }

  const remote = await getRemoteInfo();
  if (!remote) {
    return null;
  }

  const branchResult = await runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branchResult.ok) {
    showGitFailure("Prepare PR", branchResult.stderr);
    return null;
  }

  const currentBranch = branchResult.stdout.trim();
  const compareBase = await resolveLocalBranchName(targetBranch);
  const logResult = await runGit(["log", "--oneline", `${compareBase}..${currentBranch}`]);
  const commitLines = logResult.ok ? logResult.stdout.split(/\r?\n/).filter(Boolean) : [];
  const statusResult = await runGit(["status", "--short"]);
  const hasUncommittedChanges = !!(statusResult.ok && statusResult.stdout.trim());
  const firstCommit = commitLines[0] ? commitLines[0].replace(/^[a-f0-9]+\s+/i, "") : `PR: ${currentBranch} -> ${targetBranch}`;
  const templateValues = {
    branch: currentBranch,
    target: targetBranch,
    firstCommit,
    commitCount: String(commitLines.length),
    commitBullets: commitLines.length ? commitLines.map((line) => `- ${line}`).join("\n") : "- No commits detected",
    workingTreeClean: hasUncommittedChanges ? "no" : "yes"
  };
  const suggestedTitle = applyTemplate(settings.prTitleTemplate, templateValues).trim() || firstCommit;
  const suggestedBody = applyTemplate(settings.prBodyTemplate, templateValues).trim() || buildDefaultPrBody(targetBranch, commitLines, hasUncommittedChanges);

  return {
    currentBranch,
    targetBranch,
    remote,
    commitLines,
    hasUncommittedChanges,
    suggestedTitle,
    suggestedBody
  };
}

function buildDefaultPrBody(targetBranch, commitLines, hasUncommittedChanges) {
  const lines = [
    `Target branch: ${targetBranch}`,
    "",
    "Summary",
    "- Update this section before submitting the PR."
  ];

  if (commitLines.length) {
    lines.push("", "Included commits");
    commitLines.slice(0, 10).forEach((line) => lines.push(`- ${line}`));
  }

  if (hasUncommittedChanges) {
    lines.push("", "Note");
    lines.push("- Working tree still has local changes. Review before submitting.");
  }

  return lines.join("\n");
}

function applyTemplate(template, values) {
  return Object.keys(values).reduce((output, key) => {
    return output.replace(new RegExp(`\\{${key}\\}`, "g"), values[key]);
  }, template);
}

async function getRemoteInfo() {
  const remoteResult = await runGit(["remote", "get-url", "origin"]);
  if (!remoteResult.ok) {
    showGitFailure("Get remote", remoteResult.stderr);
    return null;
  }

  const rawUrl = remoteResult.stdout.trim();
  const parsed = parseRemoteUrl(rawUrl);

  return {
    rawUrl,
    hostType: parsed.hostType,
    host: parsed.host,
    repoPath: parsed.repoPath,
    webBaseUrl: parsed.host && parsed.repoPath ? `https://${parsed.host}/${parsed.repoPath}` : ""
  };
}

function parseRemoteUrl(rawUrl) {
  const sshMatch = rawUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return buildRemoteParts(sshMatch[1], sshMatch[2]);
  }

  const httpsMatch = rawUrl.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return buildRemoteParts(httpsMatch[1], httpsMatch[2]);
  }

  return { hostType: "", host: "", repoPath: "" };
}

function buildRemoteParts(host, repoPath) {
  const cleanPath = repoPath.replace(/\.git$/, "");
  let hostType = "";
  if (/github\.com$/i.test(host)) {
    hostType = "github";
  } else if (/gitlab\./i.test(host) || /^gitlab$/i.test(host)) {
    hostType = "gitlab";
  }

  return {
    hostType,
    host,
    repoPath: cleanPath
  };
}

function buildPrUrl(remote, targetBranch, currentBranch, title, body) {
  if (remote.hostType === "github") {
    const comparePath = `${remote.webBaseUrl}/compare/${encodeURIComponent(targetBranch)}...${encodeURIComponent(currentBranch)}`;
    const params = new URLSearchParams({
      expand: "1",
      title,
      body
    });
    return `${comparePath}?${params.toString()}`;
  }

  if (remote.hostType === "gitlab") {
    const params = new URLSearchParams({
      "merge_request[source_branch]": currentBranch,
      "merge_request[target_branch]": targetBranch,
      "merge_request[title]": title,
      "merge_request[description]": body
    });
    return `${remote.webBaseUrl}/-/merge_requests/new?${params.toString()}`;
  }

  return "";
}

async function getAvailablePrModes(hostType) {
  const modes = [];
  if (hostType === "github" && (await commandExists("gh"))) {
    modes.push({ label: "Create with gh", type: "cli-gh" });
  }
  if (hostType === "gitlab" && (await commandExists("glab"))) {
    modes.push({ label: "Create with glab", type: "cli-glab" });
  }
  modes.push({ label: "Open in browser", type: "browser" });
  return modes;
}

async function choosePrMode(preferredMode, availableModes) {
  if (preferredMode === "browser") {
    return availableModes.find((mode) => mode.type === "browser") || null;
  }

  if (preferredMode === "cli") {
    const cliMode = availableModes.find((mode) => mode.type.startsWith("cli-"));
    if (cliMode) {
      return cliMode;
    }
    vscode.window.showWarningMessage("Preferred PR mode is CLI, but no supported CLI tool was found. Falling back to browser.");
    return availableModes.find((mode) => mode.type === "browser") || null;
  }

  if (preferredMode === "auto") {
    return availableModes.find((mode) => mode.type.startsWith("cli-")) || availableModes.find((mode) => mode.type === "browser") || null;
  }

  const picked = await vscode.window.showQuickPick(availableModes, {
    placeHolder: "Choose how to create the PR/MR"
  });
  return picked || null;
}

function commandExists(tool) {
  return new Promise((resolve) => {
    cp.execFile(tool, ["--version"], { windowsHide: true }, (error) => {
      resolve(!error);
    });
  });
}

async function runToolAndReport(tool, args, title) {
  const result = await runProcess(tool, args);
  if (!result.ok) {
    outputChannel.show(true);
    outputChannel.appendLine(`Error during ${title}:`);
    outputChannel.appendLine(result.stderr || "(no stderr output)");
    vscode.window.showErrorMessage(`${title} failed. Check the output panel.`);
    return;
  }

  outputChannel.show(true);
  outputChannel.appendLine(`$ ${tool} ${args.join(" ")}`);
  outputChannel.appendLine(result.stdout || "(command completed with no output)");
  vscode.window.showInformationMessage(`${title} completed.`);
}

function runProcess(command, args) {
  return new Promise((resolve) => {
    cp.execFile(command, args, { cwd: getWorkspaceRoot(), windowsHide: true }, (error, stdout, stderr) => {
      const output = (stdout || "").trim();
      const err = (stderr || error?.message || "").trim();

      if (error) {
        resolve({ ok: false, stdout: output, stderr: err });
        return;
      }

      resolve({ ok: true, stdout: output, stderr: err });
    });
  });
}

async function pickTargetBranch(placeHolder, preferredBranch) {
  const branchesResult = await runGit(["branch", "--all", "--format=%(refname:short)"]);
  if (!branchesResult.ok) {
    showGitFailure("Target branch", branchesResult.stderr);
    return "";
  }

  const branches = normalizeBranchList(branchesResult.stdout);
  const preferredOptions = [preferredBranch, `origin/${preferredBranch}`, "develop", "origin/develop"];
  const prioritized = Array.from(new Set([...preferredOptions.filter((name) => branches.includes(name)), ...branches]));

  const picked = await vscode.window.showQuickPick(prioritized, {
    placeHolder
  });

  return picked || "";
}

async function checkoutBestAvailableBranch(targetBranch) {
  const localName = await resolveLocalBranchName(targetBranch);
  const result = await runGit(["checkout", localName]);

  if (result.ok) {
    return result;
  }

  if (targetBranch.startsWith("origin/")) {
    const branchName = targetBranch.replace(/^origin\//, "");
    return runGit(["checkout", "-b", branchName, "--track", targetBranch]);
  }

  return result;
}

async function resolveLocalBranchName(targetBranch) {
  if (!targetBranch.startsWith("origin/")) {
    return targetBranch;
  }

  const localName = targetBranch.replace(/^origin\//, "");
  const checkLocal = await runGit(["show-ref", "--verify", `refs/heads/${localName}`]);
  if (checkLocal.ok) {
    return localName;
  }

  return targetBranch;
}

function normalizeBranchList(rawBranches) {
  return Array.from(
    new Set(
      rawBranches
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^\*\s*/, ""))
        .map((line) => line.replace(/^remotes\//, ""))
        .filter((line) => !line.endsWith("/HEAD"))
    )
  ).sort();
}

async function runGitAndReport(args, title) {
  const result = await runGit(args);
  if (!result.ok) {
    showGitFailure(title, result.stderr);
    return;
  }

  outputChannel.show(true);
  outputChannel.appendLine(`$ git ${args.join(" ")}`);
  outputChannel.appendLine(result.stdout || "(command completed with no output)");
  vscode.window.showInformationMessage(`${title} completed.`);
}

function showGitFailure(title, stderr) {
  const doctorHint = explainGitError(stderr);
  outputChannel.show(true);
  outputChannel.appendLine(`Error during ${title}:`);
  outputChannel.appendLine(stderr || "(no stderr output)");

  if (doctorHint) {
    outputChannel.appendLine("");
    outputChannel.appendLine(`Hint: ${doctorHint}`);
  }

  vscode.window.showErrorMessage(doctorHint ? `${title} failed. ${doctorHint}` : `${title} failed. Check the output panel.`);
}

function explainGitError(stderr) {
  const knownErrors = [
    {
      pattern: /not a git repository/i,
      advice: "Open a folder that contains a .git directory."
    },
    {
      pattern: /Merge conflict|CONFLICT/i,
      advice: "Resolve conflicts, stage the files, then continue the operation."
    },
    {
      pattern: /Your local changes to the following files would be overwritten/i,
      advice: "Commit or stash local changes before switching branches or pulling."
    },
    {
      pattern: /The current branch .* has no upstream branch/i,
      advice: "Set an upstream branch on first push, for example with git push -u origin <branch>."
    },
    {
      pattern: /non-fast-forward/i,
      advice: "Fetch and rebase or merge remote changes before pushing again."
    },
    {
      pattern: /MERGE_HEAD exists/i,
      advice: "A merge is already in progress. Finish it or abort it before starting another."
    },
    {
      pattern: /rebase in progress/i,
      advice: "A rebase is already running. Continue or abort the current rebase before retrying."
    },
    {
      pattern: /Please commit your changes or stash them before you merge/i,
      advice: "Commit or stash your local work before pulling or merging another branch."
    },
    {
      pattern: /pathspec .* did not match any file\(s\) known to git/i,
      advice: "The branch, file, or ref does not exist locally. Check the spelling or fetch remote branches first."
    }
  ];

  for (const item of knownErrors) {
    if (item.pattern.test(stderr)) {
      return item.advice;
    }
  }

  return "";
}

function parseGitCommand(input) {
  const matches = input.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ""));
}

function runGit(args) {
  const cwd = getWorkspaceRoot();
  return new Promise((resolve) => {
    if (!cwd) {
      resolve({ ok: false, stdout: "", stderr: "No workspace folder is open." });
      return;
    }

    outputChannel.appendLine(`$ git ${args.join(" ")}`);

    cp.execFile("git", args, { cwd, windowsHide: true }, (error, stdout, stderr) => {
      const output = (stdout || "").trim();
      const err = (stderr || error?.message || "").trim();

      if (error) {
        lastGitError = err;
        resolve({ ok: false, stdout: output, stderr: err });
        return;
      }

      lastGitError = "";
      resolve({ ok: true, stdout: output, stderr: err });
    });
  });
}

function getWorkspaceRoot() {
  const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  return folder ? folder.uri.fsPath : "";
}

module.exports = {
  activate,
  deactivate
};
