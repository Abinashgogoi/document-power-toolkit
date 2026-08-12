# GitHub Direct Push Runbook

Reusable workflow for projects where the ChatGPT GitHub connector can inspect repository data but cannot complete the required local Git push workflow.

## Core rule

Do not reuse SSH deploy keys, SSH config aliases, remotes, or credentials across unrelated repositories. Every repository gets its own `.deploy-keys/` directory and SSH host alias.

## Preferred sequence

1. Inspect the current project only:

```bash
pwd
git status --short --branch
git remote -v
git branch --show-current
git log -1 --oneline
gh --version
gh auth status
```

2. Resolve the exact target repository and branch from the current project. Never substitute another repository.

3. If `gh` is missing, install/download GitHub CLI from the official GitHub CLI release.

4. Authenticate GitHub CLI using the browser/device flow:

```bash
gh auth login
```

Choose GitHub.com and follow the displayed one-time code/browser authorization flow. The user must complete the GitHub authorization in the browser. Then verify:

```bash
gh auth status
```

5. Create or verify the target repository with GitHub CLI when needed. Confirm owner, repository name, visibility, and default branch before pushing.

6. Create a repository-specific SSH deploy key, stored only under the current workspace:

```text
<workspace>/.deploy-keys/
  <repo>_ed25519
  <repo>_ed25519.pub
  ssh_config
```

7. Add the public key to that repository as a deploy key with write access. Never upload or expose the private key.

8. Use a repository-specific SSH host alias in `ssh_config`, for example:

```sshconfig
Host github-document-power-toolkit
  HostName github.com
  User git
  IdentityFile /absolute/path/to/.deploy-keys/document_power_toolkit_ed25519
  IdentitiesOnly yes
```

9. Point `origin` to the alias:

```bash
git remote set-url origin git@github-document-power-toolkit:Abinashgogoi/document-power-toolkit.git
```

10. Verify SSH connectivity with the same repository config.

11. Inspect the worktree and stage only intended files. Secrets and deploy keys must stay ignored.

12. Commit intentionally.

13. Push using the repository-specific SSH config explicitly. This is the critical command that solved the prior custom-host/config resolution failure:

```bash
GIT_SSH_COMMAND='ssh -F <workspace>/.deploy-keys/ssh_config' git push origin main
```

If pushing a different branch, replace `main` with the verified current branch.

14. Verify the remote branch/commit after push.

15. Verify GitHub Actions for the pushed commit. Inspect failing jobs/logs and repair before calling the publish complete.

## Known failure pattern from the previous successful case

A normal `git push origin main` failed because the custom SSH hostname/config was not being resolved. Repeating connector attempts did not solve it. The successful push explicitly supplied the repository-specific SSH config through `GIT_SSH_COMMAND`.

## Current Document Power Toolkit target

- Owner: `Abinashgogoi`
- Repository: `document-power-toolkit`
- Branch: `main`
- Local remote alias: `github-document-power-toolkit`
- Current project key/config directory: `.deploy-keys/`

## Current Chat-runtime blocker diagnosis (2026-08-13)

The current Chat container has Git, but its generated package/network environment is broken/isolated:

- `gh` executable absent.
- `ssh` executable absent.
- `/etc/apt/sources.list.d/debian.sources` contains malformed `https:///artifactory/...` URIs.
- `/etc/npmrc` contains malformed `registry=https:///`.
- Direct DNS/network access to `github.com`, `api.github.com`, Debian, and npm endpoints is unavailable from the container.
- Manually mapping current GitHub IPs in `/etc/hosts` still does not provide outbound TCP connectivity, confirming this is not DNS-only.

Therefore the current container can prepare Git state/key/config, but cannot complete CLI download, browser-device authentication, SSH handshake, or raw `git push` until an execution environment with outbound network access is available.

## Completion checklist

- [ ] Exact repo exists and is verified
- [ ] `gh` installed
- [ ] `gh auth status` authenticated
- [ ] Repository-specific deploy public key attached with write access
- [ ] SSH connectivity verified with repo config
- [ ] Intended files staged
- [ ] Initial/incremental commit created
- [ ] Explicit `GIT_SSH_COMMAND` push succeeded
- [ ] Remote commit verified
- [ ] GitHub Actions run verified
- [ ] Any failing CI repaired
