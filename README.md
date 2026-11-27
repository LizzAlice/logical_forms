# Logical forms

A format for breaking a piece of research down into atomic parts to give you a better overview of what you did and
where there might be something missing. This format can then be expanded into a text by an LLM and a text you or an
LLM wrote can be checked against the logical forms to make sure nothing is claimed that is not actually backed by
your research. There is also a fun little creative writing prompt based on your research for when you need something
light and an editor to make editing and visualizing the yaml file easier.


What is where:

```
spec/logical-forms-spec.md   the specification (v1)
prompts/                     the prompts for plan, expand and check, one file each
editor/                      a local browser app for viewing and editing a forms file
examples/minimal-forms.yaml  the worked example from §9 of the spec
examples/cat-on-laptop.yaml  a made-up study to try the prompts on
skills/write-from-forms/     a Claude skill that runs the whole flow for you
```


## The prompts

Each file in `prompts/` is a complete prompt. Copy it, fill in the lines with angle
brackets, and give it to the model together with your whole forms file.
The model does not need the spec: the prompts carry the rules it has to follow.

| file | what it does |
| --- | --- |
| `plan.txt` | returns an outline of the text: headings, which forms go where, tables, where each limitation is stated |
| `expand.txt` | writes the draft from the plan you approved, with form ids after each sentence |
| `check.txt` | gives every sentence of a draft a verdict against the forms |
| `plan-creative.txt`, `expand-creative.txt` | the same two steps for a creative rendering such as a story (§6.1) |

A text is made in four steps:

1. Run `plan.txt` and read the plan. Change it until you are happy with it.
2. Run `expand.txt` with the forms file and the approved plan. You get a draft with ids
   such as `[P-candidate-yield]` and marks such as `[link]` inline.
3. Run `check.txt` in a new conversation, with the forms file and the draft but without
   the conversation that wrote the draft. Fix every sentence whose verdict is not
   `supported`, `link` or `frame`, and read the reworded sentences next to the form
   wording the check prints.
4. Make the final text by removing the bracketed ids and the `[link]` and `[frame]`
   marks. A draft that still has a `CITATION NEEDED` marker is not ready.

The prompts repeat rules from §6 and §7 of the spec. If you change those sections,
change the prompt files to match.

### Try it on the example

`examples/cat-on-laptop.yaml` is a made-up study of why a cat named Professor Biscuit
lies on a laptop keyboard. It is small, but it uses all nine types of form. It has two counts, a
comparison, an interpretation that rests on an unsourced claim and an assumption, a major
limitation that undercuts that interpretation, an open question and a planned follow-up.
A mock paper from it should come out hedged, with a `CITATION NEEDED` marker, and should
never call the cat's keystrokes "typing". To try it, fill in `plan.txt` like this:

```
Targets: SEC-cat-laptop
Text to write: a short scientific paper with an abstract
Mode: strict
Lead with: P-prefers-on, P-warmth-explains
Length: 80 words for the abstract
```

## Writing with Claude

There is a skill for Claude in `skills/write-from-forms/` to generate and check documents. 
You tell Claude what to write ("a short
paper from examples/cat-on-laptop.yaml, leading with P-prefers-on"), approve the plan,
read the reworded sentences at the end, and get the final file. The draft, the check
result and the notes (possible errors, proposed forms) stay in an output folder next to
your forms file.

If you use Claude Code inside this repository, the skill finds the prompts in `prompts/`
by itself. To use it anywhere else, put a copy of the prompts into the skill folder
first:

```
cp -r prompts skills/write-from-forms/
```

Then copy `skills/write-from-forms` to `~/.claude/skills/` for Claude Code, or zip the
folder and upload it as a skill in Claude's settings:

```
cd skills && zip -r write-from-forms.zip write-from-forms
```

The skill uses the prompt files as they are, so a change to a prompt reaches it the next
time you copy the prompts.

## The forms editor

The editor runs on your own computer and opens in your browser. It shows what each form
rests on and what rests on it, draws a section as a graph, runs the file checks of §8,
and lets you add and edit forms. It never overwrites the file you opened: each save
writes a new, dated file next to it.

You need Python 3.8 or newer and PyYAML:

```
pip install -r requirements.txt
```

Then, from the top folder of this repository:

```
python editor/forms_editor.py examples/minimal-forms.yaml
```

This opens `http://127.0.0.1:8765/`. Give it the path to your own forms file instead of
the example, or leave the path out to get a start screen where you can open a file or
make a new one. Stop the editor with Ctrl+C.

`editor/README.md` has the options, how saving works and what each screen does.
