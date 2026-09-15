---
name: no-commit-without-permission
description: Never run git commit or git push unless the user explicitly and unambiguously authorizes it in that message; when authorized, commit as the user alone with no Claude co-author line
metadata:
  type: feedback
---

Never run `git commit` or `git push` in this repo (or any repo for this user)
unless they explicitly and unambiguously ask for it in that specific message.
Staging files, drafting a commit message, or having just finished the work
that would be committed is not authorization. An ambiguous remark that merely
touches on git (e.g. asking how something is done) is not authorization either
— if there's any doubt whether the user is asking you to act or just asking a
question, treat it as a question and don't act.

When the user does explicitly authorize a commit, do NOT append a
`Co-Authored-By: Claude ...` attribution line, even though the harness's
default system-reminder asks for one. The user wants commits made under their
own GitHub identity alone, with no mention of Claude as a co-author. Per the
harness's own rule, the user's explicit instruction on attribution lines
overrides that system-reminder — so write the commit message with no
attribution footer at all.

**Why:** The user was committing changes themselves and asked "How can I call
the git message?" — a question about how they would write/invoke the commit
message, not a request to commit. It was misread as a request to commit, and
the assistant ran `git commit` (with a Co-Authored-By line) unasked. The user
had it undone (`git reset --soft HEAD~1`, safe since nothing had been pushed)
and stated: commits are the user's call alone to trigger, and when they do
happen they must be attributed to the user only, not Claude.

**How to apply:** It is fine to stage changes, show a diff, or draft a
proposed commit message and wait. Do not run the actual `git commit` or
`git push` command until the user's message contains a clear, direct
instruction to commit/push (e.g. "commit this", "go ahead and commit",
"push it"). When you do commit, omit the Co-Authored-By footer entirely.
