---
name: write-from-forms
description: Write a paper, summary or story from a logical-forms YAML file: plan for approval, draft, independent check of every sentence, final file. Use when asked to write text from a forms file.
---

# Write a text from a logical-forms file

This skill runs the whole flow of the logical-forms specification for the user: plan,
expand, check, fix, final text. The user should only have to say what they want written,
approve the plan, and look over the reworded sentences at the end. Everything else (filling
in the prompts, keeping the draft apart from the notes, running the check in a fresh
context, stripping the ids, making the file) is your job.

Never edit the user's forms file. When a form looks wrong or is missing, tell the user and
let them change it.

## 1. Find the files

**The forms file.** The user names it, attaches it, or it is the one forms file in the
working folder. If there are several, ask which.

**The five prompts** `plan.txt`, `plan-creative.txt`, `expand.txt`,
`expand-creative.txt` and `check.txt`. Look in this order and use the first place that
has all five:

1. a `prompts/` folder next to this SKILL.md;
2. a `prompts/` folder next to `spec/logical-forms-spec.md` in the user's working folder
   or repository;
3. files the user attached, or project docs with these names;
4. otherwise ask the user to attach them, or for the link to their logical-forms
   repository.

Follow the prompts as written. Do not add rules from memory or from the specification:
the prompts carry everything the model needs.

## 2. Settle the request

The plan prompt needs five lines. Fill them from what the user said:

- `Targets`: section ids or form ids. If the user names a topic or a section title,
  look it up in the forms file. If more than one section fits, ask.
- `Text to write`: the kind of text, in the user's words ("a short scientific paper with
  an abstract", "a methods section", "a summary for my supervisor").
- `Mode`: `strict` unless the user asks for a story, a dialogue or another creative
  rendering. Then ask once whether to use creative mode, and say what it means: invented
  framing and stand-ins are allowed, exact numbers may be left out. Never switch to
  creative mode without that yes.
- `Lead with`: the form ids the user wants up front. Leave empty if they named none; the
  plan will propose some.
- `Length`: if the user gave one, else empty.

Also note the output format the user wants (PDF, Word, Markdown). Default to Markdown.

Ask everything that is missing in one go, with AskUserQuestion if you have it. Do not ask
for what you can read from the forms file.

## 3. Plan, and wait

Read the whole forms file. Follow `plan.txt` (or `plan-creative.txt`) with the five
lines filled in and return the plan. Put any points the user has to settle at the top,
each with what you will do if they say nothing.

Stop here and wait for the user to approve or change the plan. This is one of the two
steps the method depends on. Do not write the text before the plan is approved.

## 4. Expand

Make an output folder next to the forms file, named after the text and today's date, for
example `out/short-paper-2026-11-27/`. Everything below goes there.

Follow `expand.txt` (or `expand-creative.txt`) with the approved plan. Write the draft as
Markdown, with the ids and the `[link]` and `[frame]` marks inline, to `draft.md`. In
creative mode the mapping table comes first in `draft.md`.

Put everything that follows the text, "Possible errors", "Proposed forms" and any notes on
where you departed from the plan, in `notes.md`, not in `draft.md`. The check must see
only the text.

## 5. Check in a fresh context

Before the model check, run a quick script over `draft.md`: every cited id exists in the
forms file, and every number in a carrying sentence occurs in one of the forms it cites.
Fix what it finds.

Then run the check as a subagent (Agent tool), so that it has not seen how the draft was
written. Give it:

- the text of `check.txt` with its header lines filled in: the targets, the mode, today's
  date as the date the text was written, and the mapping table in creative mode;
- the paths of the forms file and `draft.md`, and the instruction to read only these two.

Do not give it the plan, `notes.md` or your reasoning. Save its answer to `check.md`.

If you cannot start a subagent, give the user the filled-in check prompt as a file and ask
them to run it in a new chat with the forms file and `draft.md`, then paste the result back.

## 6. Fix, then check again

Every row whose verdict is not `supported`, `link` or `frame` needs fixing, and so does
every finding after the table.

- Rewrite the sentence so that it says what the forms say. Change the text, never the
  forms. A sentence that no form can support is cut, and the gap goes to `notes.md` under
  "Proposed forms".
- `unsourced` cannot be fixed by rewording: the claim needs a source first. Keep the
  marker and tell the user.
- `stale` means a form changed after the draft was written: rewrite the sentence against
  the form as it is now.

After fixing, run the check again in a new subagent, on the whole revised draft. Stop after
three rounds and report what is still open.

## 7. Have the user read the reworded sentences

When the check is clean, show the user every reworded sentence next to the form wording
the check printed, as a compact list. A model's verdict on a reworded sentence is a first
opinion. The user reading the pairs is the actual check. This is the second step the
method depends on, so wait for their OK. If they object to a pair, fix it and check that
sentence again.

## 8. Make the final text

Copy the draft and remove the bracketed ids, the `[link]` and `[frame]` marks, the
`forms` column of every table and, in creative mode, the mapping table. Change no other
word. Save it as `final.md` and make the format the user asked for from it, with the
matching skill if there is one (pdf, docx).

If the draft still has a `CITATION NEEDED` marker, there is no final text yet. Tell the
user which claims need a source. If they want something to read in the meantime, make a
review copy instead: the same file, with the markers left in and "Draft, contains
unsourced claims" at the top.

## 9. Hand it over

Send the final file (or the review copy). In a few lines, say:

- whether the check passed, and anything still open;
- what is in `notes.md` that needs the user's attention: forms that looked wrong, and
  proposed forms;
- that `draft.md`, `check.md` and `notes.md` are in the output folder if they want to look.

Do not walk the user through the steps you took.
