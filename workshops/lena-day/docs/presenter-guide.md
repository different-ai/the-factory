# A day with Lena

Private R&S presenter guide · OpenWork alongside existing tools · 75 minutes

*An account manager preparing a customer meeting and account review, while normal work keeps happening.*

## Contents

- [Welcome and agenda](#welcome)
- [08:45 Start the day from one brief](#morning)
- [09:30 A customer asks for a one-pager](#onepager)
- [09:50 Save the useful work for next week](#reuse)
- [10:00 A colleague runs it herself](#share)
- [11:00 Prepare the quarterly account review](#account)
- [11:40 Turn the brief into a review deck](#slides)
- [13:30 Turn the follow-up into a ticket](#jira)
- [13:45 Locked out, without losing the afternoon](#it)
- [14:30 Know when the honest answer is “not found”](#trust)
- [15:00 Tell the team what didn’t help](#feedback)
- [16:00 Role example 1: arrange the follow-up meeting](#calendar)
- [16:00 Role example 2: update guidance and close the loop](#followup)
- [Your two recurring tasks](#own-task)
- [Wrap](#wrap)
- [Presenter-only status](#status)
- [Optional appendix](#accessibility)
- [Screenshot sources](#sources)

<a id="welcome"></a>
## Welcome and agenda

**Say this**

> This is a day with Lena, an account manager preparing a customer meeting and an account review, while normal work keeps happening. Watch where she works: she asks in OpenWork, reviews the answer there, then glances at Outlook, OneDrive, Jira or Confluence to confirm the result landed where it belongs. OpenWork works alongside the tools you already use; it does not replace them. At every stop, ask: what did she hand off, and what did she still check? By the end, bring two recurring tasks from your own day.

Private R&S workshop copy. Acme Robotics, Atlas 2 / Atlas Lift, Northwind Logistics, Blue Harbor Foods, Nora Patel, Priya Shah and Alex Chen are fictional stand-ins, not real customer or prospect data. Lena is the workshop persona; the screens are signed in as Alex Chen, or as Nora in the recipient beat. This guide is a static walkthrough of recorded screens. Nothing in it runs prompts, sends mail, shares, schedules or resets anything.

**Core flow vs optional hands-on:** Core flow: 12 recorded beats, each in the rhythm need → ask OpenWork → review in OpenWork → confirm in the existing tool → back to OpenWork. The left column is your script; the right column shows the matching real screens, with OpenWork first. Click any screenshot to view it at full resolution, and click again to collapse it. Prompts are copyable reference text, adapted from the recorded scene prompts for presenting. Optional hands-on happens only in a separately approved sandbox; every exercise also works on paper. Do not use localhost links seen in the screenshots: the rehearsal environment no longer exists.

| Elapsed | Segment | Min | Focus |
|---|---|---:|---|
| 00–05 | Welcome | 5 | Meet Lena; OpenWork as the home surface; review-before-send. |
| 05–10 | Digest | 5 | T10 |
| 10–30 | Brochure / reuse / share | 20 | T01 8 · T02 7 · T03 5 |
| 30–40 | Account review | 10 | T04 |
| 40–45 | Slides | 5 | T05, with a review gate |
| 45–52 | Jira + IT | 7 | T06 3 · T07 4 |
| 52–57 | Trust | 5 | T09 3 · T08 2 |
| 57–62 | Role / calendar / follow-up | 5 | T11 · T12 |
| 62–70 | Own-task exercise | 8 | Two recurring tasks; one bounded prompt |
| 70–75 | Wrap | 5 | Time saved · what was wrong · sources · outcome to verify |

---

<a id="morning"></a>
## 08:45 — Start the day from one brief (T10)

*05–10 min · Digest · 5 min*

**Business need:** Lena needs a quick read on overnight news before customer work starts, without opening a dozen sites.

**Say this**

> Meet Lena, an account manager. Today she is preparing a customer meeting and an account review, while normal work keeps happening. Her day starts in OpenWork, not in a pile of tabs. Yesterday she asked OpenWork to prepare a morning brief, and in this rehearsal we demonstrate a scheduled morning briefing: OpenWork registered the job, then the saved brief and an unsent email draft landed in the tools she already uses.

**Do this: OpenWork → existing tool → back**

1. **OpenWork.** Show the T10 session. Point to the request, then to “Registered and verified job-1, an isolated simulated schedule—not a production Automation”, and the daily 09:00 America/Los_Angeles line.
2. **Switch to OneDrive.** Show the “Morning news” folder and the saved “2026-10-16-morning-news.md”. Read one title, outlet, country and summary. Links stay with each item so Lena can check the source.
3. **Back to OpenWork.** “The brief is where Lena keeps her files. Now the first real interruption arrives in her inbox.”

**Prompt for OpenWork** (copyable; adapted from the recorded scene)

```text
Every weekday at 09:00 America/Los_Angeles, prepare a morning digest of yesterday’s news for France, the United States, Germany and Japan. For each item, include the title, a short summary, outlet, country and source link. Save it to OneDrive › Morning news and create an unsent Outlook draft for me to review. In this fictional rehearsal, label the schedule as simulated, not a production Automation. Do not send anything.
```

**Expect this:** A checkable digest in OneDrive and a draft Lena still controls. The schedule is shown as a rehearsal setup, not unattended automation in a real tenant.

**Participants try:** 30 seconds in pairs: which three fields would make a morning brief useful in your role? Keep at least one field that helps you verify the source.

> **Facilitator note: limits and missing views.** Simulated clock with an operator-triggered run; NOT a production Automation, and nothing ran unattended in a real tenant. The OpenWork frame was captured when the job was registered (08:55 simulated), before it ran. The news is fictional fixture content. Missing views: OpenWork after the scheduled run, and the unsent Outlook draft.

**Screens**

![OpenWork session: Lena’s request, the created and listed schedule, and “isolated simulated schedule—not a production Automation”. Captured at registration, before the 09:00 run.](screenshots/run-01-t10-09-00-news-digest.png)

*OpenWork · Same-run proof capture:* OpenWork session: Lena’s request, the created and listed schedule, and “isolated simulated schedule—not a production Automation”. Captured at registration, before the 09:00 run.

![OneDrive: the saved morning-news digest. The preview says it is fictional and simulated. The Outlook draft is not shown.](screenshots/workshop-t10-final.png)

*Existing tool · Named Docshot:* OneDrive: the saved morning-news digest. The preview says it is fictional and simulated. The Outlook draft is not shown.

[Previous](#welcome) · [Contents](#welcome) · [Next](#onepager)

---

<a id="onepager"></a>
## 09:30 — A customer asks for a one-pager (T01)

*10–18 min · Brochure / reuse / share · 8 of 20 min*

**Business need:** Blue Harbor Foods is evaluating pallet-moving robots. Nora forwarded their safety-review note, and Lena needs a sourced Atlas 2 vs Atlas Lift comparison and a reply before the meeting.

**Say this**

> The brief is read. Now Nora, a colleague, has forwarded a Blue Harbor safety-review thread. Lena does not start from a blank document or six open tabs. She asks OpenWork to read the thread and both product datasheets, then save a comparison and draft a reply. Watch what OpenWork keeps separate: a verified product fact, like payload, versus a customer condition no datasheet can approve.

**Do this: OpenWork → existing tool → back**

1. **OpenWork.** Show the T01 session. Read OpenWork’s summary: the latest customer-related message is Nora’s internal Blue Harbor reply; Atlas Lift matches the 1,200 kg requirement and Atlas 2 does not; site approvals stay separate. Point to the file-write and file-read steps.
2. **Switch to OneDrive.** Open “Atlas-Blue-Harbor-comparison.md”: the saved one-pager, with its recommendation and the sources it used.
3. **Switch to Outlook.** Show the unsent reply in the same thread: OneDrive link, a payload row with Atlas 2 at 300 kg and Atlas Lift at 1,200 kg, and the safety gates that are still open.
4. **Back to OpenWork.** “That worked once. Lena knows this question will come back next week, so she makes it reusable.”

**Prompt for OpenWork** (copyable; adapted from the recorded scene)

```text
Read the latest Outlook message about Blue Harbor Foods (it may be a colleague forwarding the customer’s request). Read the full Confluence datasheets for Atlas 2 and Atlas Lift. Compare both products against every requirement in that message, with a small table covering payload, top speed and runtime, and cite the pages. Keep verified product facts separate from unconfirmed customer safety and site requirements. Save the comparison to OneDrive and draft an unsent reply in the same thread linking to it.
```

**Expect this:** A sourced one-page comparison in OneDrive and a reply draft in the original thread. Nothing is sent; customer safety and site approvals stay visibly open.

**Participants try:** 45 seconds: find one sentence in the reply that could overpromise. Rewrite it so a product fact and an unconfirmed customer condition stay separate.

> **Facilitator note: limits and missing views.** The OpenWork frame is mid-response; its final verification sentence is just below the visible area. The latest message is an internal staff email about the customer, not one written by the customer. “One-pager” describes the business goal; the saved file is Markdown, not a designed one-page layout. Missing view: the Confluence datasheet pages themselves.

**Screens**

![OpenWork session: OpenWork identified Nora’s internal Blue Harbor message, compared payloads, kept approvals separate, and saved and read back the file.](screenshots/run-06-t01-grounded-customer-comparison.png)

*OpenWork · Same-run proof capture:* OpenWork session: OpenWork identified Nora’s internal Blue Harbor message, compared payloads, kept approvals separate, and saved and read back the file.

![OneDrive: the saved “Atlas-Blue-Harbor-comparison.md” one-pager with recommendation and sources.](screenshots/run-07-t01-grounded-customer-comparison.png)

*Existing tool · Same-run proof capture:* OneDrive: the saved “Atlas-Blue-Harbor-comparison.md” one-pager with recommendation and sources.

![Outlook: unsent threaded reply with the OneDrive link, the payload, speed and runtime table, and open safety gates.](screenshots/workshop-t01-final.png)

*Existing tool · Named Docshot:* Outlook: unsent threaded reply with the OneDrive link, the payload, speed and runtime table, and open safety gates.

[Previous](#morning) · [Contents](#welcome) · [Next](#reuse)

---

<a id="reuse"></a>
## 09:50 — Save the useful work for next week (T02)

*18–25 min · Brochure / reuse / share · 7 of 20 min*

**Business need:** The same comparison will be asked again with different customer use cases. Lena wants one reliable recipe, not a fresh chat each time.

**Say this**

> Lena has seen this request three times this quarter. So she asks OpenWork to turn the comparison into a saved Workflow: same source checks, different customer request. She tests it with warehouse picking, then reruns it for cold-storage pallet moves. Even though the request names only Atlas Lift, the Workflow still assesses both products. That makes the result trustworthy, not just convenient.

**Do this: OpenWork → existing tool → back**

1. **OpenWork session.** Show the T02 request and the start of OpenWork’s answer: it found both full datasheets before building the Workflow.
2. **OpenWork Library.** Open “Acme product comparison” in My Library. Point to the latest result: “Compare Atlas Lift for cold-storage pallet moves”. The warehouse-picking text above it is only the input form; it is not the latest run.
3. **OpenWork Library.** Scroll to the products. Atlas 2 is 300 kg and not a documented match; Atlas Lift is 1,200 kg and a documented match, with site requirements still unconfirmed. Each has a page citation. Do not press “Run workflow” in the static guide.
4. **Back to the story.** “Now a colleague needs the same thing for her own customer.”

**Prompt for OpenWork** (copyable; adapted from the recorded scene)

```text
Turn this customer comparison into a saved Workflow called “Acme product comparison” with one input, customerRequest. Each run should read both full Atlas datasheets and assess BOTH Atlas 2 and Atlas Lift, even if the request names one product. Include payload with a citation, whether the use case is documented and which site requirements remain unconfirmed. Test it with “Compare Atlas 2 and Atlas Lift for warehouse picking”, save it, then rerun the saved version with “Compare Atlas Lift for cold-storage pallet moves”.
```

**Expect this:** A reusable Workflow in OpenWork Library. The latest saved result answers the cold-storage request and still covers both products.

**Participants try:** 45 seconds: write one new customerRequest for your own context. Name one check that must stay the same on every run.

> **Facilitator note: limits and missing views.** All three frames are OpenWork. The session frame shows the start of the answer, not the full transcript. Product facts come from the source datasheets: Atlas 2 payload is 300 kg and Atlas Lift payload is 1,200 kg. The scoped technical report, not these images alone, verifies the saved-version execution.

**Screens**

![OpenWork session: the Workflow request and the start of OpenWork’s answer after it read both full datasheets.](screenshots/run-12-t02-save-and-rerun-a-native-workflow.png)

*OpenWork · Same-run proof capture:* OpenWork session: the Workflow request and the start of OpenWork’s answer after it read both full datasheets.

![OpenWork Library: “Acme product comparison” Workflow, Ready; latest saved result is the cold-storage request.](screenshots/workshop-t02-context.png)

*OpenWork · Named Docshot:* OpenWork Library: “Acme product comparison” Workflow, Ready; latest saved result is the cold-storage request.

![OpenWork Library: cold-storage result covering both products, with payloads, citations and use-case fit.](screenshots/workshop-t02-final.png)

*OpenWork · Named Docshot:* OpenWork Library: cold-storage result covering both products, with payloads, citations and use-case fit.

[Previous](#onepager) · [Contents](#welcome) · [Next](#share)

---

<a id="share"></a>
## 10:00 — A colleague runs it herself (T03)

*25–30 min · Brochure / reuse / share · 5 of 20 min*

**Business need:** Nora has a line-side replenishment question. She should not have to wait for Lena to run the comparison for her.

**Say this**

> Nora asks whether the comparison works for line-side replenishment. Instead of doing it for her, Lena shares the Workflow from OpenWork as view-and-run access. Then the story switches to Nora’s own OpenWork. She runs it under her own identity, and the answer changes: for this use case, Atlas 2 is the documented match. Same recipe, same sources, different customer question.

**Do this: OpenWork → existing tool → back**

1. **Lena’s OpenWork.** Show the T03 owner session: OpenWork confirmed Nora is a member, not an owner, and granted viewer access without substituting a run as Alex.
2. **Nora’s OpenWork.** Switch to the session signed in as Nora Patel. Read the table: Atlas 2 is 300 kg and a documented match; Atlas Lift is 1,200 kg and not a documented match. Point to “viewer, canRun: true, canManage: false” and “no identity was switched”.
3. **OpenWork Library as Nora.** Show the Member view of the Workflow, with the latest line-side result and both products assessed.
4. **Back to Lena.** “Sharing is scoped through the containing Plugin, so check what else that Plugin exposes before sharing widely. Now on to the account review.”

**Prompt for OpenWork** (copyable; adapted from the recorded scene)

```text
Share the “Acme product comparison” Workflow with Nora Patel (nora@acme.test) so she can view and run it, but not manage it. Make the sharing scope clear before granting access. Then, as Nora, run the saved Workflow with “Compare Atlas 2 for line-side replenishment”, and confirm that Nora—not Lena—ran it.
```

**Expect this:** Nora reuses the comparison herself. The access boundary is clear: she can run it but cannot manage it.

**Participants try:** 30 seconds: name one thing a viewer should be able to do and one thing that should still require an owner.

> **Facilitator note: limits and missing views.** Nora’s frame shows visible run IDs from the disposable rehearsal; these are not secrets or reusable links. Access goes through the containing Plugin, so do not claim it is permanently limited to one Workflow. Viewers can run manually but cannot schedule. The technical report verified that an outsider was denied.

**Screens**

![Nora’s OpenWork session: her line-side result covers both products. Atlas 2 is the documented match, and her viewer rights are verified.](screenshots/run-20-t03-recipient-execution-of-a-shared-workflow.png)

*OpenWork · Same-run proof capture:* Nora’s OpenWork session: her line-side result covers both products. Atlas 2 is the documented match, and her viewer rights are verified.

![Lena’s OpenWork session: OpenWork confirmed Nora is a member, granted viewer access, and did not run it as Alex.](screenshots/run-21-t03-recipient-execution-of-a-shared-workflow.png)

*OpenWork · Same-run proof capture:* Lena’s OpenWork session: OpenWork confirmed Nora is a member, granted viewer access, and did not run it as Alex.

![OpenWork Library, Member view: latest result is the line-side request, recommending Atlas 2.](screenshots/workshop-t03-context.png)

*OpenWork · Named Docshot:* OpenWork Library, Member view: latest result is the line-side request, recommending Atlas 2.

![OpenWork Library, Member view: line-side comparison with both products, payloads and citations.](screenshots/workshop-t03-final.png)

*OpenWork · Named Docshot:* OpenWork Library, Member view: line-side comparison with both products, payloads and citations.

[Previous](#reuse) · [Contents](#welcome) · [Next](#account)

---

<a id="account"></a>
## 11:00 — Prepare the quarterly account review (T04)

*30–40 min · Account review · 10 min*

**Business need:** Before the review, Lena has to decide which of two accounts needs attention: Northwind Logistics or Blue Harbor Foods.

**Say this**

> Back to Lena’s main job. Blue Harbor is one of two accounts in tomorrow’s review. She asks OpenWork to read both account plans and compare them. The useful part is precision: Blue Harbor has higher recurring revenue, but Northwind has more recent orders and lower churn risk. OpenWork keeps ARR and order revenue separate, and saves a report she can check.

**Do this: OpenWork → existing tool → back**

1. **OpenWork.** Show the T04 session and read OpenWork’s summary: Blue Harbor ARR is $1.46M vs Northwind’s $1.10M; Northwind has 4 orders worth $1.38M vs Blue Harbor’s 2 orders worth $0.41M; relationship strength and churn risk come from the plans. Point to the saved file link.
2. **Switch to OneDrive.** Open “Acme account analysis.md”: scope and sources, then the executive comparison. The screenshot shows only the top of the report.
3. **Back to OpenWork.** Ask the room: “Which figure would change your priority, and which source would you verify first?” Then: “Lena needs this as slides.”

**Prompt for OpenWork** (copyable; adapted from the recorded scene)

```text
Read the full Confluence account plans for Northwind Logistics and Blue Harbor Foods. Compare annual recurring revenue, number and value of orders in the last 12 months, relationship strength, growth potential and churn risk. Keep exact figures, and do not mix ARR with order revenue. Cite both plans, and separate what the plans say from your assessment. Save “Acme account analysis.md” in OneDrive and read it back.
```

**Expect this:** A sourced account brief for prioritizing the review, not a forecast and not a live health check of a real account.

**Participants try:** 60 seconds: choose one comparison dimension and write the evidence you would need before recommending an action. Do not invent missing numbers.

> **Facilitator note: limits and missing views.** The figures come from fictional account plans. The OneDrive preview is partial. Missing view: the Confluence account-plan pages.

**Screens**

![OpenWork session: the account comparison with ARR kept separate from order value, and the saved report link.](screenshots/run-29-t04-account-intelligence.png)

*OpenWork · Same-run proof capture:* OpenWork session: the account comparison with ARR kept separate from order value, and the saved report link.

![OneDrive: partial preview of the saved “Acme account analysis.md” report.](screenshots/workshop-t04-final.png)

*Existing tool · Named Docshot:* OneDrive: partial preview of the saved “Acme account analysis.md” report.

[Previous](#share) · [Contents](#welcome) · [Next](#slides)

---

<a id="slides"></a>
## 11:40 — Turn the brief into a review deck (T05)

*40–45 min · Slides · 5 min*

**Business need:** The review meeting needs slides, built from the report she just checked, not a fresh guess.

**Say this**

> Lena asks OpenWork to turn the checked report into a PowerPoint. The result is a real file in OneDrive, not a slide outline. But here we stop at a review gate. A file existing is not the same as presentation-ready slides. Two of the fourteen slides contain only a heading and footer, and nobody has checked the visual layout in Office yet.

**Do this: OpenWork → existing tool → back**

1. **OpenWork.** Show the T05 request: it builds the deck from the saved report and both original account plans. Say plainly: “This screenshot shows the request; the completion message was not captured.”
2. **Switch to OneDrive.** Show “Acme account analysis.pptx” in OneDrive. Read the preview labels aloud: “Extracted Office text (not an Office editor)” and “Read-only preview”.
3. **Back to OpenWork.** “Next step for Lena: open it in PowerPoint and fix slides 10 and 14 before anyone sees it.” Do not call the deck customer-ready.

**Prompt for OpenWork** (copyable; adapted from the recorded scene)

```text
Using “Acme account analysis.md” and both original Confluence account plans, create a real PowerPoint file, “Acme account analysis.pptx”, in OneDrive. Keep the exact ARR, order counts and values, relationship, growth, churn and citations. Make sure every slide has substantive content, and tell me which slides need a visual check in PowerPoint before I present.
```

**Expect this:** An actual deck file ready for Lena’s review. It still needs a visual check before it is presentation-ready.

**Participants try:** 30 seconds: list two checks you would do in PowerPoint before presenting: one about content and one about layout.

> **Facilitator note: limits and missing views.** FACILITATOR REVIEW NEEDED. The deck’s bytes and content passed an independent check; Office rendering, typography and overflow were not checked. Slides 10 and 14 have only a heading and footer, so polish was not approved. Full Office editing was not demonstrated. Missing views: OpenWork’s completion message and slides rendered in PowerPoint.

**Screens**

![OpenWork session: Lena’s deck request. The completion message was not captured.](screenshots/run-34-t05-generate-a-real-account-analysis-powerpoint.png)

*OpenWork · Same-run proof capture:* OpenWork session: Lena’s deck request. The completion message was not captured.

![OneDrive: the actual 14-slide PPTX shown as an extracted-text, read-only preview, not rendered slides.](screenshots/workshop-t05-final.png)

*Existing tool · Named Docshot:* OneDrive: the actual 14-slide PPTX shown as an extracted-text, read-only preview, not rendered slides.

[Previous](#account) · [Contents](#welcome) · [Next](#jira)

---

<a id="jira"></a>
## 13:30 — Turn the follow-up into a ticket (T06)

*45–48 min · Jira + IT · 3 of 7 min*

**Business need:** Prepping the review exposed outdated documentation. Lena needs that to become someone’s task, not a note she forgets.

**Say this**

> Preparing the review exposed something ordinary: the Project XYZ documentation is out of date. Lena does not leave Jira as a separate chore. She asks OpenWork to create the task and assign it to Nora. OpenWork confirms the right person, creates it and reads it back. Then Lena takes a quick look in Jira.

**Do this: OpenWork → existing tool → back**

1. **OpenWork.** Show the T06 session: “Created and verified DOC-45”, the DOC project, Task type, exact summary and Nora Patel as assignee.
2. **Switch to Jira.** Show DOC-45 with Nora Patel as Assignee. The description is still empty; do not imply the documentation itself has been updated.
3. **Back to OpenWork.** “Ten minutes later, normal work interrupts again.”

**Prompt for OpenWork** (copyable; adapted from the recorded scene)

```text
Create a Jira task in the DOC project titled “Update documentation for Project XYZ” and assign it to Nora Patel. Look up the right person instead of guessing, then read the ticket back and confirm the key, project, type and assignee.
```

**Expect this:** An owned follow-up in Jira. The task is assigned, not completed.

**Participants try:** 30 seconds: write one acceptance criterion for Nora as a single “done when…” sentence.

> **Facilitator note: limits and missing views.** The accessibility before/after screenshots are only in the optional appendix; do not use them during the story.

**Screens**

![OpenWork session: DOC-45 created and verified, with project, type, summary and assignee Nora Patel.](screenshots/run-39-t06-assigned-documentation-ticket.png)

*OpenWork · Same-run proof capture:* OpenWork session: DOC-45 created and verified, with project, type, summary and assignee Nora Patel.

![Jira: DOC-45 assigned to Nora Patel. The description is empty and the work is not done.](screenshots/workshop-t06-final.png)

*Existing tool · Named Docshot:* Jira: DOC-45 assigned to Nora Patel. The description is empty and the work is not done.

[Previous](#slides) · [Contents](#welcome) · [Next](#it)

---

<a id="it"></a>
## 13:45 — Locked out, without losing the afternoon (T07)

*48–52 min · Jira + IT · 4 of 7 min*

**Business need:** Lena is locked out of Windows. She needs the correct IT request, with the required field, filed quickly.

**Say this**

> Normal work does not pause for customer prep. Lena is locked out of Windows. From OpenWork, which she can still reach, she asks for help. OpenWork reads the internal IT guidance, finds the required “Windows login” Application option and files the request. It does not reset the password. It routes the request correctly, and that is the honest win.

**Do this: OpenWork → existing tool → back**

1. **OpenWork.** Show the T07 session: the guidance says lockouts use “Reset a password”, and the Windows login Application option is required. Point to the request-creation and read-back steps.
2. **Switch to Jira IT Service Desk.** Show ITSD-217: Request type “Reset a password”, Application “Windows login”, status “Waiting for support”.
3. **Back to OpenWork.** Say: “The request exists; the password has not been reset.” Never type a password into a prompt.

**Prompt for OpenWork** (copyable; adapted from the recorded scene)

```text
I’m locked out of my Windows login. Check the internal IT guidance, then create the correct IT Service Desk password-reset request, using the required “Windows login” Application value. Confirm the issue key, request type and Application. Never ask for or include a password, and don’t claim the reset is done.
```

**Expect this:** A correctly routed support request, ready for IT, not a completed reset.

**Participants try:** 30 seconds: name the safe success criterion and one thing an assistant must never ask you for.

> **Facilitator note: limits and missing views.** The OpenWork frame is mid-run; its final summary is not visible. This is only a request: no password reset or account recovery was performed or delivered.

**Screens**

![OpenWork session: IT guidance read, required Windows login option identified, request created and fetched. The final summary is not visible.](screenshots/run-51-t07-windows-password-reset.png)

*OpenWork · Same-run proof capture:* OpenWork session: IT guidance read, required Windows login option identified, request created and fetched. The final summary is not visible.

![Jira ITSD-217: Reset a password, Application Windows login, Waiting for support. The request is filed; no reset has happened.](screenshots/workshop-t07-final.png)

*Existing tool · Named Docshot:* Jira ITSD-217: Reset a password, Application Windows login, Waiting for support. The request is filed; no reset has happened.

[Previous](#jira) · [Contents](#welcome) · [Next](#trust)

---

<a id="trust"></a>
## 14:30 — Know when the honest answer is “not found” (T09)

*52–55 min · Trust · 3 of 5 min*

**Business need:** Lena will host the customer at the office and wonders if she can bring her dog. The company may simply not have a written policy.

**Say this**

> A small, human question: can Lena bring her dog to the office on meeting day? This tests trust, because the internal pages do not answer it. A good assistant says what it checked, says it found nothing, and names who can decide. A confident invented policy would be worse than no answer.

**Do this: OpenWork → existing tool → back**

1. **OpenWork.** Read the first line: “I couldn’t find a dog policy, so I can’t confirm whether you may bring your dog.” Point to the Employee Handbook and Working at the office sources, and the suggested People Ops question.
2. **Switch to Confluence.** Show “Working at the office”: desks, kitchen, parking, quiet zones. It contains no dog policy.
3. **Back to OpenWork.** Ask the room to distinguish “not found” from “allowed” and “forbidden”.

**Prompt for OpenWork** (copyable; adapted from the recorded scene)

```text
Can I bring my dog to the Acme office? Check the internal Employee Handbook and the Working at the office page, and cite what you read. If there’s no dog policy, say so and suggest what to ask People Ops. Don’t guess either way, and don’t search the web.
```

**Expect this:** A transparent “not found” with a clear next step. No policy is invented.

**Participants try:** 30 seconds: write one People Ops question that resolves the gap without assuming dogs are allowed or banned.

> **Facilitator note: limits and missing views.** OpenWork’s answer comes from a Docshot; the Confluence page is the version 5 page as it stood during T09. The technical report, not this image alone, establishes which pages were read.

**Screens**

![OpenWork: no dog policy found, sources named, and a People Ops question suggested. Nothing invented.](screenshots/workshop-t09-final.png)

*OpenWork · Named Docshot:* OpenWork: no dog policy found, sources named, and a People Ops question suggested. Nothing invented.

![Confluence “Working at the office” (version 5): office rules, with no dog policy.](screenshots/run-57-t09-honest-missing-policy-answer.png)

*Existing tool · Same-run proof capture:* Confluence “Working at the office” (version 5): office rules, with no dog policy.

[Previous](#it) · [Contents](#welcome) · [Next](#feedback)

---

<a id="feedback"></a>
## 15:00 — Tell the team what didn’t help (T08)

*55–57 min · Trust · 2 of 5 min*

**Business need:** The answer was honest, but the next step felt vague. Lena wants to flag that precisely.

**Say this**

> Even an honest answer can be unclear. Lena uses OpenWork’s existing feedback form to say exactly what did not help, with a reference to the specific answer, so the team can find it. This is a written note through the form, not a thumbs-down button.

**Do this: OpenWork → existing tool → back**

1. **OpenWork feedback form.** Show the filled form: “Not helpful: the missing-policy uncertainty and next step were not clear enough”, plus the session and response reference.
2. **OpenWork feedback form.** Show “Feedback sent”. In this rehearsal it was saved to a stand-in feedback store, not sent to a production team.
3. **Back to the day.** “Feedback is part of the workflow, not an afterthought. Now for the end-of-day loose ends.”

**Prompt for OpenWork** (copyable; adapted from the recorded scene)

```text
Use OpenWork’s feedback form to send this note about the dog-policy answer: “Not helpful: the missing-policy uncertainty and next step were not clear enough.” Include a reference to that answer. Only say it’s saved if the form confirms it.
```

**Expect this:** A specific note tied to a specific answer, which the team can act on.

**Participants try:** 30 seconds: rewrite the note in three parts: which answer, what was unclear, and what would have helped. Do not submit it.

> **Facilitator note: limits and missing views.** Form-based note, not a dedicated rating control. In the rehearsal, external delivery was replaced by an owned stand-in store; no real feedback was sent. The visible session and message IDs are from the disposable rehearsal.

**Screens**

![OpenWork feedback form: the negative note and its reference to the dog-policy answer, before sending.](screenshots/run-61-t08-persist-real-ui-feedback.png)

*OpenWork · Same-run proof capture:* OpenWork feedback form: the negative note and its reference to the dog-policy answer, before sending.

![OpenWork feedback form showing “Feedback sent”, saved to the rehearsal stand-in, not external delivery.](screenshots/workshop-t08-final.png)

*OpenWork · Named Docshot:* OpenWork feedback form showing “Feedback sent”, saved to the rehearsal stand-in, not external delivery.

[Previous](#trust) · [Contents](#welcome) · [Next](#calendar)

---

<a id="calendar"></a>
## 16:00 — Role example 1: arrange the follow-up meeting (T11)

*57–59½ min · Role / calendar / follow-up · 2½ of 5 min*

**Business need:** Lena needs Nora and Priya to review the Atlas comparison together, and the time changes once.

**Say this**

> Late afternoon: Lena sets up a review of the Atlas comparison with Nora and Priya. Then the time moves, as it always does. OpenWork updates the same meeting instead of creating a duplicate and keeps the attendees, location and time zone. For many of you, this calendar task is the recurring one.

**Do this: OpenWork → existing tool → back**

1. **OpenWork.** Show the T11 session: created for October 19, 10:00–10:30, then the same event moved to October 20, 11:00–11:45 America/Los_Angeles; no second meeting; no invitations sent.
2. **Switch to Outlook calendar.** Show “Acme Atlas review”: October 20, 11:00–11:45, Acme lab B, Nora Patel and Priya Shah.
3. **Back to OpenWork.** Ask: “How would you spot an accidental duplicate in your own calendar?”

**Prompt for OpenWork** (copyable; adapted from the recorded scene)

```text
Create “Acme Atlas review” on October 19, 2026, 10:00–10:30 America/Los_Angeles, with Nora Patel and Priya Shah, in Acme lab B, with the note “Review Atlas 2 and Atlas Lift comparison.” Then move that same meeting to October 20, 11:00–11:45, keeping everything else. Confirm the final details, and don’t create a second meeting.
```

**Expect this:** One meeting at the new time, with the same people and place.

**Participants try:** 30 seconds: rewrite the prompt for a meeting you reschedule often, using placeholders for names.

> **Facilitator note: limits and missing views.** The dates are fixed fixture dates. No real invitations were delivered. Missing view: Outlook’s change history; the before-and-after times appear in the OpenWork answer.

**Screens**

![OpenWork session: meeting created and then the same event rescheduled. The final state is verified and no invitations were sent.](screenshots/run-68-t11-create-and-reschedule-a-meeting.png)

*OpenWork · Same-run proof capture:* OpenWork session: meeting created and then the same event rescheduled. The final state is verified and no invitations were sent.

![Outlook calendar: “Acme Atlas review” on October 20, 11:00–11:45 America/Los_Angeles, with both attendees.](screenshots/workshop-t11-final.png)

*Existing tool · Named Docshot:* Outlook calendar: “Acme Atlas review” on October 20, 11:00–11:45 America/Los_Angeles, with both attendees.

[Previous](#feedback) · [Contents](#welcome) · [Next](#followup)

---

<a id="followup"></a>
## 16:00 — Role example 2: update guidance and close the loop (T12)

*59½–62 min · Role / calendar / follow-up · 2½ of 5 min*

**Business need:** The dog-policy gap should be recorded in the office guidance, and Nora should get a reply in the Blue Harbor thread.

**Say this**

> Last task: close the loop. Lena asks OpenWork to add a note to the office guidance page saying the dog policy is still with People Ops, leave a review comment, and draft a reply to Nora in the Blue Harbor thread. The existing guidance is preserved, the gap is recorded, and the email stays a draft until Lena sends it.

**Do this: OpenWork → existing tool → back**

1. **OpenWork.** Show the T12 request and OpenWork’s plan: read the full page and version, add the note and comment, then draft the reply without sending mail or inventing a dog policy.
2. **Switch to Confluence.** Show “Working at the office”, now at version 6: the original sections are unchanged and the new note sits at the end.
3. **Switch to Outlook.** Show the unsent reply to Nora in the Blue Harbor thread, with the page link, version 6 and the comment.
4. **Back to OpenWork.** “That’s Lena’s day. Now let’s talk about yours.”

**Prompt for OpenWork** (copyable; adapted from the recorded scene)

```text
Read the full Confluence “Working at the office” page and its current version. Keep the existing content and add: “Workshop review: office guidance checked on 2026-10-16; dog-policy confirmation remains with People Ops.” Save a new version and add the comment “Workshop review complete; please confirm the dog-policy gap with People Ops.” Then draft an unsent reply in the latest Blue Harbor thread linking the updated page. Read everything back, and don’t send mail.
```

**Expect this:** A traceable guidance update and a draft follow-up. Existing content is preserved, and the open question stays open.

**Participants try:** 30 seconds: choose one guidance page you update regularly. Note what must stay unchanged and who should review the draft.

> **Facilitator note: limits and missing views.** The OpenWork frame shows the request and plan; the final answer was not captured. Missing view: the Confluence comment itself, which appears only quoted in the draft. The screens show Alex Chen as the signed-in user; Lena is the workshop persona.

**Screens**

![OpenWork session: the update-and-reply request with OpenWork’s plan. The final answer is not visible.](screenshots/run-73-t12-update-confluence-and-draft-a-reply.png)

*OpenWork · Same-run proof capture:* OpenWork session: the update-and-reply request with OpenWork’s plan. The final answer is not visible.

![Confluence “Working at the office” after the update: version 6, original sections intact, note added at the end.](screenshots/run-74-t12-update-confluence-and-draft-a-reply.png)

*Existing tool · Same-run proof capture:* Confluence “Working at the office” after the update: version 6, original sections intact, note added at the end.

![Outlook: unsent threaded reply to Nora with the page link, version and comment.](screenshots/workshop-t12-final.png)

*Existing tool · Named Docshot:* Outlook: unsent threaded reply to Nora with the page link, version and comment.

[Previous](#calendar) · [Contents](#welcome) · [Next](#own-task)

---

<a id="own-task"></a>
## Your two recurring tasks (62–70 min)

> Your turn. Write down two recurring tasks from your own week: things you do often enough to know what a good result looks like. For one of them, draft how you would ask OpenWork: which sources it may use, what it should produce, what it must not do, and how you would check the result in the tool where it lands.

1. 0–2 min: list TWO recurring tasks: what triggers each one, and what output you need. Use placeholders for private data.
2. 2–4 min: choose ONE. Name the allowed sources, the output, the forbidden actions and the person who reviews it.
3. 4–6 min: draft the OpenWork prompt from the template, on paper or in a local note.
4. 6–7 min: swap with a partner, who names one likely failure or missing source.
5. 7–8 min: add one verification step in the existing tool, and one stop condition.

```text
I’m a [role]. A task I repeat is [task]. Using only [approved sources], produce [specific output] and save it in [existing tool / location] for [reviewer]. Cite the sources and flag anything uncertain. Do not [send / share / change / schedule] anything without my approval. If [source or permission] is missing, stop and tell me. I’ll check the result by [observable check in the existing tool].
```

<a id="wrap"></a>
## Wrap (70–75 min)

> We followed one workday. Lena stayed in OpenWork and checked her other tools only to confirm results. Where did she save time? What looked wrong or unfinished, like the slides? Which sources mattered? What outcome would you verify before calling the task done? Leave with two recurring tasks and the safest first step.

```text
What saved time?
What was wrong, unclear or unfinished?
Which sources would I check?
What outcome must I verify, and in which tool?
My two recurring tasks, and the safest first step:
```

---

<a id="status"></a>
## Presenter-only status

- **Sol technical rehearsal.** 12/12 PASS within the fictional, isolated technical scope, at 8d40f1bba1, with two independent read-only audits. This is not production approval, presentation-polish approval, or proof of repeated-run reliability.
- **Qwen.** Not final green. The separate Qwen phase is still pending; do not generalize the Sol result to Qwen.
- **Screenshots are not backend evidence.** A UI capture shows what was on screen. Backend changes, source reads, identity and access boundaries are established by the scoped report’s readbacks, not by these images. The guide contains no raw receipts, credentials or runtime logs.
- **No real delivery.** No mail, invitation, external feedback or password reset was delivered. Drafts are unsent; ITSD-217 is a request; the calendar shows state, not invitation delivery.
- **Scheduling.** T10 used a simulated clock and an operator-triggered run. It is not an unattended production Automation.
- **Sharing.** T03 access goes through the containing Plugin, not a permanent grant for a single Workflow. Viewers can run manually but cannot schedule.
- **PowerPoint.** The 14-slide PPTX bytes and content passed an independent check. Slides 10 and 14 have only a heading and footer. Office rendering, typography, overflow and full Office editing were not checked or demonstrated. Facilitator review is required.
- **Where the screens come from.** 16 named Docshots plus 15 extra captures from the same passed run (test-run 2026-10-17T09:27:49Z, same source version, outcome passed). The extra captures are genuine full-run screenshots used here for OpenWork context; they were not separately reviewed as Docshots.
- **Partial OpenWork frames.** T01 and T07 are mid-response. T05 and T12 show the request (and plan), not the final answer. T10 was captured at registration, before the scheduled run.
- **Known missing views.** T01 Confluence datasheet pages · T04 account-plan pages · T05 OpenWork completion and rendered slides · T10 unsent Outlook draft and post-run OpenWork view · T11 calendar change history · T12 Confluence comment view. No images were invented to fill these gaps.
- **No new runs.** Assembled from existing local evidence only: no inference, test reruns, live captures, product-source changes, worker or PR changes.

Source report: `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/reports/workshop-narrative/sol-fixes.md`

<a id="accessibility"></a>
## Optional appendix: Jira accessibility before / after

![Optional appendix: baseline Jira Assignee field. Same visible business state as the corrected capture.](screenshots/workshop-before-regression.png)

*Optional appendix: baseline Jira Assignee field. Same visible business state as the corrected capture.*

![Optional appendix: corrected Jira Assignee field. The locator regression test, not these pixels, establishes the fix.](screenshots/workshop-after-regression.png)

*Optional appendix: corrected Jira Assignee field. The locator regression test, not these pixels, establishes the fix.*


<a id="sources"></a>
## Screenshot sources

| File | Provenance | Original path |
|---|---|---|
| run-01-t10-09-00-news-digest.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/01-t10-09-00-news-digest.png` |
| workshop-t10-final.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t10-final.png` |
| run-06-t01-grounded-customer-comparison.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/06-t01-grounded-customer-comparison.png` |
| run-07-t01-grounded-customer-comparison.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/07-t01-grounded-customer-comparison.png` |
| workshop-t01-final.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t01-final.png` |
| run-12-t02-save-and-rerun-a-native-workflow.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/12-t02-save-and-rerun-a-native-workflow.png` |
| workshop-t02-context.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t02-context.png` |
| workshop-t02-final.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t02-final.png` |
| run-20-t03-recipient-execution-of-a-shared-workflow.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/20-t03-recipient-execution-of-a-shared-workflow.png` |
| run-21-t03-recipient-execution-of-a-shared-workflow.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/21-t03-recipient-execution-of-a-shared-workflow.png` |
| workshop-t03-context.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t03-context.png` |
| workshop-t03-final.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t03-final.png` |
| run-29-t04-account-intelligence.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/29-t04-account-intelligence.png` |
| workshop-t04-final.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t04-final.png` |
| run-34-t05-generate-a-real-account-analysis-powerpoint.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/34-t05-generate-a-real-account-analysis-powerpoint.png` |
| workshop-t05-final.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t05-final.png` |
| run-39-t06-assigned-documentation-ticket.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/39-t06-assigned-documentation-ticket.png` |
| workshop-t06-final.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t06-final.png` |
| run-51-t07-windows-password-reset.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/51-t07-windows-password-reset.png` |
| workshop-t07-final.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t07-final.png` |
| workshop-t09-final.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t09-final.png` |
| run-57-t09-honest-missing-policy-answer.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/57-t09-honest-missing-policy-answer.png` |
| run-61-t08-persist-real-ui-feedback.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/61-t08-persist-real-ui-feedback.png` |
| workshop-t08-final.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t08-final.png` |
| run-68-t11-create-and-reschedule-a-meeting.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/68-t11-create-and-reschedule-a-meeting.png` |
| workshop-t11-final.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t11-final.png` |
| run-73-t12-update-confluence-and-draft-a-reply.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/73-t12-update-confluence-and-draft-a-reply.png` |
| run-74-t12-update-confluence-and-draft-a-reply.png | Same-run proof capture | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/test-runs/2026-10-17T09-27-49-909Z-7347-a-fictional-team-rehearses-every-workshop-scene-without-hidden-task-writes/74-t12-update-confluence-and-draft-a-reply.png` |
| workshop-t12-final.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-t12-final.png` |
| workshop-before-regression.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-before-regression.png` |
| workshop-after-regression.png | Named Docshot | `/Users/benjaminshafii/_worktrees/openwork-workshop-sol/evals/results/workshop-docshots/gpt-sol-fast-e00a208e-9c0f-4f47-a206-fb3dacb16577/workshop-after-regression.png` |
