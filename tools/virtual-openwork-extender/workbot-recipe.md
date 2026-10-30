# Workbot demo preparation recipe

Use Virtual OpenWork Extender for the target and service setup; do not build a separate Workbot-only credential store.

## Story

Acme Robotics is preparing a launch review. A member signs in, sees the meeting, creates a preparation Automation, opens the launch brief and asks for the unresolved decision. An admin explains the configuration. The real background agent alerts the member about something actionable in Slack. All names and content are synthetic.

## Before capture

1. Confirm the requested Den/Workbot origins and active org. The existing production demo org reference is stored in Infisical `VOE_TARGET_JSON`; do not assume the signed-in browser is in that org.
2. Discover the deployed build and currently supported features. Candidate org flags from the original plan: `workbotDocuments`, `workbotDocumentEditing` (only for the edit beat), `workbotWorkspaceAssistant`, `workbotProactive`, `workbotAgentLibrary`, `workbotAgentHealthView`, `automationCalendar`, `automationCalendarTriggers`. Enable only supported flags needed for this run after saving their prior tri-state overrides. Missing flags are a version finding, not permission to invent one.
3. Complete Google and Slack provisioning using README.md. Confirm membership and model access. Keep account consent and credentials off camera.
4. Choose a run namespace. Create one Drive folder `Acme demo — <run>` and upload `fixtures/launch-brief.txt` and `fixtures/meeting-notes.txt`. Confirm they appear in the member's Recent/My Drive. Store actual IDs in a receipt, never fabricated IDs.
5. Create a private Calendar event from `fixtures/calendar-event.json`: substitute a future start/end in America/Los_Angeles. It has no attendees, no conference link and no reminders; do not invite real people. Verify its title/time in Workbot.
6. If proactive Gmail triage needs a message, use `fixtures/actionable-message.txt` as a **draft first**. Send only to the confirmed demo identity when explicitly authorized. Do not send to coworkers/customers to manufacture a demo. Alternatively use a genuine existing demo-safe actionable email. A synthetic seed is disclosed as setup, not a real customer's message.
7. Rehearse the five chapters. Do not precreate the Automation that the video must show being created. Use a disposable fresh member/profile for first-run; do not wipe an existing user's profile or reset their account.
8. Inventory and the helper's unit tests are setup checks only. Record these acceptance checks separately with timestamps and screenshots:
   - Google authorization completed for the demo member; API checks passed for needed APIs.
   - Workbot Calendar shows the actual seeded event.
   - Drive file opens; assistant reads saved content and answers the unresolved approval question.
   - Optional document edit saves and reopens with the change. Native Google files save as Office copies; label this correctly. Contextual workspace assistant is read-only; ask it to summarize, not pretend it can edit the open document in place.
   - Slack app is installed in the intended workspace and member identity is linked.
   - Proactive check actually ran; a Slack DM has a real message timestamp/permalink. If the agent chooses silence or no supported trigger exists, report that rather than posting a fake substitute.

## Original chapter order / caption beats

1. **First open.** “A new member signs in and starts their first conversation.” Capture onboarding and a real completed first reply.
2. **Calendar.** “See your meetings and create an Automation to prepare for one.” Actually create one on camera. Before/after-meeting triggers only if the target exposes them; do not claim a schedule fired just because it was saved.
3. **Documents.** “Open the launch brief and ask what still needs a decision.” Browse recent files, open a tab, include its view context and ask about the unresolved approval. Show an edit only if its separate save flow works.
4. **Admin.** “The admin sets the model, connected apps and proactive responsibilities.” Show the real Manage/Workbot settings and org feature controls. No invented labels or fake admin panel.
5. **Proactive and next.** “Your agent sends a short Slack message when something needs you.” Show a genuine run and message if available. Show member off/snooze/mute and admin Library/health only where enabled. Then a clearly separated **Coming next** card supported by the current repo/PR evidence. Do not present unshipped code as deployed.

## Handoff to capture

- Existing takes: `~/Movies/workbot-demo/rec/`; inspect footage before reuse.
- Existing local recorder: `~/Movies/workbot-demo/kit/`; do not delete its profile or take files.
- Capture via the authorized real browser/computer on the Mac. No website HTML re-creation or synthetic UI.
- Use the current capture/caption skills. Finish: 1920×1080, 30 fps MP4, reviewed at 1×, README with per-beat verified/not-finished/coming-next, build, flags and cleanup, then Drive upload with the requested sharing scope.

## Finish/cleanup

Restore original org flags, remove or disable the created demo Automation unless explicitly kept, and clean only IDs owned by this run. Do not delete shared demo credentials/apps. Include exact remaining blockers in the report. Successful footage, not the existence of this guide, is the done condition for the demo.
