# Forms editor

A local app for looking through, changing and extending a logical-forms YAML file (spec v1) in your browser. It runs only on your computer.

## Start it

You need Python 3.8 or newer and PyYAML (`pip install pyyaml`, or `pip install -r requirements.txt` from the top folder of the repository). Nothing else.

From the top folder of the repository:

```
python editor/forms_editor.py path/to/forms.yaml
```

To try it on the worked example from the spec:

```
python editor/forms_editor.py examples/minimal-forms.yaml
```

This opens the editor in your browser at `http://127.0.0.1:8765/`. Without a file, it starts on a screen where you can open a file or make a new one. Stop it with Ctrl+C in the terminal.

Options:

- `--port 9000` uses another port. If the port is taken, the next free one is used.
- `--no-browser` starts the server without opening a browser window.
- `--check-roundtrip` only checks that the file would be written back unchanged, then exits. This tells you whether the editor reads your file cleanly.

## Saving

- Saving never writes to the file you opened. Every save writes a new file next to it, named with date and time, for example `forms_2026-11-13_1146.yaml`. You can change the name in the save window. An existing file is never replaced.
- Before saving, the save window lists every change and can show them as a YAML diff.
- After writing, the editor reads the new file back and compares it with what is open. Only if they match does it switch to the new file. Otherwise the new file is removed and your changes stay open.
- Forms you did not touch stay line for line as they were, comments and blank lines included. A form you changed is written out again: lists as brackets over several lines, and text in the same style it had (one quoted line, a quoted string over several lines, or a `>` block).
- Changes live in the editor until you save. If you stop the editor with unsaved changes, they are lost. The browser warns you when you close the tab with unsaved changes.
- Undo (top bar) steps back through your changes since the last save, up to 60 of them.

## What is where

- **Sections**: everything filed in a section, grouped by type, with filters. Pick a form to see what it rests on, what rests on it, which limitations reach it and, for a claim, its ceiling.
- **What rests on what**: the whole chain under a form, step by step. Click a limitation to mark the forms it passes through.
- **Graph**: a whole section as boxes and arrows. Results are grouped by the pipeline setup they cite when showing each result as its own box would take more than 50 boxes (you can change this number in Settings). The switch above the graph flips between the two views.
- **Checks**: the file rules of §8, each problem with where it is and the fixes that fit it; the claims to revisit, citation gaps and limitation coverage of §8.1; and the open questions, which you can close here, including adding a new result or claim that answers them.
- **+ Open question** (top bar, on every screen): adds an open question in a small window, so you stay where you are.
- **Add form**, **Edit**: fields follow the type's template in the spec. Reference fields only offer forms that are allowed there. The (i) buttons show what each value of a status or similar field means, from the spec. Forms made in a small window can only be added once their required fields are filled.
- **New version…** (on current setups and artifacts): writes the new version, copies every pipeline setup that names it, sets the old ones to superseded and re-points `follows`, `uses` and `part_of`.
- **Change type…**: the moves of §4.10, keeping the id.
- **Component keys**: the registry of `component_keys`.
- **Settings** (gear icon): protection of frozen fields (M4) and the graph's grouping threshold. The frozen-field protection asks whether an edit to a frozen field is a new version or a recording error. Switch it off while you bring the file up to date after a change to the spec.

## Limits

- Forms are never deleted (M1, M2). Only a form you added since the last save can be discarded.
- Ids cannot be renamed (M1).
- Comments inside a form you change are dropped when that form is written out again. Comments between forms, such as the `# ── results ──` banners, stay.
- Rule 7 is checked when the file is read; rule 10 is about generated text and is not checked here.
- One person at a time: the editor holds the file in memory and does not notice changes made to it on disk while it runs. Open the file again from the start screen after editing it elsewhere.
