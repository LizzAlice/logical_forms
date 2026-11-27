"""What the spec says about each form type: fields, allowed values, required fields, definitions."""

PREFIX = {"result": "P-", "claim": "P-", "assumption": "P-", "limitation": "P-", "open": "P-",
          "def": "DEF-", "artifact": "ART-", "setup": "SET-", "section": "SEC-"}
ASSERTABLE = ("result", "claim", "assumption", "limitation", "open")
TYPES = ["result", "claim", "assumption", "limitation", "open", "def", "artifact", "setup"]

WHEN = {
    "result": "You measured or observed something and can point at the run, or the file, that shows it.",
    "claim": "You are saying what results mean: any interpretation, comparison or cause.",
    "assumption": "You will neither source it nor test it, and are asking the reader to grant it.",
    "limitation": "You know a weakness of a result, claim, setup or artifact. If you cannot say what establishes it, it is preliminary.",
    "open": "You have a question you intend to answer later.",
    "def": "A term needs fixing, especially when a tempting near-synonym would overclaim.",
    "artifact": "A script or pipeline (one per main file), a dataset, dump or notebook needs to be findable and re-runnable.",
    "setup": "A stage has a choice you might change and results cite it, or a result needs a record of what ran together.",
}

PAIRS = [
    ["Result or claim?", "Could someone check it by re-running something? Result. Does it need you to interpret? Claim."],
    ["Claim or assumption?", "Can you list what it follows from? Claim. If not: will you look for a source (unsourced claim), measure it (open), or neither (assumption)?"],
    ["Limitation or open?", "A weakness you accept and report is a limitation; a question you mean to answer is an open."],
    ["Def or note?", "If the wrong word would mislead a reader, a def with an avoid list. If it is only your preference, a note."],
    ["Artifact or setup?", "A file or source is an artifact; a configuration of a stage, or of what ran together, is a setup."],
]

ALL_REF = ["result", "claim", "assumption", "limitation", "open", "artifact", "setup"]


def F(key, label, kind, help="", required=False, options=None, info=None, refs=None, labels=False,
      ph="", default=None, show_if=None):
    return {"key": key, "label": label, "kind": kind, "help": help, "required": required,
            "options": options or [], "info": info, "refs": refs or [], "labels": labels, "ph": ph,
            "default": default, "show_if": show_if}


NOTE = F("note", "Note", "ta", "For yourself. Never written out or quoted in a text (M7).")
UPDATED = F("updated", "Last changed or confirmed", "date", "Set to today whenever you change the form or confirm it.")
WORDING = F("wording", "Copy word for word in texts", "check", "", info="wording")
REPLACED = F("replaced_by", "Replaced by", "refs", "Only for a refuted or outdated form: the forms that replaced it.",
             refs=ALL_REF, show_if={"status": ["refuted", "outdated"]})

