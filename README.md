# Git Shortcuts Doctor

Git Shortcuts Doctor is now a Git workflow assistant for VS Code, not just a shortcut pack.

It combines:

- easy keyboard shortcuts
- workflow-based actions
- PR-focused helpers
- a conflict recovery hub
- smart Git Doctor suggestions

All shortcuts use one pattern:

- Windows/Linux: `Ctrl+Alt+G`
- macOS: `Cmd+Alt+G`

After that, press one more key for the action you want.

## Easy examples

- `Ctrl+Alt+G S` for status
- `Ctrl+Alt+G C` for commit
- `Ctrl+Alt+G P` for push
- `Ctrl+Alt+G W` to start a feature branch
- `Ctrl+Alt+G J` to start a PR branch from `main`
- `Ctrl+Alt+G I` to sync your branch with the PR target
- `Ctrl+Alt+G V` to check PR readiness
- `Ctrl+Alt+G Y` to sync your branch
- `Ctrl+Alt+G Q` to open Conflict Center
- `Ctrl+Alt+G 1` to accept current conflict change
- `Ctrl+Alt+G 2` to accept incoming conflict change
- `Ctrl+Alt+G 3` to accept both changes
- `Ctrl+Alt+G H` to run Git Doctor

You can also click the status bar button `Git Keys` to open a shortcut guide and action picker.

This project now includes the most common Git commands directly, and also a custom Git runner for commands not mapped to a built-in shortcut yet.

## What makes it different

- `Start Feature`: creates a new working branch quickly
- `Start PR Branch`: creates a working branch from `main`, `develop`, or another target branch
- `Sync With Target Branch`: updates your current branch from the PR target branch
- `Check PR Readiness`: checks conflicts, upstream, clean working tree, and commit difference before PR
- `Prepare PR`: builds a suggested PR title and body from your branch and commits
- `Create PR`: opens or creates a PR/MR for GitHub or GitLab
- `Sync Branch`: lets you choose safe pull or pull with rebase
- `Save Work Quickly`: helps you commit, stash, or stage current file
- `Undo Last Mistake`: gives safe recovery actions
- `Conflict Center`: shows conflicted files and recovery commands in one place
- `Git Doctor`: detects problems and suggests the next action directly

## Included commands

- `Start Feature`
- `Start PR Branch`
- `Sync With Target Branch`
- `Check PR Readiness`
- `Prepare PR`
- `Create PR`
- `Sync Branch`
- `Save Work Quickly`
- `Undo Last Mistake`
- `Conflict Center`
- `Git Status`
- `Fetch All`
- `Pull Latest`
- `Pull Rebase`
- `Add All`
- `Add Current File`
- `Commit`
- `Commit Amend`
- `Push`
- `Push Force With Lease`
- `Create Branch`
- `Checkout Branch`
- `Merge Branch`
- `Stash Push`
- `Stash Pop`
- `Abort Merge`
- `Abort Rebase`
- `Accept Current Change`
- `Accept Incoming Change`
- `Accept Both Changes`
- `Next Conflict`
- `Previous Conflict`
- `Diagnose Git State`
- `Run Custom Git Command`

## Shortcut keys

