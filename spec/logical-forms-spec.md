# Logical forms specification, v1

A format for writing down what you know, so that an LLM can expand it into prose and
check prose back against it.

The format is built around two operations:

- Expand turns forms into text. Every sentence of that text that says something about
  the work can be traced to at least one form. The text may reword and reorder what the
  forms say, within fixed limits (§6 rule 9). Sentences that only connect, and the
  framing sentences of a creative rendering such as a story, are marked as such (§6,
  §6.1).
- Check turns text into verdicts. Each sentence gets its own verdict against the
  forms. Check runs as a separate pass that has not seen how the text was written.

Everything in the format serves one of three purposes. Most of it makes these two
operations mechanical. Some of it keeps the forms correct as the work changes: the
maintenance rules below, and fields such as `script`, `follows` and `links`. And `note`
keeps information you do not want to forget but that has no other place (M7). A field
that serves none of these purposes does not belong in the format.

The format describes what you know, not the layout of a document. Sections (§5) group
forms by topic for your own use; they are not the headings of a finished paper.

There are nine types of form (§4.0). Five are assertable: `result`, `claim`,
`assumption`, `limitation` and `open`. Their statements become sentences. Three are
reference forms: `def`, `artifact` and `setup`. Sentences are checked against them and
may state their values, such as a definition, a path or a component value. The ninth,
`section`, only files the others.

---

## Maintenance (read first)

Forms are only useful while they are correct. The seven rules below keep forms
trustworthy. The rest of this specification is detail.

> **M1: Ids are permanent.** Never reuse an id and never renumber. Other forms, old
> drafts and your own notes refer to a form by its id, and those references must keep
> pointing at the same form.
>
> **M2: Wrong forms stay.** A result, claim, assumption or limitation shown to be wrong
> gets `status: refuted`; name what replaced it in `replaced_by`, and say in its `note`
> why it was wrong if nothing did. Do not delete it, because the refuted form is the
> record that the point was checked and found wrong. A limitation that was true and has
> since been fixed is not wrong: it gets `status: resolved` (§4.4). A setup or artifact
> that was recorded wrongly is corrected in place (M4).
>
> **M3: A claim is revisited when something under it moves.** A claim rests on the
> forms in its `derived_from`, and through them on the results, setups and artifacts
> underneath (§4.4). When any of these is edited, superseded or changes status, treat
> the claim as suspect until you have revisited it. Most often a setup or artifact has
> been replaced: the results under the claim still stand, but they describe the old
> configuration, and newer results may exist. Check whether the claim
> also holds for what replaced the old form. If it does, point its `derived_from` at the
> new forms. If it does not, set it to `outdated` (§4.2). After revisiting, set the
> claim's `updated` to that day, whether you changed it, re-pointed it, marked it
> `outdated` or found it still correct (§3). Without this step, forms can become wrong without anyone noticing.
> §8.1 has a query that lists the claims due for revisiting.
>
> **M4: Results, configurations and the artifacts they rest on are never edited in
> place.** A result records one measurement, and a setup records what results were
> produced with. A new run gets a *new* `result` form, a changed configuration a new
> `setup` form, and a corrected script or dataset a new `artifact` form, each with a new
> id. The old form stays: a result becomes `refuted` only if it was wrong (M2), and a
> replaced setup or artifact becomes `superseded`. Editing in place would make an older
> result quietly report a different number, or look as if it came from the new
> configuration.
>
> The frozen fields are a result's `statement`, `scope` and `evidence`, a setup's
> `components` and `includes` once it is no longer `planned` (§4.8), and an artifact
> once a result or claim rests on it and it is no longer `planned` (§4.7). On all of
> them, `status`, `note` and `updated` may still change. Two additions are allowed as
> well, because they leave everything that rested on the form valid: an artifact's
> `produces` may gain paths (§4.7), and a result's `evidence` may gain a setup that
> records the run it already cites in more detail (§4.1). A setup's `part_of`,
> `script`, `follows` and `uses` map the pipeline as it is now, so you edit them in
> place (§4.8).
>
> A recording error is the one case where you edit a frozen field of a setup or
> artifact. If the form never matched what ran or what the file is (a mistyped
> threshold, the wrong commit), correct it in place and say in its `note` what you
> corrected and when. The form then says what it should have said from the start. If
> the thing itself changed, that is not a recording error, and you write a new form.
> The new `updated` date lists the claims that rest on the form for revisiting (M3).
>
> **M5: Record the version of what results and claims rest on.** A result or claim rests
> on an artifact when it cites the artifact, or reaches it through setups (§4.4). The
> artifact's `version` is the one those results were produced with, or the one those
> claims cite. For files in a repository, including data directories inside it, that
> is a tag or commit of that repository. It is optional: fill it in when you have one, and leave it empty
> when the state was never committed. The result still stands without it, but nobody can
> check later which state of the file produced it. Everything else (live databases, data
> directories outside any repository, external sources) always carries a version of its
> own kind, such as a snapshot date, a release or an access date, cited or not, because
> such a source changes without you.
>
> **M6: Every result states its scope.** Without a `scope`, neither you nor the model
> can tell which conditions a result was measured under, and the result ends up applied
> to cases that were never measured.
>
> **M7: Anything that has no field of its own and must not be written out goes in
> `note`.** `note` is never expanded into prose and never quoted. Use it freely for
> everything you want to keep but do not want in a text; that keeps such material out of
> the fields that expand may state.

---

## 1. The unit

A form is one proposition or one object that can be independently true, false, present
or absent.

A form is atomic if you cannot answer "is this correct?" with "partly".
Three things force a split:

- Conjunction: "A and B" is two forms.
- Comparison: "X is faster than Y" is three: the value for X, the value for Y, and
  the comparison as a `claim`.
- Cause or reason: "X happened because Y" is two: the observation, and the
  interpretation as a `claim`.

**Atomicity applies to every type, not only the assertable ones.** For each type, ask the
same question: could one half of this be true or present while the other is not?

| type | one form is | split when |
| --- | --- | --- |
| `result` / `claim` | one proposition | it contains "and", a comparison, or a cause |
| `artifact` | one thing at one path | you are describing two file kinds, or one lives only in the note |
| `setup` | one configuration: of one stage of a pipeline (one decision, one output), or of what ran together in a pipeline | its files implement two decisions, two steps write different files, or it fills both `components` and `includes` |
| `def` | one term with one meaning | the term means two things in different places |

Two signs apply to every type. A comma or "and" in a field that is meant to hold one value
means two forms. And if a form's `note` talks about a second subject that none of its
fields mention, that subject needs a form of its own.

Bundling has two costs. A checker can only return "partly supported" for a bundled form,
which tells you nothing. And every form that cites the bundle cites both halves, even if
it rests on only one, so `derived_from` and `evidence` no longer show what it depends on.
Splitting costs little: ids are permanent, and `follows` or `derived_from` records the
relation that the bundle only implied.

Atomicity tells you where to cut a form, not whether to write it. §4.0 says when each
type is worth writing. Setups tempt you to write one per stage of the code, so §4.8 adds
a stricter test for them.

---

## 2. One file

Everything lives in one file, so that it is searchable with one grep. Different
topics are different sections *inside* it. The sections are the top level of the file,
and every other form sits nested under the section it belongs to.

```yaml
spec: v1
component_keys:
  data: "the input the stage runs over (documents, records or rows), with its selection and ordering"
  method: "the decision rule or algorithm the stage applies, including how items are matched"
  metric: "the summary numbers computed from the scored outputs"

sections:
  - id: SEC-…                 # the section form's own fields
    title: …
    forms:                    # everything filed under it, indented
      - id: P-…
      - id: P-…

  - id: SEC-…
    title: …
    forms:
      - id: …
```

At the top of the file, `spec` names the version of this specification the file follows.
§4.8 describes `component_keys`.

A form belongs to a section because it is nested under that section's `forms:` key.
Forms have no `section:` field, and every form except a section must sit inside one.
Sections are not nested in each other. To move a form to another section, cut it, paste
it and re-indent it.

Expand and check are always given the whole file, never a part of it. The request names
the sections or forms a text is to cover (§6).

Ids are stable, mnemonic, prefixed by type:

| prefix | types |
| --- | --- |
| `P-` | result, claim, assumption, limitation, open (the five assertable types) |
| `DEF-` | def |
| `ART-` | artifact |
| `SET-` | setup |
| `SEC-` | section |

The five assertable types share one prefix on purpose. A form can change between these
types: an unsourced claim that finds no citation can become an assumption (§4.10 says
when), an assumption you decide to check becomes an open, an open you answer becomes a
result. With one prefix per
type, each such change would need a new id, which would break M1 and every `derived_from`
that points at the form.

So retyping never changes an id, and no other form has to be edited (§4.10). The other
four types keep their own prefixes because a form never changes into or out of them.

A comment above each section can make the boundary easier to see when you scroll through
a long file:

```yaml
  # ══════════════════════════════════════════════════════════════
  # SEC-pdf-defs — Extracting definitions from PDFs
  # ══════════════════════════════════════════════════════════════
  - id: SEC-pdf-defs
```

The templates in §4 are written flush left for readability. In the file, section fields
sit at one level of indentation and their forms at two.

---

## 3. Fields on every form

| field | required | meaning |
| --- | --- | --- |
| `id` | yes | unique, prefix matches `type` |
| `type` | yes | one of the nine types in §4 |
| `status` | yes | vocabulary differs per type; the type's template lists it |
| `updated` | yes | ISO date on which the form was last changed, or last confirmed as still correct |
| `note` | no | free text for yourself; never expanded, never quoted (M7) |
| `wording` | no | only on the five assertable types, and only the value `fixed`: expand copies the `statement` word for word (§6 rule 9). Leave the field out otherwise |

`updated` changes when you edit a form, and also when you check it and find it still
correct. When something under a claim moves, for instance when a setup it rests on is
superseded, the claim is listed for revisiting (M3, §8.1). Once you have revisited it,
setting its `updated` to today takes it off that list, even if you changed nothing. The
new date also marks every text that cites the claim as stale (§7), and its section as
stale (invariant 9). That is intended: something under them moved, so they should be
looked at again too.

Both comparisons use dates without a time of day. A change made on the same date as a
claim's `updated`, or as the date a text was written, is therefore not caught (§8.1).

---

## 4. Form types

Each template below is complete and can be copied as it is. Where a field only allows
certain values, the comment on that line lists them.

### 4.0 Which form to write