TEMPLATES = {
    "result": [
        F("statement", "Statement", "ta", "One sentence, past tense, no interpretation.", True),
        F("scope", "What was measured", "ta", "Which items, of what kind, under what conditions (M6). No versions or setup ids.", True),
        F("evidence", "Measured with", "refs", "Artifacts and setups, plus the label of each run that produced the result.",
          True, refs=["artifact", "setup"], labels=True, ph="Add a setup, an artifact or a run label…"),
        F("not_supported", "Must not be turned into", "ta", "The nearby sentence this result does not license."),
        F("status", "Status", "select", "", True, ["established", "refuted"], info="resultStatus", default="established"),
        REPLACED, UPDATED, NOTE, WORDING],
    "claim": [
        F("statement", "Statement", "ta", "One sentence.", True),
        F("derived_from", "Rests on", "refs", "The forms this claim follows from. May stay empty only while it is unsourced or refuted.",
          refs=ALL_REF, ph="Add a form by id or by words in it…"),
        F("not_supported", "Must not be turned into", "ta", "The nearby sentence this claim does not license."),
        F("status", "Status", "select", "", True, ["established", "preliminary", "unsourced", "refuted", "outdated"],
          info="claimStatus", default="preliminary"),
        REPLACED, UPDATED, NOTE, WORDING],
    "assumption": [
        F("statement", "Statement", "ta", "One sentence.", True),
        F("basis", "Why it is reasonable", "ta", "Why it is reasonable, and why it is not tested or sourced here.", True),
        F("breaks_if", "What would make it false", "ta", "", True),
        F("surface", "Written out in texts", "select", "Leave at yes unless the premise is too basic to be worth a sentence.",
          options=["yes", "no"], info="surface", default="yes"),
        F("status", "Status", "select", "", True, ["assumed", "refuted"], info="assumptionStatus", default="assumed"),
        REPLACED, UPDATED, NOTE, WORDING],
    "limitation": [
        F("statement", "Statement", "ta", "One sentence.", True),
        F("affects", "Weakens", "refs", "The narrowest thing the weakness belongs to. Everything resting on it is covered too.",
          refs=["result", "claim", "setup", "artifact"], ph="Add a result, claim, setup or artifact…"),
        F("evidence", "Established by", "refs", "Forms, or “stated” when it rests on your own knowledge of the process.",
          refs=ALL_REF, labels=True, ph="Add a form, or type stated…"),
        F("severity", "Severity", "select", "", options=["minor", "major"], info="severity", default="minor"),
        F("status", "Status", "select", "", True, ["established", "preliminary", "resolved", "refuted"],
          info="limitationStatus", default="established"),
        F("resolved_by", "Removed by", "refs", "The setup or artifact that removed the weakness.",
          refs=["setup", "artifact"], show_if={"status": ["resolved"]}),
        REPLACED, UPDATED, NOTE, WORDING],
    "open": [
        F("statement", "Question", "ta", "The question, not a guess at the answer.", True),
        F("status", "Status", "select", "", True, ["open", "closed"], info="openStatus", default="open"),
        F("answered_by", "Answered by", "refs", "The forms that answer it. If you dropped the question, say why in the note.",
          refs=ALL_REF, show_if={"status": ["closed"]}),
        UPDATED, NOTE, WORDING],
    "def": [
        F("term", "Term", "text", "One word or phrase.", True),
        F("definition", "Definition", "ta", "", True),
        F("use", "Words to use", "list", "Strings that may be used for it."),
        F("avoid", "Words to avoid", "list", "Strings that may not be used for it."),
        F("why_avoid", "Why avoid them", "ta", "Required when there are words to avoid."),
        F("status", "Status", "select", "", True, ["established", "retired"], info="defStatus", default="established"),
        UPDATED, NOTE],
    "artifact": [
        F("path", "Path", "text", "<repository name>/<path in it>, or a URL.", True),
        F("version", "Version", "text", "Tag or commit for repository files if there is one; snapshot, release or access date for everything else (M5)."),
        F("entrypoint", "How to run it", "text", "The command, verbatim except for path patterns."),
        F("produces", "Output files", "list", "Outputs that a result points at, written like path."),
        F("status", "Status", "select", "", True, ["current", "superseded", "planned"], info="artifactStatus", default="current"),
        UPDATED, NOTE],
    "setup": [
        F("components", "Components", "kv", "Stage setup: one row per key from the file's component keys."),
        F("includes", "Includes", "refs", "Pipeline setup: everything that ran together.", refs=["artifact", "setup"]),
        F("part_of", "Stage of", "refs", "The artifact this is a stage of. Edited in place when the pipeline changes.", refs=["artifact"]),
        F("script", "Code", "text", "The file or files that implement it."),
        F("follows", "Runs after", "refs", "Setups of the stages that run before it.", refs=["setup"]),
        F("uses", "Calls", "refs", "Setups of the stages this stage calls.", refs=["setup"]),
        F("status", "Status", "select", "", True, ["current", "superseded", "planned"], info="artifactStatus", default="current"),
        UPDATED, NOTE],
    "section": [
        F("title", "Title", "text", "A working label, not a heading.", True),
        F("about", "What belongs in here", "text", "One sentence.", True),
        F("links", "Links to other sections", "links", ""),
        F("status", "Status", "select", "", True, ["drafting", "drafted", "retired"], info="sectionStatus", default="drafting"),
        UPDATED, NOTE],
}