- `Ctrl+Alt+G D`: open dashboard
- `Ctrl+Alt+G W`: start feature
- `Ctrl+Alt+G J`: start PR branch
- `Ctrl+Alt+G I`: sync with target branch
- `Ctrl+Alt+G V`: check PR readiness
- `Ctrl+Alt+G Shift+V`: prepare PR
- `Ctrl+Alt+G Shift+J`: create PR
- `Ctrl+Alt+G Y`: sync branch
- `Ctrl+Alt+G K`: save work quickly
- `Ctrl+Alt+G Z`: undo last mistake
- `Ctrl+Alt+G Q`: conflict center
- `Ctrl+Alt+G S`: status
- `Ctrl+Alt+G F`: fetch all
- `Ctrl+Alt+G U`: pull latest
- `Ctrl+Alt+G L`: pull with rebase
- `Ctrl+Alt+G A`: add all
- `Ctrl+Alt+G .`: add current file
- `Ctrl+Alt+G C`: commit
- `Ctrl+Alt+G Shift+C`: commit amend
- `Ctrl+Alt+G P`: push
- `Ctrl+Alt+G Shift+P`: push force with lease
- `Ctrl+Alt+G N`: create branch
- `Ctrl+Alt+G B`: checkout branch
- `Ctrl+Alt+G E`: merge branch into current branch
- `Ctrl+Alt+G T`: stash push
- `Ctrl+Alt+G O`: stash pop
- `Ctrl+Alt+G M`: abort merge
- `Ctrl+Alt+G R`: abort rebase
- `Ctrl+Alt+G 1`: accept current conflict
- `Ctrl+Alt+G 2`: accept incoming conflict
- `Ctrl+Alt+G 3`: accept both conflicts
- `Ctrl+Alt+G [`: previous conflict
- `Ctrl+Alt+G ]`: next conflict
- `Ctrl+Alt+G H`: Git Doctor
- `Ctrl+Alt+G X`: run any custom Git command

## Examples

- `Ctrl+Alt+G J`: create a new PR branch from `main`
- `Ctrl+Alt+G I`: rebase or merge your branch with `main` before updating the PR
- `Ctrl+Alt+G V`: check if your branch is clean and ready for PR
- `Ctrl+Alt+G Shift+V`: generate a suggested PR title and description
- `Ctrl+Alt+G Shift+J`: open or create the PR in GitHub or GitLab
- `Ctrl+Alt+G B`: checkout a different branch
- `Ctrl+Alt+G U`: pull latest changes from remote
- `Ctrl+Alt+G E`: merge another branch into your current branch
- `Ctrl+Alt+G Y`: fetch and choose whether to pull or rebase
- `Ctrl+Alt+G Q`: open the list of conflicted files and recovery actions
- `Ctrl+Alt+G Z`: undo a bad last commit without losing changes
- `Ctrl+Alt+G X`, then type `git cherry-pick abc1234`
- `Ctrl+Alt+G X`, then type `git reset HEAD~1`

## PR support

This extension helps with Git work around pull requests:

- create the branch you want to use for the PR
- sync your current branch with `main`, `develop`, or another target branch
- check if your branch is behind target, has conflicts, or has uncommitted changes
- see which commits would be included in the PR
- generate a suggested PR title and body from commit history
- create a GitHub PR or GitLab MR from inside VS Code

PR creation works like this:

- if the repo remote is GitHub and `gh` is installed, it can run `gh pr create`
- if the repo remote is GitLab and `glab` is installed, it can run `glab mr create`
- otherwise it opens the browser on the correct GitHub or GitLab PR/MR creation page

Current platform support:

- GitHub
- GitLab

Bitbucket direct PR creation is not implemented yet.

## Settings

You can configure the extension from VS Code Settings:

- `gitShortcutsDoctor.defaultTargetBranch`
  Example: `main` or `develop`
- `gitShortcutsDoctor.preferredPrMode`
  Options: `auto`, `cli`, `browser`
- `gitShortcutsDoctor.prTitleTemplate`
  Placeholders: `{branch}`, `{target}`, `{firstCommit}`, `{commitCount}`
- `gitShortcutsDoctor.prBodyTemplate`
  Placeholders: `{branch}`, `{target}`, `{firstCommit}`, `{commitCount}`, `{commitBullets}`, `{workingTreeClean}`

Example templates:

- PR title: `{branch} -> {target}: {firstCommit}`
- PR body:
  `Target branch: {target}`
  ``
  `Included commits`
  `{commitBullets}`

## Project structure

- `package.json`: extension manifest, commands, and keybindings
- `src/extension.js`: command handlers and Git integration

## Run locally

1. Open this project in VS Code.
2. Press `F5` to launch the Extension Development Host.
3. In the new window, open a Git repository folder.
4. Run `Git Shortcuts Doctor: Open Dashboard` from the command palette.

## Next improvements

- add more Git commands in grouped menus
- detect more Git error messages
- show branch comparison details
- add automated tests for command handlers