| form | prefix | write one when | detail |
| --- | --- | --- | --- |
| result | `P-` | you measured or observed something and can point at the run, or the file, that shows it | [§4.1](#41-result-one-measured-number-or-observation) |
| claim | `P-` | you are saying what results *mean*: any interpretation, comparison or cause | [§4.2](#42-claim-an-interpretation) |
| assumption | `P-` | you will neither source it nor test it, and are asking the reader to grant it | [§4.3](#43-assumption-granted-not-supported-here) |
| limitation | `P-` | you know a weakness of a result, claim, setup or artifact; if you cannot say what establishes it, it is `preliminary` | [§4.4](#44-limitation-known-weakness) |
| open | `P-` | you have a question you intend to answer later | [§4.5](#45-open-unresolved) |
| def | `DEF-` | a term needs fixing, especially when a tempting near-synonym would overclaim | [§4.6](#46-def-a-term-and-its-permitted-wording) |
| artifact | `ART-` | a script or pipeline (one per main file), a dataset, dump or notebook needs to be findable and re-runnable | [§4.7](#47-artifact-script-dataset-dump-notebook) |
| setup | `SET-` | a stage of a pipeline contains a choice you might change, and results cite it or will (not for intermediate mechanical steps); or a result needs a record of what ran together (a pipeline setup) | [§4.8](#48-setup-a-configuration) |
| section | `SEC-` | you want one place for everything about a topic | [§4.9](#49-section-a-filing-drawer) |

Forms move between the first five types as your plans change; see
[§4.10](#410-lifecycle-how-forms-move-between-types).

Five pairs are easy to confuse:

- `result` or `claim`: could someone verify it by re-running something? Result. Does it
  require you to interpret? Claim. "33 of 40 executed" is a result; "the model struggles
  with nesting" is a claim, even when it feels obvious from the number.
- `claim` or `assumption`: if you can list what it follows from, it's a claim. If you
  can't, ask what you plan to do about it: find a citation → `claim` with status
  `unsourced`; measure it yourself → `open`; neither → `assumption`.
- `limitation` or `open`: a limitation is a weakness you accept and will report; an open
  is a question you intend to resolve. The same issue moves from `open` to `limitation`
  when you decide not to chase it.
- `def` or `note`: if the wrong wording would mislead a reader, it's a `def` with an
  `avoid` list. If it's only a preference of yours, put it in the `note` of the form it concerns.
- `artifact` or `setup`: an artifact is a file or source; a setup is a configuration, of
  one stage or of what ran together in a pipeline. The table before §4.7 goes through the
  cases.

### 4.1 `result`: one measured number or observation

```yaml
- id: P-
  type: result
  statement: >                    # one sentence, past tense, no interpretation
  scope: >                        # REQUIRED — in words, what the measurement covered:
                                  # which items, of what kind, under what conditions (M6)
  evidence: []                    # ART-/SET- ids, plus the label of each run that
                                  # produced the result. No run label if the result
                                  # was read off a file no script in your forms wrote
  not_supported: >                # the adjacent sentence this does NOT license
  status:                         # established | refuted
  replaced_by: []                 # if refuted: ids of the forms that replaced it
  updated:                        # YYYY-MM-DD
  note: >
```

`not_supported` names the nearby sentence that the result does not justify, typically the
one you are tempted to write. Without it, "33 of 40 executed" turns into "33 of 40 were
correct".

A result is never edited (M4): its `statement`, `scope` and `evidence` stay as written.
One addition is allowed. If you later write a setup for exactly the code and data
versions a result already cites, for example a stage setup for a script the result cited
on its own, you may add that setup to the result's `evidence`. It records the same run in
more detail and changes nothing about what produced the result. Nothing in `evidence` is
ever removed or replaced. A new run, a corrected script or a changed configuration gets a
new result form with a new id, which cites the new run label and the new forms.

A run label in `evidence`, such as `run-2026-09-12`, names the run the numbers come
from. A result that draws on several runs, such as a count across seven models that were
each run once, lists the label of every one of them. The setups and artifacts say how that run was configured, but that is not enough
on its own: the same configuration can run more than once, and a model rarely gives the
same output twice. When output paths are patterns (§4.7), the label is also how you find
the run's output. A label must not start with one of the five id prefixes, because
scripts use the prefixes to tell labels from ids (§8).

Some results describe what a file contains, such as the number of records in a dataset.
If no script in your forms wrote the file (a dataset you downloaded, a gold set you
labelled), the result needs no run label: its `evidence` is the file's artifact, and the
artifact's `version` says which state of the file was counted. If a script in your forms
wrote the file, the count is a result of that script, like `P-candidate-yield` in §9. It
then cites the script, its input, its stage setup if it has one, and the run label, as
§4.8 describes, and not the file itself. That way a limitation on the script, such as
records it drops, also covers the count.

`scope` says in words what was measured: which items (the 80 PDFs, the 120 gold-set
sentences), of what kind (born-digital only) and under which conditions (layout
labelled by hand). Expand states it where it hedges a preliminary claim that rests on
the result (§6 rule 2),
and check uses it to decide whether a sentence claims more than was measured. Versions
and setup ids do not go in `scope`. The forms in `evidence` already record them, and
expand would otherwise write them into the prose.

### 4.2 `claim`: an interpretation

```yaml
- id: P-
  type: claim
  statement: >                    # one sentence
  derived_from: []                # P- / ART- / SET- ids — non-empty unless the status
                                  # is unsourced or refuted
  not_supported: >                # the adjacent sentence this does NOT license
  status:                         # established | preliminary | unsourced | refuted
                                  # | outdated
  replaced_by: []                 # if refuted or outdated: ids of the forms that
                                  # replaced it
  updated:                        # YYYY-MM-DD
  note: >
```

The split between `result` and `claim` matters more than any other in the format: a result
can be checked against files, a claim only against results.

**Choosing the status.** There are two tests, and a claim must pass both to reach a
status.

- Support: how strong is the weakest form in `derived_from`?
- Step: how much judgement is in the move from that support to this statement?

| status | when |
| --- | --- |
| `established` | every `P-` form in `derived_from` is `established` and every `ART-` or `SET-` form is `current`, and the step is one a competent reader grants without further work: arithmetic, a definitional consequence, or a finding the cited source states directly |
| `preliminary` | anything else that has support: some premise is `preliminary`, `assumed`, `unsourced`, `open` or `planned`, or the step is a judgement: a single run, no controls, or alternative explanations not ruled out |
| `unsourced` | no support yet; believed on general grounds, expected to be citable |
| `refuted` | shown to be wrong; kept for the record (M2) |
| `outdated` | was correct for the setup or artifact version it was derived from, and does not hold for the version that replaced it; kept for the record |

The cap is mechanical (invariant 12): a claim may not be stronger than its weakest
support, however obvious the inference. A premise that is `refuted`, `outdated`,
`resolved`, `closed` or `superseded` means the claim has to be revisited instead of
downgraded. It is worth checking the cap with a script, because each single upgrade looks
harmless when you make it by hand.

If the cap seems wrong because a very general background assumption holds an otherwise
solid claim at `preliminary`, the assumption is probably one that nobody in your field
would dispute. If so, it needs no form (§4.3), and you take it out of the claim's
`derived_from`. Keep the form itself, because ids are permanent (M1), and set
`surface: no` on it so that it is not written out. Do not add an exception to the cap.

**`outdated` is for a claim that was right and no longer applies.** The claim was
correct for the configuration it was derived from. That configuration has been replaced,
and you checked that the claim does not hold for the new one (M3). Its `derived_from`
stays as it is, because the old results, setups and artifacts are what it was true of. If
a newer claim describes the current configuration, name it in `replaced_by`. A text never
reports an outdated claim as a finding about the current work, only as what held for the
earlier configuration (§6 rule 2). Two neighbouring cases are not `outdated`: a claim
that was wrong about the configuration it was derived from is `refuted`, and a claim you
have not yet checked against the new configuration keeps its status until you have.

**A claim that rests only on real results and sources can still be `preliminary`.** The
status covers the step as well as the support. A claim that restates what a cited source
says, or that does arithmetic on established results, is `established`. A claim that
interprets (why something happened, what a difference means, whether an effect will hold
elsewhere) involves a judgement even when every number under it is solid, and stays
`preliminary` until that judgement is backed by controls, repeated runs or a source. In a
paper many of the interesting claims are of the second kind. If nearly all your claims are
`established`, check that you applied the step test and not only the support test.

A claim has no `scope` field. It inherits its scope through `derived_from`: a claim
resting on a result measured over 80 born-digital PDFs is a claim about 80 born-digital
PDFs, and the same holds along chains of claims. A second, written-out copy of the scope
could drift from the first. Instead, a claim carries `not_supported`: the specific
sentence it must not be turned into, which is more concrete than a restated scope tends
to be.

`unsourced` is for a claim you believe on general grounds and expect to be citable,
but have not yet found a source for. `derived_from` can stay empty until you do; the `note`
carries where you have already looked, where to look next, and what happens if nothing
turns up. Once the source exists, add an `artifact` for it, put its id in `derived_from`
and change the status (§4.10).

`unsourced` exists only for `claim`. A `result` is something you measured; if you have no
evidence for it, it was never a result. And a claim that stays unsourced because nothing
*could* support it is an `assumption` and is retyped, unless a conclusion depends on it;
§4.10 says what to do then.

### 4.3 `assumption`: granted, not supported here

```yaml
- id: P-
  type: assumption
  statement: >                    # one sentence
  basis: >                        # REQUIRED — why it is reasonable, and why it is not
                                  # tested or sourced here
  breaks_if: >                    # REQUIRED — what would make it false
  surface:                        # yes | no. Default is yes: leave the field out
                                  # unless the value is no
  status:                         # assumed | refuted
  replaced_by: []                 # if refuted: ids of the forms that replaced it
  updated:                        # YYYY-MM-DD
  note: >
```

**Whether something is an assumption depends on what you intend to do about it.** Nearly
any premise could be tested in principle, so "untestable" does not always work or suffice
as a criterion.
There are three intentions, each with its own form:

| you intend to… | form |
| --- | --- |
| find a source someone else already produced | `claim`, status `unsourced` |
| resolve it yourself by measuring | `open`, later a `result` and a claim |
| do neither, and instead declare it and ask the reader to grant it | `assumption` |

Forms move between these as your plans change (§4.10).

**`basis` and `breaks_if` are fields and not notes, because a reader may need them.**
`basis` says why the assumption is reasonable and why it is not tested here: it is outside
the scope of this work, the cost is out of proportion, or it needs expertise or access you
do not have. A reviewer will ask this about any assumption that looks cheap to check, and
with the answer written here you give it once and do not have to improvise later.
`breaks_if` says what would make the assumption false. When expand states an assumption it
may give both, and it adds nothing beyond them (§6 rule 2). `note` stays optional, as for
every form.

**An assumption has no `derived_from`.** The `derived_from` fields link the forms into a
graph, in which each claim points at what it rests on. An assumption is where such a
chain stops: it rests on nothing in the file. An assumption with a `derived_from` is
mistyped, because anything that follows from something else is a `claim`. Retype it and
put the support in `derived_from`.

**`surface` defaults to `yes`.** An absent field, an empty one and `surface: yes` all mean
the same: expand must state the assumption, marked as an assumption and never as plain
fact, in every text that reports a claim resting on it, directly or through other claims.
Check reports an assumption missing from such a text (§7). With `yes` as the default, a
premise goes unmentioned only if you decided so explicitly.

**`surface: no`** is for a premise that is real but too basic to be worth a sentence. The
form still exists, still appears in `derived_from` and can still be searched for; it is
just not written out. The exception is the very general assumption that §4.2 tells you to
take out of a claim's `derived_from`: no `derived_from` names it any more, and it keeps
its form only because ids are permanent. Before setting `no`, make sure the premise is
really basic and not just familiar to you. The premise you stopped noticing years ago is
usually the one the argument depends on. A premise that your whole field shares and
nobody would dispute needs no form at all.

Some YAML loaders read an unquoted `no` as the boolean `False` and others as the string
`"no"`. A script that reads `surface` treats both as no (§8).

### 4.4 `limitation`: known weakness

```yaml
- id: P-
  type: limitation
  statement: >                    # one sentence
  affects: []                     # ids of what it weakens: results, claims, setups or
                                  # artifacts. REQUIRED while the limitation applies
  evidence: []                    # what establishes it; `stated` for what rests on
                                  # your own knowledge of the process. REQUIRED when
                                  # the status is established or resolved
  severity:                       # major | minor — DEFAULT minor; omit unless major
  status:                         # established | preliminary | resolved | refuted
  resolved_by: []                 # REQUIRED if resolved — SET-/ART- ids that removed it
  replaced_by: []                 # if refuted: ids of the forms that replaced it
  updated:                        # YYYY-MM-DD
  note: >
```

`affects` lets the checker require a hedge wherever the affected forms are used.

**A limitation needs evidence at the same bar as a `result`.** It is an assertion about
the work, and an unfounded one is harder to catch than an unfounded result. A caveat
reads as appropriate caution, so nobody argues with it, and it ends up in the write-up
weakening a finding that was never weak. Name the artifact, setup or run that
establishes it. If the limitation instead rests on knowing your own process (no second
annotator was used, a step was skipped), the entry `stated` is the honest evidence; it
marks the limitation as resting on memory. `stated` may stand next to forms when they
support one part of the limitation and your own knowledge the rest. If you can support
it neither way, it is not established: leave it out, or file it as `preliminary` with an empty
`evidence`, and expand will hedge it like any preliminary form. Only
a `preliminary` or `refuted` limitation may have an empty `evidence` (invariant 4). To
resolve a limitation you must first establish it, because `resolved` says it was real.

**A limitation covers what `affects` names and everything that rests on it.** In `affects`
you say what the weakness belongs to: a result, a claim, a setup or an artifact. From
there the coverage follows the links the forms already carry:

| form | rests on |
| --- | --- |
| `claim` | the forms in its `derived_from` |
| `result` | the forms in its `evidence` |
| `setup` | the forms in its `includes`, and its component values that are ids, including the items of a list |

The links are followed through any number of steps. A limitation on a setup therefore
covers every result that cites the setup, directly or through a pipeline setup, and every
claim derived from those results. `part_of`, `script`, `follows` and `uses` are not
links. They map the pipeline as it is now; what a result was produced with is recorded in
its `evidence` and in the pipeline setup it cites (§4.8). Sections play no part: a
covered form stays covered wherever it is filed, and a new result is covered as soon as
it cites something that is. A `refuted` limitation covers nothing.

Expand and check use this definition wherever they speak of what a limitation covers
(§6 rule 6, §7). The hedge is required only in a passage where a covered result or claim
is reported.
Setups and artifacts in the chain pass the coverage on, but a sentence that merely states
a setup's or artifact's value needs no hedge. §8.1 has a query that lists what each
limitation covers.

**Name the narrowest thing the weakness belongs to.** Naming an artifact covers every
result that uses it. If the gold set was labelled by a single annotator, that weakens the
scores computed against the labels but not the count of sentences in the set. So name the
scoring setup, or the results themselves, and not the gold-set artifact. A limitation that
applies (`established` or `preliminary`) must name at least one form (invariant 18): with
an empty `affects` it covers nothing and would never be mentioned.

**`severity` marks the limitations a reader must not miss.** Every limitation is
stated once in each passage of a text that reports a result or claim it covers (§6
rule 6), summaries, abstracts and conclusions included; that is what `minor`, the
default, means. `severity: major` adds two things: in each such passage it is stated in
a sentence of its own, not folded into a list of caveats; and it may not be left out
of an abstract or summary, which a `minor` limitation may be when the body of the text
states it.

Use `major` for a weakness that changes how the affected results should be read as
a whole, such as a flaw in the procedure that produced them. A weakness that only
qualifies one or two results stays `minor`. If most limitations of a section are
`major`, the marker no longer singles anything out.

**`status: resolved` marks a limitation that no longer applies.** It was true, and
a later setup or artifact removed it. That is different from `refuted`, which says
the limitation was never real. A resolved limitation:

- names what removed it in `resolved_by`: the new `setup`, or the `artifact` whose
  change fixed it. This field, not the note or the wording of the statement, is
  what says the limitation is over;
- still covers what `affects` names and everything that rests on it. Those forms were
  produced while the limitation applied, so they are still weakened by it and are
  still hedged, in the past tense;
- covers nothing else.

Resolving a limitation is three edits:

1. Set `status: resolved`.
2. Fill `resolved_by`.
3. Check that `affects` names only things from before the fix. Usually it already
   does, because a fix creates new forms instead of editing old ones (M4). A changed
   configuration is a new setup plus a new copy of each pipeline setup that includes
   it (§4.8; invariant 19 reports any you forgot), and a corrected dataset or script
   is a new artifact (§4.7). Results produced after the fix cite these new forms. If
   `affects` names something still in use after the fix, replace that id with the
   results produced before the fix. If there are none, empty `affects`. The
   limitation then covers nothing and stays in the file as a record of what was
   wrong.

If you forget step 3, results produced after the fix are still hedged. That is visible in
the text and errs on the careful side; no hedge is lost.

Leave `evidence` pointing at what established the limitation, which is usually the
superseded setup. A result produced after the fix cites the new setup and is never
added to `affects`.

### 4.5 `open`: unresolved

```yaml
- id: P-
  type: open
  statement: >                    # the question, not a guess at the answer
  status:                         # open | closed
  answered_by: []                 # if closed: ids of the forms that answer it
  updated:                        # YYYY-MM-DD
  note: >                         # if closed without an answer: why it was dropped
```

An `open` may appear in text only as an open question or as future work, never as a
finding. Once it is `closed` it is not written at all; the forms that answer it are
written like any other form, in the texts that cover them (§6 rule 2).

A question that gets answered ends in one of two ways:

- Retype it when the answer is one result that you measured. The form becomes that
  `result` and keeps its id (§4.10), so everything that pointed at the question now points
  at the answer.
- Close it when the answer lies in other forms (several results, a claim, a source
  that turned up) or when you dropped the question. Set `status: closed` and name the
  forms that answer it in `answered_by`. If you dropped it, say why in the `note`.

### 4.6 `def`: a term and its permitted wording

```yaml
- id: DEF-
  type: def
  term:                           # the term itself, one word or phrase
  definition: >
  use: []                         # strings that may be used for it
  avoid: []                       # strings that may NOT be used for it
  why_avoid: >                    # required if avoid is non-empty
  status:                         # established | retired
  updated:                        # YYYY-MM-DD
  note: >
```

`avoid` and `why_avoid` are how the format prevents imprecise wording, and they keep the
terminology the same from one revision to the next. Write one `def` per term; a term with
two meanings is two terms.

An `avoid` string is forbidden only as a name for the thing that the `term` names. In the
example of §9, "definition" may not be used for a definition candidate, but it is still
the right word for a sentence that was checked and found to be a definition. An `avoid`
string that occurs inside a `use` string ("definition" inside "definition candidate") is
not a violation either. Telling these cases apart takes reading the sentence, so the term
check is done by check (§7) and not by a literal string search.

### Code and data: `artifact` or `setup`?

§4.7 and §4.8 use four terms:

- An **artifact** is a thing that exists at a path or URL: a script, a notebook, a
  dataset, a dump, a prompt file, a cited paper.
- A **stage** is one step of a pipeline. It reads an input, applies one decision or
  transformation, and writes an output. A stage is part of an artifact and is not itself
  a form.
- A **stage setup** records how one stage was configured: which model, prompt, threshold
  or matching rule it used.
- A **pipeline setup** records what ran together to produce a result: the code, the input
  data and the stage setups. "Pipeline" here also means separate scripts where one reads
  the other's output.

| you have | write |
| --- | --- |
| a script or notebook that you run with its own command | one `artifact` |
| a file you read, produce or cite: a dataset, a dump, a prompt file, a paper | one `artifact` |
| a pipeline that you run with one command | one `artifact` for the whole pipeline, and a `setup` for each stage that qualifies (next row) |
| a stage with a choice you might change, which a result cites or will cite | one `setup`, with the pipeline's artifact in `part_of` |
| a result that came out of more than one step: several stages, or one script reading another's output | one pipeline `setup` that lists in `includes` everything that ran together; the result cites it (§4.8) |
| a stage that is only mechanics: retries, paging, batching, writing state | nothing |
| a stage that you run with its own command, and that supports results of its own | its own `artifact` |
| a fact about what a file contains or where it comes from | the `note` of that file's artifact if only you need it; a `result` that cites the artifact if a text should be able to state it |
| a fact about what a program does with a file | the `setup` of the stage that does it |

### 4.7 `artifact`: script, dataset, dump, notebook

```yaml
- id: ART-
  type: artifact
  path:                           # <repository name>/<path in it>, or a URL
  version:                        # repo files: tag or commit, if there is one.
                                  # Everything else: snapshot, release or access
                                  # date, always (M5)
  entrypoint:                     # how to run it, verbatim except for path patterns
  produces: []                    # optional — outputs that a result points at,
                                  # written like path
  status:                         # current | superseded | planned
  updated:                        # YYYY-MM-DD
  note: >
```

**`produces` is optional.** It connects a `result`'s `evidence` to the file its numbers
came from. Leave it empty for anything you do not run: cited papers, and dumps and
datasets you only read. For something you run, list the output files that a result's
numbers were read from, or that another artifact's `entrypoint` takes as input. These are
often the final outputs, but an intermediate file belongs in the list too if a result was
read from it. Other output files may be listed as well when it helps to know where they
are; nothing requires them.

You may add a path to `produces` at any time, also after results rest on the artifact.
The file was always written, so nothing that rested on the artifact becomes wrong (M4).
Removing or changing a path still needs a new artifact form.

**Every path starts with the name of its repository.** `path` and the paths in
`produces` are written as `<repository name>/<path inside the repository>`, so that a
path also says which repository the file is in. A file that is in no repository gets an
absolute path. `entrypoint` is written the same way, as the command run from the folder
that holds the repository: `python pdf-defs/extract/pdf_defs.py`. If the command has to
be run from inside the repository, it starts with `cd <repository name>/<folder> &&`. A
result then leads to its file
in three steps: its `evidence` names the artifact, the artifact's `produces` gives the
full path, and the run label fills in a pattern.

For a pipeline, write one artifact per main file, the file you start it with. Its
`produces` holds the final outputs that something in the forms refers to. The stages
inside it are not artifacts; a stage whose configuration matters gets a `setup` (§4.8).
If you run the stages with separate commands and they support different results, each is
its own artifact. Their order needs no link field: a path in one artifact's `produces`
appears again in the next one's `entrypoint`. A result from the later artifact also
depends on the earlier one, and cites both through a pipeline setup (§4.8).

Paths may be patterns, such as `pdf-defs/results/<run-date>/metrics.json`. The run label in the
result's `evidence` says which run is meant. Putting the run here instead would mean
editing `produces` after every run. An `entrypoint` that reads such a file writes the
same pattern in place of a concrete run, so that invariant 20 can match the two paths as
text.

**An artifact's note describes the thing itself, not what is done with it.** A note that
starts "is read as", "is parsed by", "is expanded into" or "is cleaned before" describes
the behaviour of a stage. It belongs on that stage's `setup`, whose `script` says which
code does it. The artifact's note says what exists at the path: its shape, where it comes
from, what it contains. To tell the two apart, imagine that a different program read the
file. "One JSON object per line, 612 lines" would still be true, so it describes the file.
"Lines without a DOI are skipped" would no longer be true, so it describes the program and
belongs on the setup. With each behaviour written down in one place, a change in how a
file is read means editing one setup, and no artifact note is left contradicting it.

A note is never expanded (M7). A fact about an artifact that a text should be able to
state, such as how many records a dataset has, is therefore written as a `result` with the
artifact in its `evidence`.

Code is the exception, because there the artifact is the program. How a script parses
its own flags, what it requires and how it fails are properties of the file. What the
script does to other files belongs on its setup, if it has one; a small tool without
setups (§4.8) has no other place for it, so there it goes in the artifact's note.

**The `version` of an artifact is the one its results were produced with, or the one
its claims cite.** Once a result or claim rests on the artifact, directly or through
setups (§4.4), a changed file is a new `artifact` form with a new id, and the old one is
set to `superseded`. Results produced with the new version are new result forms that
cite it. A claim that should rest on the new version is pointed at it when you revisit
the claim (M3). This is M4 for artifacts; a field that was recorded wrongly is corrected
in place, as M4 describes.

A `planned` artifact does not exist yet, so it has no real version. Give it
`version: planned` until it exists. Then replace that value with the real version and set
the status to `current`. No result can rest on an artifact that does not exist yet, and
a claim that cites it is revisited once its status changes (M3), so this edit does not
break M4.

`artifact` also holds external sources. A cited paper is an artifact like any other:
DOI or URL in `path`, access date or version in `version`, `entrypoint` and `produces`
left empty. This is what a sourced claim points `derived_from` at, so no separate
citation type is needed.

### 4.8 `setup`: a configuration

```yaml
- id: SET-
  type: setup
  components:                     # stage setup: key–value map; keys from the file's
                                  # component_keys
  includes: []                    # pipeline setup: ART-/SET- ids of what ran together
  part_of: []                     # ART- ids of the code this is a stage of
  script:                         # file(s) implementing it
  follows: []                     # SET- ids of the stages that run before it, in
                                  # this script or another
  uses: []                        # SET- ids of the stages this stage calls
  status:                         # current | superseded | planned
  updated:                        # YYYY-MM-DD
  note: >
```

A setup is one of two kinds, and a form is one or the other:

- A **stage setup** records how one stage was configured. It fills `components`.
- A **pipeline setup** records what ran together to produce results. It fills `includes`.

**Two fields are frozen, four are a map.** `components` and `includes` say what a result
was produced with, so they are never edited in place; a change means a new form (M4).
A `planned` setup is the exception, as a planned artifact is (§4.7): it has not run yet,
so no result rests on it. Fill in or change its `components` or `includes` in place, and
set it to `current` once it has run. A value that was recorded wrongly is corrected in
place too (M4). `part_of`, `script`, `follows` and `uses` map the
pipeline as it is now: which code a stage belongs to, which file holds that code, what
runs before it and what it calls. You edit them in place when the pipeline changes, and
coverage (§4.4) never passes through them.

**Pipeline setups.** A result that came out of more than one step was shaped by all of
them: by every stage before its own, and by every script whose output the next one read.
A stage setup does not record which versions of the other steps were in use; the pipeline
setup does. Its `includes` lists everything that ran together: the code, the input data
and the stage setups. List the stage setups next to their script, because a script does
not bring them along.

```yaml
- id: SET-pipeline-v2
  type: setup
  includes: [ART-pipeline, ART-corpus, SET-search-v1, SET-classify-v2, SET-tagging-v1]
  status: current
  updated: 2026-10-07
```

When something changes, how many new forms you need depends on how many frozen fields
name the changed form, not on the length of the pipeline:

1. One new form for what changed: a new stage setup, or a new artifact form (§4.7).
2. One new copy, with the id swapped, of each current form that names the old one in a
   frozen field: a stage setup that has it as a component, and every pipeline setup that
   includes it or includes a form copied in this step. A pipeline setup may include
   another pipeline setup, so the copying repeats until no current form names a
   replaced one.

The usual case, a changed stage in a pipeline with one pipeline setup, is two new forms. A
changed dataset that a stage setup names as a component is three: the artifact, the stage
setup and the pipeline setup. If you keep several pipeline setups, each one that includes
the changed form needs its own copy. The replaced forms become `superseded`, and stages
that do not name the changed thing keep their forms.

Where a map field names a replaced form, edit it in place. You do not have to search for
these: invariant 19 lists every current setup that still names a superseded form, in a
frozen field or a map field. From then on, new results cite the new pipeline setup and
earlier results keep citing the old one, so each result still says exactly what it was
produced with.

A pipeline setup may stop at any stage. For a result that comes out of the second of four
stages, write a pipeline setup that includes the first two. A limitation on a later stage
then does not reach that result.

**What a result cites** in `evidence`, besides its run label or labels:

- If nothing ran before the thing that produced it (a single script on its input data, or
  the first stage of a pipeline): the artifact, the input data, and the stage setup if
  there is one.
- In every other case: one pipeline setup.

Invariant 20 checks this from both sides. A result may not cite directly a stage that has
something before it, or a script that reads another script's output, unless a pipeline
setup it cites includes them. And a current pipeline setup must include everything that
runs before the things it includes.

A pipeline setup does not replace the artifacts. An artifact is the code or the data: it
holds the path, the version and the command. The pipeline setup only says which of them
ran together.

Two cases need a manual step. First, a result may cite a stage or script directly while
nothing runs before it. If something later does (you insert a stage in front, give it a
`uses` entry, or make the script read another script's output), invariant 20 reports the
older results. Write a pipeline setup of the old shape, with status `superseded`, and
add it to their `evidence`. It includes only the code and data they already cite, so
this is the addition that §4.1 allows.

Second, invariant 20 reports older results that cite a script on its own once you write
the first stage setup for that script. If the new setup describes how those results were
produced, add it to their `evidence` (§4.1). If not, write a second stage setup for the
configuration they were produced with, give it status `superseded`, and add that one
instead.

**Write a stage setup only when it earns one.** A stage gets a setup when both of these
hold:

1. it contains a choice that could reasonably have been made differently and that you
   might change, such as a model, a prompt, a threshold or a matching rule; and
2. a `result` cites it, directly or through a pipeline setup, or will once you measure
   something.

A pipeline setup is written when a result needs one to cite.

Mechanics are not choices, even when each has its own function in the code: retry and
back-off, pagination, batching, label lookup, rendering, writing state. They get no setup
of their own. Where they could affect results, a stage that has a setup anyway can record
them: that is what the `batch` key and the paging part of `source` are for.

**Do not mirror the structure of the code.** One setup per function records the call
structure and not the configurations, and the one or two stages that matter are hard to
find among the rest.

A short single-script tool whose output you inspect rather than measure (a report, a
checker, a notifier) usually needs no setups at all. Its artifact, its terms and its
known weaknesses are all there is to record. Operational details worth keeping (where it
keeps state, what its flags do) go in the artifact's `note`, where properties of a script
belong anyway (§4.7). If a `def` already fixes the tool's one real design decision, the
tool needs no setup for it. Add setups later if the tool grows into a pipeline or starts
producing results; M4 applies to them only once they exist.

**The four map fields.**

- `part_of`: the `ART-` id of the code this is a stage of. It lets you see which artifact
  a setup belongs to. A result is tied to that code through its `evidence` or its
  pipeline setup, not through `part_of`. When the artifact gets a new form, re-point `part_of`
  in place. A configuration used by several artifacts lists them all.
- `script`: the file or files that implement this stage. Write the path in whatever form
  is easiest to read; it does not have to be relative to the artifact's `path`. Several
  files are fine when together they implement the one stage; files that implement
  different decisions belong to different setups (§1). Name the code here and not in a
  note. When the code moves to another file, edit `script` in place.
- `follows`: the `SET-` ids that run before it. It lists predecessors and not a step
  number, so inserting a stage does not renumber the others and a stage can have two
  predecessors. `follows` must be acyclic (invariant 14); any order that respects it is a
  valid order of the pipeline. `follows` may cross scripts: the first stage of a script
  that reads another script's output follows the last stage of that script. When the
  stage before is replaced, re-point `follows` to the new setup in place; invariant 19
  reminds you.
- `uses`: the `SET-` ids of the stages this stage calls. A loop stage that calls a
  classifier names it here, and re-points it in place when the classifier is replaced.
  `follows` gives the order and `uses` says what a stage calls, and a stage may have both:
  a loop that runs after the search and calls the classifier inside itself. Unlike
  `follows`, `uses` may form a cycle, because stages can call each other in a loop.

**Component keys come from a standard list.** These sixteen keys cover the slots a
stage usually has. Use them, with these descriptions, before inventing one:

```yaml
component_keys:
  source: "where the data is fetched from (service, endpoint or file), and how its results are paged"
  query: "what is asked for, in the terms the service understands"
  filter: "what is excluded before the stage's main step, including duplicates"
  data: "the input the stage runs over (documents, records or rows), with its selection and ordering"
  model: "the model or engine that runs, with its decoding parameters"
  prompt: "the prompt text, or the artifact holding it"
  batch: "how many items per call, how calls are paced, and what happens on failure"
  method: "the decision rule or algorithm the stage applies, including how items are matched"
  vocabulary: "the fixed list of terms or items the stage matches against or offers to choose from"
  stopping: "what makes an iterative stage terminate"
  feedback: "what the model that revises the prompt is told about how the last prompt performed"
  review: "the human checkpoint, and what it can change"
  scoring: "how one output is compared against the gold standard"
  metric: "the summary numbers computed from the scored outputs"
  writes: "what the stage creates or modifies, in the database and elsewhere"
  provenance: "how written statements are sourced"
```

The file carries its registry at top level, as a map like the one above. It holds the
standard keys the file uses, copied with their descriptions, plus any key of the file's
own. Every key used in any `components` map must appear there (invariant 13), and every
entry carries one line saying what belongs in that slot.

`scoring` and `metric` are a pair: `scoring` says how a single output is judged, `metric`
says which numbers are computed from those judgements. A stage that does both fills both.

**Add a key of your own only when no standard key fits.** Before adding one, check the
three pairs that are easiest to duplicate:

- what a stage reads is `data`, whatever it is made of; there is no separate key for
  documents, a corpus or an input set;
- what a stage produces is `writes`; there is no `output`;
- a rule for matching, pairing or deciding is `method`; a rule for leaving things out,
  duplicates included, is `filter`.

A new key gets a description that says how it differs from the nearest standard key.
Without descriptions, different setups would fill the same key with different things.
Without the registry, `model`, `llm` and `engine` would end up as three names for one
slot. The registry does for configurations what `def` does for terms.

**Component values are values you can copy, not descriptions.** Write `temperature 0` or
`threshold 0.8`. Where a component is another form (a prompt file, a vocabulary, a
dataset), the value is that form's id: `prompt: ART-prompt-v2`, never
`prompt: "the second version of the prompt"`. Anything with its own version history must
be an artifact, because otherwise you cannot say which version a result used. A plain
value must not start with one of the five id prefixes, or a script will take it for an id:
write `p-value below 0.05`, not `P-value below 0.05` (§8).

A component may hold several values, such as two datasets that a stage reads. Write them
as a YAML list with one item per line, not in square brackets. Each item follows the
rules above:

```yaml
  components:
    data:
      - ART-corpus-a
      - ART-corpus-b
```

### 4.9 `section`: a filing drawer

```yaml
- id: SEC-
  type: section
  title:                          # working label, not a heading
  about: >                        # one sentence: what belongs in here
  links:                          # zero or more typed connections to other sections
    - {to: SEC-, rel: , why: }    # rel: builds_on | groups_with | elaborates
                                  #      | contrasts_with | supersedes
  status:                         # drafting | drafted | retired
  updated:                        # YYYY-MM-DD
  note: >
  forms:                          # everything filed here, indented one level deeper
    - id:
```

`drafting` means you are still working on the section. `drafted` means you do not expect
anything in it to change any more. `retired` marks a section that another one
`supersedes` (§5).

How sections are used, split and linked is described in §5.

### 4.10 Lifecycle: how forms move between types

A proposition can move between the five `P-` types as your plans change and as searches
succeed or fail. Retyping changes `type`, the fields that differ, `status` and `updated`.
The id never changes (M1), so no form that points at it needs editing.

| from → to | trigger | what to edit |
| --- | --- | --- |
| unsourced claim → claim | source found | add the `ART-` id to `derived_from`, set `status` per §4.2 |
| unsourced claim → assumption | searched, nothing usable, and the conclusion holds without it (see below) | `type`, drop `derived_from`, fill `basis` and `breaks_if`, add `surface: no` only if it should not be written out; record the failed search in `note` |
| unsourced claim, not retyped | searched, nothing usable, and the conclusion depends on it | weaken the conclusion or restructure the argument (see below); once the conclusion holds without the premise, the row above applies |
| unsourced claim → open | you decide to measure it yourself after all | `type`, restate `statement` as a question, drop `derived_from` and `not_supported` |
| assumption → open | you decide to test it after all | `type`, restate `statement` as a question, drop `basis`, `breaks_if` and `surface` |
| assumption → claim | a source turns up after all | `type`, drop `basis`, `breaks_if` and `surface`, add the `ART-` id to `derived_from`, set `status` per §4.2 |
| open → result | you measured it, and one result is the answer | `type`, add `scope` and `evidence`, statement in past tense; write the interpretation as a separate `claim` |
| open → limitation | you decide not to chase it | `type`, restate `statement` as an assertion about the weakness, add `affects` and `evidence` |
| open → closed (not retyped) | other forms answer it, or you dropped it | `status: closed`; `answered_by` names the forms that answer it, or `note` says why it was dropped (§4.5) |
| limitation → resolved | the cause was fixed | `status: resolved`, fill `resolved_by`, check `affects` (§4.4) |
| result, claim, assumption or limitation → refuted | shown wrong | `status: refuted`, `replaced_by` names what replaced it; the form stays (M2) |
| claim → outdated | a setup or artifact under it was replaced, and the claim does not hold for the replacement | `status: outdated`, `replaced_by` names the newer claim if there is one; `derived_from` stays (§4.2) |

**Choose the type when you first write the form**, using the three intentions in §4.3. If
everything starts as an unsourced claim, the gap list (§8.1) fills with searches you never
intend to run. The list is only useful when every line on it is a search you will do.

**A failed search does not always end in an assumption.** Demoting the claim to an
assumption is the easy way out, and it can turn an unsupported belief into a "we assume"
that looks more respectable than it is. Before demoting, ask whether the conclusion still
holds if this premise fails. If it does, demote and record the failed search. If it does
not, the conclusion depends on the premise, and the failed search tells you something:
either the belief is less secure than you thought, or the question is contested. Then
weaken the conclusion or restructure the argument. A premise that everything depends on
cannot simply be assumed. Once the conclusion holds without the premise, the first case
applies: demote the premise and record the failed search.

Demoting changes no status downstream, because `unsourced` and `assumed` set the same
ceiling (invariant 12). Only finding the source raises it.

---

## 5. Sections

A section collects everything about one topic, so that when you come back to the topic
you find it in one place. The template is in §4.9; this section says how to use it.

Use sections loosely. Put everything about extracting definitions from PDFs into
`SEC-pdf-defs` (assumptions, scripts, half-measured results, open questions) without
deciding in advance how it will be written up.

In the template, `forms:` comes last so that the section's own fields stay together at the
top of a long subtree.

A section's `note` holds what you would otherwise have to remember, such as a pending link
or the reason for a split. Do not use it to list the kinds of form the section has none
of when that follows from the topic: a checking tool has no results, and a reading list
has no scripts.

**Splitting is free.** If a section becomes hard to scan, you can add new sections, move
the forms into their `forms:` lists, and link the sections:

```yaml
  - id: SEC-pdf-defs-results
    type: section
    title: "PDF definition extraction — results and claims"
    about: "Measurements from the extraction runs and what they support."
    links:
      - {to: SEC-pdf-defs, rel: groups_with, why: "same topic, split off for size"}
      - {to: SEC-pdf-defs-setup, rel: builds_on, why: "numbers come from that configuration"}
    status: drafting
    updated: 2026-09-17
    forms:
      - id: P-candidate-yield
        # … the rest of the form, moved unchanged
```

Nothing else changes: ids stay, and `derived_from` and `evidence` keep pointing where they
pointed, because no form refers to its section and no section lists its forms by id (§2).

This includes limitations: what a limitation covers follows from `affects` and the links
between forms (§4.4), never from the section a form is filed in.

**Relation vocabulary.** The list is closed by default. Extend it only for a relation you would use
at least three times:

| `rel` | meaning |
| --- | --- |
| `builds_on` | this section presupposes that one; read or write it first |
| `groups_with` | same topic, split for size or readability |
| `elaborates` | goes deeper into something the other states broadly |
| `contrasts_with` | the two treat alternatives, and should be kept consistent |
| `supersedes` | this replaces a retired section |

`why` is one line and is for you, not for the model. It records the reason for the link,
so that you still understand the link later.

`builds_on` must be acyclic, and `supersedes` points one way only, from the new section
to the retired one. The other relations may be mutual, and `groups_with` usually is, so
write it on both sides.

Sections are not the structure of the finished document. The paper may merge three
sections into one, split one across chapters, or nest them under headings that exist
nowhere here. Titles are working labels. Nothing in the format constrains the final
layout, and there is no `parent` field.

---

## 6. Expand: rules for generating text

**Expand always produces a draft.** The model writes the text with form ids inline, and
marks every unsourced claim and every claim that rests on one. It is never asked for a
final text directly. You make the final text afterwards from a draft that has passed
check (§7 says when it has), by stripping the bracketed ids and the `[link]` and
`[frame]` marks. Stripping changes no wording, so a script can do it. A draft that still
contains a `CITATION NEEDED` marker cannot be made final, because the claim behind the
marker has no source yet. Proposed forms and "possible errors" (rules 7 and 8) follow the
text and are not part of it.

**Expand is given the whole file and is told what to write about.** The forms a text needs
are spread over sections: a def in one, a setup in another, a limitation that covers a
result filed elsewhere. So the model always gets the whole forms file, and the request
names the *targets*, the sections or forms the text may report:

- The text reports targets. For a section, those are the forms filed in it.
- A form outside the targets may be cited only where a target needs it: a def for a term,
  a setup or artifact for a value, a limitation that covers a target, an assumption or
  another form that a target rests on.
- Other forms are not written about, although the model can see them.

**Expand works in two steps: a plan, then the text.** A text that reports every target in
the order of the file reads like the file. So the model first returns a plan and writes
nothing else:

- the headings of the text as a tree, sections with their subsections, laid out the
  way this kind of text is normally laid out (see "Shape" below);
- for each heading, one line saying what the part is to get across and the ids of the
  forms it reports, in the order they will appear;
- the tables: for each, what its rows and columns are and which forms fill it
  (rule 11);
- for each passage, the limitations and assumptions that will be stated in it (rules 2
  and 6), and where;
- for an abstract or summary, its length in words and the few forms it reports;
- the targets it leaves out, and those it only summarises, each with a reason.

You change or approve the plan, and the model then writes the text that the plan
describes. The request may name the forms the text should lead with (`Lead with:`) and
a length for the abstract or for the whole text (`Length:`). A
plan may leave out a target, since not every setup value belongs in every text. It may
not leave out a limitation that covers a form the text reports, or an assumption that a
reported claim rests on. The plan decides what is said and in what order. It adds no
content: every line of it names forms.

**A text has two kinds of sentence** (a creative rendering has a third, §6.1):

- A **carrying sentence** says something that the forms say, and cites their ids. One
  sentence may carry several forms, and one form may be spread over several sentences.
- A **link sentence** helps the reader along and says nothing about the work. It
  announces what comes next, refers back to something the text has already said, or
  marks a change of topic. It is marked `[link]` in place of an id. It must not state or
  imply anything that a form could support or contradict: no number, no outcome, no
  cause, no comparison, and no judgement such as "notably" or "surprisingly".

A *passage* is the text under one top-level heading, together with its subsections. In
a text without headings, each paragraph is a passage. An abstract or summary is a
passage of its own.

**Shape.** The rules below say what a text may assert. They do not make it read well. A
text that reports its forms one after the other, each in a sentence of its own, obeys
every rule and still reads like the file. So the plan and the text follow the shape of
the kind of text that was asked for. Shape decides where things go and how much room
they get. It never adds content.

- *Group by subject, then by the usual parts.* A paper on several pieces of work gets one
  section per piece, and each section gets the subsections a reader expects: method,
  results, and where there is something to say, limitations and interpretation. Method
  and results of one piece of work are not spread over sibling sections.
- *Claims lead, results support.* A results part opens with what was found, in the
  words of a claim where there is one, and then gives the numbers behind it. A part
  that only has results says so by being short.
- *Parallel things go in a table.* Several stages of a pipeline, several models with
  the same settings, the same measurement for several runs: these are a table
  (rule 11), and the prose around it says what the table is for and what stands out,
  in the words of a claim. Prose does not repeat every cell.
- *Method prose describes a procedure.* It says what happens in which order. Parameter
  values that a reader looks up rather than reads go in a table, or are left out by
  the plan.
- *An abstract is short.* It says why the work was done, what was done and the main
  findings, which are the `Lead with` forms. It gives no setup values and no result
  that is not one of the main findings. Unless the request says otherwise, it has at
  most 200 words.
- *An introduction says what is coming*, in link sentences, after the motivation.

Where the forms give the text too little to hang together (no claim says what a set of
results adds up to, or why a step was done), the text stays thin there and the gap is
listed under proposed forms (rule 7). A paper is mostly argument, and argument is made
of claims.

The rules:

1. Every sentence is a carrying sentence or a link sentence. A carrying sentence must be
   traceable to at least one form id. Append the ids inline:
   `... 33 of 40 executed [P-exec-rate].` It can state the `statement` of an assertable
   form, a result's `scope`, an assumption's `basis` or `breaks_if`, the `definition` of
   a `def`, or a field value of an `artifact` or `setup` (a path, a version, a component
   value), and it cites that form's id. A `note` is never written out.
2. Register follows `status`. For the five assertable types:
   - `established` → plain assertion
   - `preliminary` → hedged. A preliminary claim also needs the scope of the results
     under it (rule 4). The scope is stated in the sentence, or earlier in the same
     passage
   - `assumed` → explicitly marked as an assumption. The sentence may give the
     assumption's `basis` and `breaks_if`, and adds nothing beyond them. An assumption
     must be stated in every text that reports a claim resting on it, directly or
     through other claims. The exception is `surface: no`: such an assumption is not
     written out, but it still limits what the claims resting on it may assert
   - `unsourced` → always with a visible marker:
     `... in several widely used corpora [CITATION NEEDED: P-wikidata-ingested].`
     A sentence that reports a claim resting on an unsourced one, directly or through
     other claims, carries the same marker with the id of the unsourced form
   - `open` → open question or future work only, never a finding
   - `closed` → not written. The forms that answer it are not pulled in by it: they are
     written like any other form, where they are targets or a target needs them
   - `refuted` → not written at all, except as an explicit correction
   - `outdated` → never written as a finding about the current work. It may be reported
     only as what held for the earlier setup or artifact version, named as such
   - `resolved` → written only as the hedge on a result or claim it covers (§4.4), in
     the past tense

   For `artifact`, `setup` and `def`, which a sentence can name or use:
   - `current`, and `established` for a `def` → named and used normally
   - `superseded` → named only as the earlier version that a cited result was produced
     with
   - `planned` → future work only
   - `retired` → not used; a retired `def` no longer governs wording

   Sections are never written out, whatever their status.
3. Numbers, paths, versions and names are copied verbatim. Never rounded, never
   reformatted, never converted, never spelled out: `10` stays `10`.
4. A sentence must not exceed the `scope` of the forms it rests on, and must not assert
   anything listed in their `not_supported`. For a claim, the governing scope is that of
   the results underneath it, followed transitively through `derived_from`. A claim with
   no result underneath it, resting only on a source or an assumption, has no such scope:
   the sentence then stays within the claim's `statement` and its `not_supported`.
5. Terms follow `def`: the thing a def's `term` names is called by a string from `use`,
   never by one from `avoid` (§4.6). A `retired` def is ignored.
6. A limitation is stated once in every passage that reports a result or claim it covers
   (§4.4 defines what it covers). It is stated at or before the first such sentence of
   the passage, and in a way that makes its reach clear, for example "all scores in this
   section". The later sentences of the passage do not repeat it. A limitation with
   `severity: major` gets a sentence of its own in each such passage. Other limitations
   may share a sentence. A sentence that only states a value of a setup or artifact
   needs no hedge.

   An abstract or summary is treated differently, because it cannot carry every
   caveat and stay short. It must state every `major` limitation that covers
   something it reports. A limitation with `severity: minor` may be left out of it,
   provided the body of the same text states it under rule 6 and the abstract keeps
   every hedge and scope that rule 2 asks for. This is what `severity` is for: mark as
   `major` the limitations that a reader of the abstract alone must not miss. A
   summary that stands by itself, with no body, has no such allowance.
7. Nothing may be added that is not in a form. If the text needs a bridging fact, the
   model emits a proposed new form instead of writing the sentence, and continues. A
   reason is a fact like any other: if the text needs to say why something was done and
   no claim says it, that is a proposed form too. Link sentences are the only sentences
   without a form, and they carry no fact.
8. The model does not correct, complete or improve what the forms say, even where a form
   looks wrong or contradicts what the model knows. It writes what the form says and
   lists the form's id, with its reason, under "possible errors" after the text.
9. Wording. A `statement` records what is the case, and the text does not have to repeat
   its sentence. The model changes the structure and keeps the words that carry the
   meaning.

   Free to change: the order of forms and of clauses, where sentences begin and end,
   merging several forms into one sentence or spreading one over several, active or
   passive voice, the grammatical person, and pronouns for things the text has already
   named.

   Not to change:
   - what rule 3 and rule 5 protect: numbers, paths, versions, names and def terms;
   - the content words: the verb of the statement and the nouns and adjectives that say
     what it is about are taken from the form. No synonym replaces them: "scored
     highest" does not become "performed best", and "was classified relevant" does not
     become "is relevant";
   - the small words that set the reach of a statement: quantifiers ("all", "none",
     "4 of 7"), negation, "only", "at least", "at most", "alone or tied", comparatives
     and superlatives, words of possibility and necessity, and qualifiers such as
     "recorded as";
   - the past tense of a result.

   The test is the same in both directions. The form must say everything the sentence
   says, and the sentence must not leave out a part of the form whose absence changes
   what a reader takes away. Dropping a qualifier is the usual way to fail the second
   half.

   Merging is where parts get lost. When one sentence carries several forms, or sums
   up forms the text has already reported, each form's statement stays complete:
   every part that sets its reach is still there ("of the starting prompts and the
   last kept prompts", "on the same kind of text"). A short label for a form ("the
   doubled gain") is a rewording like any other and has to pass the same test. If the
   complete statements do not fit into one sentence, they go into several.

   A form with `wording: fixed` (§3) is copied word for word. The statement may stand
   inside a longer sentence, but its own words stay as they are and stay together.
10. Relations. A sentence may say how two forms relate when a field records the
    relation, and it then cites both forms:

    | field | wording it allows |
    | --- | --- |
    | `derived_from` | the claim follows from, rests on or is based on those forms. For a `preliminary` claim the wording is hedged: "suggests", not "shows" |
    | `evidence` | the result was measured with that setup, script or data |
    | `follows` | the stage runs after that one |
    | `uses` | the stage calls that one |
    | `includes` | those things ran together |
    | `affects` | the limitation applies to that form |
    | `resolved_by`, `replaced_by`, `answered_by` | what the field name says |

    No other relation is stated. Two results that no claim connects are not joined,
    however obvious the connection looks. If the text needs the connection, that is a
    proposed claim (rule 7).

    Three kinds of wording state a relation without looking as if they do, and each
    is checked against the fields before it is written:

    - Words of reason and consequence: "so", "therefore", "thus", "hence", "because",
      "since", "as a result", "which is why", "that is why", "despite", "although".
      This holds inside a single form too: where a statement joins its two halves
      with a semicolon or "and", the sentence does not join them with "so".
    - A pronoun in front of a verb of inference: "this suggests", "this shows", "it
      follows". The pronoun points at the sentence before it. That sentence must
      report a form named in the claim's `derived_from`, and where the claim rests
      on several forms, the text names them all and does not let "this" stand for
      them.
    - An opening word that makes a step sound like a reaction to what came before:
      "So we repeated the scoring", "We therefore ran it again". That gives a reason
      for the step. "Then" and "next" give only an order, and they are allowed where
      `follows` records it or where the text merely moves on.

    "And", "also", "then" and a plain full stop state no relation and are always
    safe.
11. Tables. A table reports forms like prose does, and every rule above applies to it.

    - Each row cites the ids of the forms it reports, in a last column headed `forms`.
      That column is stripped with the other ids when the final text is made.
    - Row label, column header and cell together must say what the form says, by the
      test of rule 9. The header carries the part of the statement that the cells of
      the column share, the row label the part that the cells of the row share, and
      the cell the rest. A qualifier that holds for one cell only stands in that cell
      ("5 of 10, alone or tied").
    - Cells hold numbers and names verbatim (rule 3) and terms from `def` (rule 5).
    - A table groups forms that say the same kind of thing about different subjects.
      It never fills a cell that no form fills: an empty cell stays empty, and no
      value is computed, averaged or carried over from another row.
    - The caption says what the rows and columns are. It is a link sentence, or a
      carrying sentence if it states a scope or a fact.
    - Rule 6 holds for the passage the table stands in: a limitation that covers a
      form in the table is stated in that passage at or before the table, or in the
      caption.

A figure is not covered by these rules yet: expand produces none.

Rules 7 and 9 do most of the work. The gaps that rule 7 brings up are usually gaps in the
work itself and not in the forms. Rule 9 is where a text can go wrong without anyone
noticing, which is why check prints the form's wording next to every reworded sentence
(§7).

### 6.1 Creative renderings

A creative rendering presents the forms in another shape, for example as a fantasy story
or a dialogue. Its purpose is to get the gist across: what was found, how sure it is and
what is still open. It is not a place for scores to four decimal places or for paths.

**You switch creative rendering on; the model never does.** Expand has two modes. The
default is `strict`: rules 1 to 10 as they stand, every sentence a carrying sentence or a
link sentence. `creative` adds what this section describes, and it applies only when the
request contains the line `Mode: creative`. The model does not infer the mode from the
kind of text you ask for: without that line it writes in strict mode, whether you ask for
a paper, a summary or a blog post. If it thinks a request cannot be met in strict mode
(you ask for a story but the mode is strict), it says so and invents nothing.

The mode decides only whether invented sentences, stand-ins and gist are allowed. It says
nothing about tone: a lively text for a general audience is still strict as long as every
sentence carries a form or is a link.

**What a creative rendering reports.** Among the targets, it reports the claims,
limitations, assumptions and open questions. A result or a setup appears only where one
of those needs it, or where the plan lists it. A story therefore covers far fewer forms
than a paper on the same targets, and a part of the work that has no claims hardly
appears in it. If that part should appear, write the claims that state its gist.

**Three kinds of sentence:**

- A **carrying sentence** says something that the forms say and cites their ids, as in
  strict mode, with the two allowances below (gist and stand-ins).
- A **link sentence**, as in strict mode.
- A **framing sentence** is invented for the story and is marked `[frame]`. It gives the
  story its setting, its characters and their manner. It must not state or imply
  anything that a form could support or contradict: no number, no outcome, no cause, and
  no judgement about anything the forms describe.

**Gist.** A carrying sentence in a creative rendering may say less than the form:

- It may leave out numbers, paths, versions and ids. It never rounds or approximates
  them: a number is given as the form gives it or not at all. "About 0.96" and "nearly
  all" are alterations; leaving the number out is not.
- A qualitative statement (a comparison, a direction, a word such as "higher", "most",
  "small" or "unstable") is allowed only where a form states it in those terms. That is
  usually a claim. The model does not read a comparison or a trend off results itself,
  because that would be a new claim.
- Rule 9 holds in one direction only: the forms must say everything the sentence says.
  The sentence may leave things out, as long as it does not turn a hedged or limited
  statement into a plain one.

**Stand-ins.** The story may replace real things by stand-ins: a model becomes a
character, a script a spell, a database a ledger. The draft then begins with a mapping
table:

| stand-in | stands for |
| --- | --- |
| the Scribe | the prompt writer (`DEF-po-prompt-writer`) |

- Each stand-in stands for one thing, and each thing has one stand-in, throughout.
- What a stand-in does or undergoes in a carrying sentence is what the forms say of the
  thing it stands for, and the sentence cites those forms.
- Framing sentences may give a stand-in looks, a voice and a mood. They may not give it
  acts or fortunes that would say something about the thing it stands for.
- A character or object that stands for nothing belongs to the framing and is not in the
  table.
- Rule 5 applies to the real terms. A stand-in may not be a string from an `avoid` list.

**Rules 2 and 6 hold as they are.** A scene is a passage. A limitation is stated once in
each scene that reports something it covers, an assumption is marked as one, and the
`CITATION NEEDED` marker stays.

Rule 8 matters most here, because a story pulls towards a tidy plot and a good ending. The
story must not put right what the forms leave wrong or unfinished:

- an `open` question stays unanswered;
- a `limitation` stays in force and is not overcome in the plot;
- a `refuted` form stays wrong;
- a `preliminary` claim or limitation stays uncertain;
- a weak or failed result is not turned into a success;
- the ending resolves nothing that the forms do not resolve.

Something in the forms that looks wrong or odd is likewise not corrected to suit the story
or the real world. All of this holds for the plot as a whole and not only for single
sentences, which is why check has a whole-text step for creative renderings (§7).

---

## 7. Check: rules for verifying text

Run check on the draft, as a separate pass in a fresh context. Give the model the draft
and the whole forms file, but not the reasoning that produced the draft: a model that
is shown the reasoning behind a draft will agree with the draft. Also tell it three things
about the draft: the targets it could report (§6), the mode it was requested in (§6.1) and
the date it was written. A creative draft comes with its mapping table, and check reads
every stand-in as the thing it stands for.

Check judges against the same rules that expand writes by (§6). In particular it uses the
status list of rule 2 to decide whether a register is too strong, and it never accepts a
`note` as support.

One row per sentence, and one row per table row and per caption (a table row is judged
as the sentences its cells make with the row label and the column headers):

| sentence | ids | form wording | verdicts | note |
|---|---|---|---|---|

The sentence is given in full. `form wording` holds the text of the cited fields that the
sentence states, copied from the forms. It is filled for every carrying sentence that is
not a word-for-word copy, so that you can read the two side by side. The verdict of a
model on a reworded sentence is a first opinion; the pair in front of you is the check.

| verdict | condition |
| --- | --- |
| `supported` | says what the cited forms say, within their scope, and no other verdict applies |
| `drifted` | the rewording changed the meaning (rule 9): a content word was replaced, a quantifier, negation, qualifier or tense changed, or a part of the form was left out whose absence changes what a reader takes away. A sentence that carries several forms is tested against each of them separately. Also a form with `wording: fixed` that was not copied word for word |
| `overclaimed` | true but stated beyond `scope`, or asserts something in `not_supported`, or uses a register stronger than `status` allows (§6 rule 2), including a `preliminary` claim whose scope is stated neither in the sentence nor earlier in the passage |
| `unsupported` | no form covers it, or only a `note` does. Also a relation that no field records (rule 10): look at every "so", "therefore", "because", "despite" and the like, at what "this" points to in "this suggests", and at an opening "So" before a step. And in creative mode a qualitative statement that no form makes in those terms |
| `contradicted` | a form says otherwise |
| `altered` | a number, path, version or name differs from the form: rounded, approximated, reformatted, converted or spelled out (rule 3) |
| `unhedged` | reports a result or claim that a limitation covers (§4.4), and the limitation is not stated in the passage at or before this sentence (rule 6). Given to the first such sentence of the passage only. In an abstract or summary of a text with a body, only a `major` limitation counts, provided the body states the others |
| `off-target` | reports a form outside the targets, where no target needs it (§6) |
| `stale` | a cited form's `updated` is later than the date the text was written |
| `unsourced` | states a form with status `unsourced`, or reports a claim that rests on one, directly or through other claims; flagged whether or not the marker is still there |
| `term` | calls the thing a def's `term` names by a string from that def's `avoid` list (§4.6); `retired` defs are ignored |
| `link` | marked `[link]`, and states or implies nothing that a form could support or contradict |
| `frame` | only if the text was requested with `Mode: creative` (§6.1): marked `[frame]`, and states or implies nothing that a form could support or contradict |

A sentence gets every verdict that applies, separated by commas: a sentence can be both
`altered` and `term`. `supported`, `link` and `frame` only ever stand alone.

**The test for a reworded sentence** has two halves. Does the form say everything the
sentence says? Does the sentence keep everything of the form that a reader needs in order
not to be misled? In strict mode both must hold. In creative mode only the first must
hold in full: the sentence may leave out numbers and detail, but it may not leave out a
hedge, a limit or a qualifier. To apply the test, check first writes down for itself what
the sentence asserts, clause by clause, and only then looks at the form.

In strict mode the `frame` verdict does not exist: a sentence marked `[frame]`, or any
unmarked sentence that no form backs, is `unsupported`. A sentence marked `[link]` or
`[frame]` that does state or imply something about what the forms describe gets the
verdicts it would get without the mark.

Judge sentence by sentence, never paragraph by paragraph. Overclaiming usually sits in a
single clause, and a verdict for a whole paragraph hides it.

A script can do part of this before the model does: every number in a carrying sentence
must occur in one of the forms it cites, and every cited id must exist. Run it first; it
is cheap and does not get tired.

Five checks are not per sentence. They come after the table.

**Limitations.** For every passage, list the limitations that cover (§4.4) a result or
claim the passage reports, and say for each where the passage states it. For an abstract
or summary, list the `minor` ones it leaves out and say where the body states each. A `major` one
that is missing, or that has no sentence of its own, is reported as
`missing major limitation: <id> in <passage>`.

**Assumptions.** List every assumption that a reported claim rests on, directly or through
other claims, and that does not have `surface: no`. Say for each whether the text states
it as an assumption. A missing one is reported as `missing assumption: <id>`.

**Repairs, in creative mode.** List every form that the text as a whole puts right
although the forms do not: an `open` shown as answered, a limitation shown as overcome, a
`refuted` form shown as true, a `preliminary` claim, or a weak or failed result, shown as a success.
Each is reported as `repaired: <id>`.

**Tables.** List every cell that no cited form fills, and every value that was computed
or carried over. Each is reported as `table: <table>, <row>, <column>`.

**Stand-ins, in creative mode.** List every stand-in that is used for two things, every
thing that has two stand-ins, and every stand-in that is missing from the mapping table.
Each is reported as `stand-in: <name>`.

A draft has passed check when every row is `supported`, `link` or `frame`, the five
checks after the table report nothing, and you have read the reworded pairs. A row with
any other verdict has to be dealt with first, `stale` and `unsourced` included: a stale
sentence is checked again against the changed form, and an unsourced one waits for its
source (§6). A sentence that was changed after a check is checked again.

---

## 8. Invariants

These can be checked mechanically by a script over the file, and a short script for them
is worth writing. The exception is invariant 10, which is about generated text and is
enforced by check (§7). Three things such a script needs to know:

- **Ids and other values.** In a field that holds references, a value is an id if it
  starts with one of the five prefixes (`P-`, `DEF-`, `ART-`, `SET-`, `SEC-`). Run labels,
  the entry `stated` in `evidence` and plain component values are not ids and must not
  start with a prefix.
- **Empty and absent are the same.** A field you do not use may be left out or left
  empty. An invariant about a field always means a non-empty field.
- **YAML details.** An unquoted `no` loads as `False` in some loaders and as `"no"` in
  others; treat both as no for `surface`. A section may have no `forms`.

1. Ids unique. Prefix is `P-` for the five assertable types, and `DEF-`, `ART-`, `SET-`
   or `SEC-` matching `type` for the rest.
2. Every referenced id exists. References are the ids in `evidence`, `derived_from`,
   `affects`, `resolved_by`, `replaced_by`, `answered_by`, `includes`, `part_of`,
   `follows`, `uses` and `links.to`,
   and every component value, or item of a component list, that is an id.
3. Every `claim` has a non-empty `derived_from`, unless its status is `unsourced` or
   `refuted`.
4. Every `result` has a non-empty `scope` and `evidence`; every `limitation` with status
   `established` or `resolved` has a non-empty `evidence`.
5. Every `artifact` that is not in a repository has a `version`. For a file in a
   repository it is optional (M5). A `planned` artifact has `version: planned` until it exists (§4.7), and
   no other artifact has that value. No `version` contains an unfilled placeholder.
6. Every `def` with a non-empty `avoid` has a `why_avoid`.
7. Every form other than a section is nested under exactly one section's `forms:` list,
   and no section is nested in another. (The file cannot express anything else, so a
   violation is a parser error, not a check.)
8. `links` with `rel: builds_on` form no cycle.
9. If a form's `updated` is newer than its section's, the section is stale.
10. Generated text follows the statuses as §6 rule 2 lays them out. A `refuted` or `closed`
    form is not asserted, and an `outdated` claim is never presented as holding for the
    current configuration. An `open` form, or a `planned` artifact or setup, appears only
    as a question or as future work. A `superseded` or `retired` artifact, setup or def is
    never
    presented as something the work currently uses; a `superseded` one may be named as
    what an earlier result was produced with. An `unsourced` form, and any claim
    that rests on one directly or through other claims, appears only with the marker,
    and never in a final text.
11. No `assumption` has a non-empty `derived_from`.
12. No `claim` exceeds the ceiling set by its weakest support:

    | weakest form in `derived_from` | ceiling for the claim |
    | --- | --- |
    | all `established` / `current` | `established` |
    | any `preliminary`, `assumed`, `unsourced`, `open` or `planned` | `preliminary` |
    | any `refuted`, `outdated`, `resolved`, `closed` or `superseded` | none; the claim must be revisited |

    A claim that is itself `refuted` or `outdated` has no ceiling: it keeps the
    `derived_from` it had.

13. Every key in a `setup`'s `components` appears in the file's `component_keys`, and
    every registry entry has a non-empty description. A registry entry whose key is in
    the standard list (§4.8) carries the standard description.
14. `follows` is acyclic. (`uses` may contain cycles.)
15. `severity`, where present, is `major` or `minor`, and appears only on a
    `limitation`.
16. Every `limitation` with status `resolved` has a non-empty `resolved_by`, and
    `resolved_by` is non-empty on no other form.
17. Every `assumption` has a non-empty `basis` and `breaks_if`.
18. Every `limitation` with status `established` or `preliminary` has a non-empty
    `affects`.
19. No `setup` with status `current` names a `superseded` form. In `includes` or a
    component value the remedy is a new setup (M4). In `part_of`, `follows` or `uses` it
    is editing the field in place.
20. Everything upstream is on record. *Upstream* of a setup are the setups it `follows`
    or `uses`. Upstream of an artifact are the *other* artifacts whose `produces` holds
    its `path`, or holds a path that appears in its `entrypoint`. An artifact is never
    upstream of itself, although its own command usually names its own output. Both are
    text matches, so write a path the same way everywhere. Superseded forms play a limited
    part: a `superseded` setup or artifact is never upstream of anything, and when the
    checks below decide whether a result needs something, they ignore the `superseded`
    forms it cites. A `superseded` form it cites still counts as providing what is
    needed. A pipeline setup counts as including what its `includes` names and, through
    any pipeline setup named there, what that one includes.
    - A `current` pipeline setup includes everything upstream of what it includes.
    - A `current` pipeline setup that includes an artifact also includes at least one
      current stage setup that names that artifact in `part_of`, if there is one.
    - If a `result` cites, in `evidence`, a setup or artifact that has something
      upstream, it also cites a pipeline setup that includes that setup or artifact.
    - If a `result` cites an artifact in `evidence`, and any stage setup names that
      artifact in `part_of`, the result also rests on at least one such setup, by citing
      it or through a pipeline setup. The setup may have any status: an older result
      rightly rests on a `superseded` one.

    These checks catch the usual omissions. They cannot prove that an `includes` list is
    complete: that it names everything that ran together remains your statement.
21. A `setup` fills exactly one of `components` and `includes`. Only a `planned` setup
    may have neither.
22. `replaced_by` is non-empty only on a form with status `refuted` or `outdated`, and `answered_by`
    only on an `open` with status `closed`.
23. `wording`, where present, is `fixed`, and appears only on a result, claim,
    assumption, limitation or open.

### 8.1 Standing queries

Three queries are worth running regularly. The three blocks below are one script: the
second and third use `forms` and `by_id` from the first, and the third also uses
`rests_on` from the second.

**Open citation gaps**, with the forms that depend on each, directly or through other
claims:

```python
import yaml
d = yaml.safe_load(open("forms.yaml"))
forms = [f for s in d["sections"] for f in (s.get("forms") or [])]
by_id = {f["id"]: f for f in forms}

def dependents(fid, seen=None):
    """Ids of all forms that rest on fid, directly or through other claims."""
    seen = set() if seen is None else seen
    for f in forms:
        if fid in (f.get("derived_from") or []) and f["id"] not in seen:
            seen.add(f["id"])
            dependents(f["id"], seen)
    return seen

for g in [f for f in forms if f.get("status") == "unsourced"]:
    print(g["id"], "—", g["statement"])
    print("   at risk:", ", ".join(sorted(dependents(g["id"]))) or "nothing")
```

Run it before any submission. The "at risk" line shows which gaps matter: a gap that
nothing depends on can stay unsourced and be cut, and a gap that three claims depend on
cannot.

**Claims older than anything they rest on** (M3), directly or through results and
setups. `rests_on` follows exactly the links in the table of §4.4, by type, and
`upstream` follows them through any number of steps. Dates are compared as text, so it
does not matter whether an `updated` is quoted in the file. The query does not see a
change made on the same date as the claim's `updated`, because a date has no time of day.
If you change something under a claim on the day you revisited it, revisit it again by
hand. Claims that are `refuted` or `outdated` are skipped.

```python
PREFIXES = ("P-", "DEF-", "ART-", "SET-", "SEC-")

def rests_on(f):
    if f["type"] == "claim":
        values = f.get("derived_from") or []
    elif f["type"] == "result":
        values = f.get("evidence") or []
    elif f["type"] == "setup":
        values = list(f.get("includes") or [])
        for v in (f.get("components") or {}).values():
            values += v if isinstance(v, list) else [v]
    else:
        values = []
    return {v for v in values if isinstance(v, str) and v.startswith(PREFIXES)}

def upstream(fid):
    """Ids of every form fid rests on, through any number of steps."""
    seen, todo = set(), [fid]
    while todo:
        for u in rests_on(by_id[todo.pop()]):
            if u in by_id and u not in seen:
                seen.add(u)
                todo.append(u)
    return seen

live = [f for f in forms
        if f["type"] == "claim" and f["status"] not in ("refuted", "outdated")]
for f in live:
    for u in sorted(upstream(f["id"])):
        if str(by_id[u]["updated"]) > str(f["updated"]):
            print(f["id"], "is older than", u, "— revisit")
```

**What each limitation covers** (§4.4). Run it after adding a limitation, to see that it
reaches what you meant and no more. It uses `rests_on` from the block above:

```python
def covered(lim):
    seen = set(lim.get("affects") or [])
    grew = True
    while grew:
        grew = False
        for f in forms:
            if f["id"] not in seen and rests_on(f) & seen:
                seen.add(f["id"])
                grew = True
    return seen

for lim in [f for f in forms if f["type"] == "limitation" and f["status"] != "refuted"]:
    hedged = sorted(i for i in covered(lim) if by_id[i]["type"] in ("result", "claim"))
    print(lim["id"], "covers:", ", ".join(hedged) or "nothing")
```

---

## 9. Minimal worked example

```yaml
spec: v1
component_keys:
  data: "the input the stage runs over (documents, records or rows), with its selection and ordering"
  method: "the decision rule or algorithm the stage applies, including how items are matched"
  scoring: "how one output is compared against the gold standard"
  metric: "the summary numbers computed from the scored outputs"

sections:

  # ══════════════════════════════════════════════════════════════
  # SEC-pdf-defs — Extracting definitions from PDFs
  # ══════════════════════════════════════════════════════════════
  - id: SEC-pdf-defs
    type: section
    title: "Extracting definitions from PDFs"
    about: "Everything about pulling definitional statements out of PDF sources."
    links:
      - {to: SEC-eval, rel: builds_on, why: "P-gold-precision is scored with the setup defined there"}
    status: drafting
    updated: 2026-09-17
    forms:

      - id: DEF-definition-candidate
        type: def
        term: "definition candidate"
        definition: "A sentence flagged by the extractor as possibly defining a term."
        use: ["definition candidate", "candidate"]
        avoid: ["definition", "extracted definition"]
        why_avoid: "Candidates are unverified; the bare noun implies they were checked."
        status: established
        updated: 2026-09-10

      - id: ART-corpus
        type: artifact
        path: "pdf-defs/corpus/"
        version: "forms-2026-09-12"
        status: current
        updated: 2026-09-12

      - id: ART-extractor
        type: artifact
        path: "pdf-defs/extract/pdf_defs.py"
        version: "forms-2026-09-12"
        entrypoint: "python pdf-defs/extract/pdf_defs.py --in pdf-defs/corpus/ --out pdf-defs/out/candidates.jsonl"
        produces: ["pdf-defs/out/candidates.jsonl"]
        status: current
        updated: 2026-09-12

      - id: SET-extract-v1
        type: setup
        part_of: [ART-extractor]
        script: "pdf-defs/extract/pdf_defs.py"
        components:
          data: ART-corpus
          method: "flag a sentence in which a term is followed by 'is defined as', 'refers to' or 'means'"
        status: current
        updated: 2026-09-12

      - id: P-candidate-yield
        type: result
        statement: "The extractor produced 612 definition candidates from 80 PDFs."
        scope: "Born-digital PDFs only; no scanned documents."
        evidence: [ART-extractor, ART-corpus, SET-extract-v1, run-2026-09-12]
        not_supported: "Says nothing about how many candidates are genuine definitions."
        status: established
        updated: 2026-09-12

      - id: P-yield-single-column
        type: result
        statement: "The extractor produced 498 definition candidates from the 56 single-column PDFs."
        scope: "Born-digital PDFs only; layout labelled by hand."
        evidence: [ART-extractor, ART-corpus, SET-extract-v1, run-2026-09-12]
        not_supported: "Says nothing about how many candidates are genuine definitions."
        status: established
        updated: 2026-09-12

      - id: P-yield-two-column
        type: result
        statement: "The extractor produced 114 definition candidates from the 24 two-column PDFs."
        scope: "Born-digital PDFs only; layout labelled by hand."
        evidence: [ART-extractor, ART-corpus, SET-extract-v1, run-2026-09-12]
        not_supported: "Does not show that the two-column layout causes the lower count."
        status: established
        updated: 2026-09-12

      - id: P-layout-sensitivity
        type: claim
        statement: >
          The extractor produced fewer definition candidates per PDF from the two-column
          PDFs than from the single-column PDFs.
        derived_from: [P-yield-single-column, P-yield-two-column]
        not_supported: "Does not say that the layout is the cause."
        status: established
        updated: 2026-09-12

      - id: P-gold-precision
        type: result
        statement: >
          41 of the 54 gold-set sentences that the extractor flagged as definition
          candidates were labelled as definitions.
        scope: "The 120 sentences of the gold set, taken from 12 born-digital PDFs."
        evidence: [SET-eval-pipeline-v1, run-2026-09-12]
        not_supported: "Says nothing about candidates outside the gold set."
        status: established
        updated: 2026-09-12

      - id: P-corpus-representative
        type: assumption
        statement: "The 80 PDFs reflect the layout variety of the target literature."
        basis: >
          The PDFs were hand-picked to cover the layouts seen in the target literature.
          Not tested here: surveying the layouts of the whole literature is outside the
          scope of this work.
        breaks_if: "The target corpus is mostly scanned."
        status: assumed
        updated: 2026-09-05

      - id: P-scanned-pdfs
        type: open
        statement: "Whether OCR output can be fed to the same extractor without changes."
        status: open
        updated: 2026-09-12

  # ══════════════════════════════════════════════════════════════
  # SEC-eval — Evaluation setup
  # ══════════════════════════════════════════════════════════════
  - id: SEC-eval
    type: section
    title: "Evaluation setup"
    about: "How extraction output is scored: gold set, metrics, configurations."
    links: []
    status: drafting
    updated: 2026-09-17
    forms:

      - id: ART-gold-set
        type: artifact
        path: "pdf-defs/eval/gold.jsonl"
        version: "forms-2026-09-12"
        status: current
        updated: 2026-09-12

      - id: P-gold-set-size
        type: result
        statement: "The gold set contained 120 hand-labelled sentences from 12 PDFs."
        scope: "All sentences in the gold set."
        evidence: [ART-gold-set]
        status: established
        updated: 2026-09-17

      - id: ART-scorer
        type: artifact
        path: "pdf-defs/eval/score.py"
        version: "forms-2026-09-12"
        entrypoint: "python pdf-defs/eval/score.py --pred pdf-defs/out/candidates.jsonl --gold pdf-defs/eval/gold.jsonl"
        produces: ["pdf-defs/out/scores.json"]
        status: current
        updated: 2026-09-12

      - id: SET-scoring-v1
        type: setup
        part_of: [ART-scorer]
        script: "pdf-defs/eval/score.py"
        follows: [SET-extract-v1]
        components:
          data: ART-gold-set
          scoring: "a flagged sentence counts as correct if its gold label is definition"
          metric: "precision"
        status: current
        updated: 2026-09-12

      - id: SET-eval-pipeline-v1
        type: setup
        includes: [ART-corpus, ART-extractor, SET-extract-v1, ART-gold-set, ART-scorer, SET-scoring-v1]
        status: current
        updated: 2026-09-12

      - id: P-single-annotator
        type: limitation
        statement: "The gold set was labelled by a single annotator."
        affects: [SET-scoring-v1]
        evidence: [stated]
        status: established
        updated: 2026-09-08
```

The claim is `established` because both results under it are, and the step from them is
arithmetic (498 from 56 PDFs against 114 from 24). "The two-column layout lowers the
count" would be a second claim, and `preliminary`, because it names a cause. In
`P-gold-precision`, the 54 flagged sentences are still called definition candidates, and
"definitions" names only the hand labels in the gold set. That use is allowed, because an
`avoid` string is forbidden only as a name for the thing the term names (§4.6).

The scorer reads the extractor's output, so `SET-scoring-v1` follows `SET-extract-v1`,
and `P-gold-precision` came out of more than one step and cites the pipeline setup
`SET-eval-pipeline-v1`. The yield results cite the extractor, the corpus and the
extractor's stage setup `SET-extract-v1` directly, because nothing ran before the
extractor. The extractor has a stage setup because its flagging rule is a choice you
might change and four results rest on it, three directly and one through the pipeline
setup (§4.8).

`P-single-annotator` names the scoring setup. It therefore covers `P-gold-precision`,
whose pipeline setup includes that setup, although the two are filed in different
sections. Had it named `ART-gold-set`, it would also cover `P-gold-set-size`, which a
second annotator would not change.

Expanding this may produce: *From the 80 born-digital PDFs, the extractor produced 612
definition candidates [P-candidate-yield].* The order changed and the scope moved into
the sentence, but the verb, the number and the term are the form's own (rule 9). It may
also merge two forms: *It produced 498 definition candidates from the 56 single-column
PDFs and 114 from the 24 two-column PDFs [P-yield-single-column, P-yield-two-column].*
It may not produce *the extractor found around 600 definitions*: the verb is replaced
(rule 9), the number is rounded (rule 3), the term is wrong
(`DEF-definition-candidate`), and the sentence goes beyond `not_supported`. Nor may it
write *because of the two-column layout, the extractor produced fewer candidates*: no
form records that relation (rule 10).

---

## 10. Prompt templates

The prompts live in separate files in the `prompts/` folder of this repository, so they
can be given to a model as they are. Each file is the whole prompt. Fill in the lines
with angle brackets before you use it.

| file | step | mode |
| --- | --- | --- |
| `prompts/plan.txt` | Plan (§6) | strict |
| `prompts/expand.txt` | Expand (§6), given the approved plan | strict |
| `prompts/plan-creative.txt` | Plan (§6, §6.1) | creative |
| `prompts/expand-creative.txt` | Expand (§6, §6.1), given the approved plan | creative |
| `prompts/check.txt` | Check (§7), in a fresh context | either; the prompt names the mode |

The model is given the forms file and the prompt, and not this specification. The
prompts therefore carry the rules they need from §4.4, §6, §6.1, §7 and §8.

Both plan prompts define what a limitation covers (§4.4) and which limitations an
abstract must state (§6 rule 6). The creative files differ from the strict ones in that
both say `Mode: creative`. The creative Plan prompt also says what a creative rendering
reports and what it must not put right (§6.1). The creative Expand prompt has the block
on creative renderings where the strict one has the paragraph that starts "In strict
mode".

The Expand prompt produces the draft. The final text is made from a checked draft, as
described at the start of §6.

The prompts repeat rules from §6 and §7. A change to those sections has to be made in the
prompt files as well.