LINK_RELS = ["builds_on", "groups_with", "elaborates", "contrasts_with", "supersedes"]

REF_FIELDS = ["evidence", "derived_from", "affects", "resolved_by", "replaced_by", "answered_by",
              "includes", "part_of", "follows", "uses"]

STANDARD_KEYS = {
    "source": "where the data is fetched from (service, endpoint or file), and how its results are paged",
    "query": "what is asked for, in the terms the service understands",
    "filter": "what is excluded before the stage's main step, including duplicates",
    "data": "the input the stage runs over (documents, records or rows), with its selection and ordering",
    "model": "the model or engine that runs, with its decoding parameters",
    "prompt": "the prompt text, or the artifact holding it",
    "batch": "how many items per call, how calls are paced, and what happens on failure",
    "method": "the decision rule or algorithm the stage applies, including how items are matched",
    "vocabulary": "the fixed list of terms or items the stage matches against or offers to choose from",
    "stopping": "what makes an iterative stage terminate",
    "feedback": "what the model that revises the prompt is told about how the last prompt performed",
    "review": "the human checkpoint, and what it can change",
    "scoring": "how one output is compared against the gold standard",
    "metric": "the summary numbers computed from the scored outputs",
    "writes": "what the stage creates or modifies, in the database and elsewhere",
    "provenance": "how written statements are sourced",
}

# What each value means, taken from the spec. Shown behind the (i) buttons.
DEFS = {
    "claimStatus": {"title": "Claim statuses (§4.2)",
        "foot": "Cap (invariant 12): a claim is never stronger than its weakest support. A refuted, outdated, resolved, closed or superseded premise means the claim is revisited instead of downgraded.",
        "items": [
            ["established", "Every P- form it rests on is established and every ART- or SET- form is current, and the step is one a competent reader grants without further work: arithmetic, a definitional consequence, or a finding the cited source states directly."],
            ["preliminary", "Anything else that has support: some premise is preliminary, assumed, unsourced, open or planned, or the step is a judgement (a single run, no controls, other explanations not ruled out)."],
            ["unsourced", "No support yet. Believed on general grounds and expected to be citable. Rests on can stay empty; the note says where you have looked."],
            ["refuted", "Shown to be wrong. Kept for the record (M2); replaced_by names what replaced it."],
            ["outdated", "Was correct for the setup or artifact version it was derived from and does not hold for the version that replaced it. Kept for the record; Rests on stays as it is."]]},
    "resultStatus": {"title": "Result statuses (§4.1)",
        "foot": "A result is never edited (M4). A new run or a changed configuration gets a new result.",
        "items": [
            ["established", "The spec lists this value in the template but gives no definition of its own."],
            ["refuted", "Shown wrong. replaced_by names what replaced it; the form stays (M2)."]]},
    "assumptionStatus": {"title": "Assumption statuses (§4.3)", "foot": "",
        "items": [
            ["assumed", "Granted, not supported here: you will neither find a source nor test it, and ask the reader to grant it."],
            ["refuted", "Shown wrong. replaced_by names what replaced it; the form stays (M2)."]]},
    "limitationStatus": {"title": "Limitation statuses (§4.4)",
        "foot": "An established or preliminary limitation must name at least one form in affects (invariant 18).",
        "items": [
            ["established", "Evidence names the artifact, setup or run that shows it, or “stated” when it rests on your own knowledge of the process."],
            ["preliminary", "You can support it neither way yet. Evidence may stay empty, and expand hedges it like any preliminary form."],
            ["resolved", "It was real, and a later setup or artifact removed it; resolved_by names that. It still covers what it covered, hedged in the past tense."],
            ["refuted", "It was never real. Covers nothing."]]},
    "openStatus": {"title": "Statuses of an open question (§4.5)",
        "foot": "If one result you measured is the whole answer, turn the open into that result instead. It keeps its id, so everything pointing at the question now points at the answer (§4.10).",
        "items": [
            ["open", "Unanswered. Appears in a text only as an open question or as future work, never as a finding."],
            ["closed", "Answered by other forms, named in answered_by, or dropped, with the reason in the note. Not written at all once closed."]]},
    "defStatus": {"title": "Def statuses (§4.6)", "foot": "",
        "items": [
            ["established", "The spec lists this value in the template but gives no definition of its own."],
            ["retired", "Not used; a retired def no longer governs wording (§6 rule 2)."]]},
    "artifactStatus": {"title": "Artifact and setup statuses (§4.7, §4.8)", "foot": "",
        "items": [
            ["current", "Exists and is what the work uses now."],
            ["superseded", "Replaced by a newer version. Older results still cite it; a text may name it only as what an earlier result was produced with."],
            ["planned", "Does not exist or has not run yet, so no result rests on it. An artifact has version: planned; a setup's components may still change in place."]]},
    "sectionStatus": {"title": "Section statuses (§4.9)", "foot": "",
        "items": [
            ["drafting", "You are still working on the section."],
            ["drafted", "You do not expect anything in it to change any more."],
            ["retired", "Another section supersedes this one (§5)."]]},
    "severity": {"title": "Severity (§4.4)", "foot": "Use major for a weakness that changes how the affected results should be read as a whole.",
        "items": [
            ["minor", "The default; leave the field out. Stated once in each passage that reports a covered result or claim; may be left out of an abstract or summary when the body states it."],
            ["major", "Stated in a sentence of its own in each such passage, and never left out of an abstract or summary."]]},
    "surface": {"title": "surface (§4.3)", "foot": "",
        "items": [
            ["yes", "The default; leave the field out. Expand states the assumption, marked as an assumption, in every text that reports a claim resting on it."],
            ["no", "For a premise that is real but too basic to be worth a sentence. The form stays and can be rested on; it is just not written out."]]},
    "wording": {"title": "wording (§3)", "foot": "Only on results, claims, assumptions, limitations and opens.",
        "items": [["fixed", "Expand copies the statement word for word (§6 rule 9). Leave the field out otherwise."]]},
    "linkRel": {"title": "Section links (§5)", "foot": "",
        "items": [
            ["builds_on", "This section presupposes that one; read or write it first. Must form no cycle."],
            ["groups_with", "Same topic, split for size or readability."],
            ["elaborates", "Goes deeper into something the other states broadly."],
            ["contrasts_with", "The two treat alternatives, and should be kept consistent."],
            ["supersedes", "This replaces a retired section. Points one way only, from the new section to the retired one."]]},
}

# Retyping (§4.10): allowed moves and what changes.
RETYPE = [
    {"from": "claim", "from_status": "unsourced", "to": "assumption", "label": "Searched, nothing usable, and the conclusion holds without it: turn into an assumption",
     "drop": ["derived_from", "not_supported", "replaced_by"], "status": "assumed", "need": ["basis", "breaks_if"]},
    {"from": "claim", "from_status": "unsourced", "to": "open", "label": "You will measure it yourself after all: turn into an open question",
     "drop": ["derived_from", "not_supported", "replaced_by"], "status": "open", "need": ["statement"]},
    {"from": "assumption", "to": "open", "label": "You will test it after all: turn into an open question",
     "drop": ["basis", "breaks_if", "surface", "replaced_by"], "status": "open", "need": ["statement"]},
    {"from": "assumption", "to": "claim", "label": "A source turned up after all: turn into a claim",
     "drop": ["basis", "breaks_if", "surface"], "status": "preliminary", "need": ["derived_from"]},
    {"from": "open", "to": "result", "label": "You measured it and one result is the answer: turn into that result",
     "drop": ["answered_by"], "status": "established", "need": ["statement", "scope", "evidence"]},
    {"from": "open", "to": "limitation", "label": "You decide not to chase it: turn into a limitation",
     "drop": ["answered_by"], "status": "established", "need": ["statement", "affects", "evidence"]},
]


def template(t):
    return TEMPLATES.get(t, [])


def field(t, key):
    for f in template(t):
        if f["key"] == key:
            return f
    return None


def order_keys(t, d):
    """Keys in template order after id and type, unknown keys where they were."""
    keys = ["id", "type"] + [f["key"] for f in template(t)]
    out = {}
    for k in keys:
        if k in d:
            out[k] = d[k]
    for k in d:
        if k not in out:
            out[k] = d[k]
    return out
