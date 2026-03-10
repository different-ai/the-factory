---
name: outreach-crm
description: |
  Run the OpenWork outreach CRM in Notion.

  Triggers when user mentions:
  - "outreach crm"
  - "linkedin outreach"
  - "outreach skill"
---

## Goal

Use this skill to manage warm outbound outreach for OpenWork when the lead is connected to a recognizable company or has shown direct product interest.

The default posture is not cold sales. Treat outreach as founder-to-builder or builder-to-builder learning, especially when OpenWork already has warm context through GitHub activity, shared communities, or other real signals.

## Quick Usage (Already Configured)

### Existing Notion workspace objects

- Outreach parent page: `https://www.notion.so/31b8ed524fef8013bc0dfc63ff37f92c`
- CRM page: `https://www.notion.so/31e8ed524fef816c8415f19ca7ae754e`
- Leads database: `https://www.notion.so/0cc58168919245e8b92c57848a42ea85`
- Leads data source: `collection://a3858765-7baf-4fe9-ae85-fa993d3446a7`
- Messages database: `https://www.notion.so/88fb24a784f3468a92a11615e5022f5f`
- Messages data source: `collection://e7527398-0672-4677-b4cf-09b5e790f570`
- Feedback Insights page: `https://www.notion.so/31e8ed524fef81ddb2ecdd7c8f548ade`

### Current seeded lead

- Andrew Qu lead page: `https://www.notion.so/31e8ed524fef815780a8c94ce8d4705f`
- Andrew Qu draft message: `https://www.notion.so/31e8ed524fef8174ad23ffab48a47fa6`

## CRM Shape

### Leads database

Use these properties:

- `Name`
- `Company`
- `Role`
- `LinkedIn`
- `GitHub`
- `Status`
- `Priority`
- `Warm Context`
- `Outreach Angle`
- `Last Contact`
- `Notes`

If the database must be rebuilt, use this definition:

```sql
CREATE TABLE (
  "Name" TITLE,
  "Company" RICH_TEXT,
  "Role" RICH_TEXT,
  "LinkedIn" URL,
  "GitHub" URL,
  "Status" SELECT('Researching':gray, 'Ready to reach out':blue, 'Sent':yellow, 'Replied':green, 'No reply':red),
  "Priority" SELECT('High':red, 'Medium':yellow, 'Low':gray),
  "Warm Context" RICH_TEXT,
  "Outreach Angle" RICH_TEXT,
  "Last Contact" DATE,
  "Notes" RICH_TEXT
)
```

Recommended lead statuses:

- `Researching`
- `Ready to reach out`
- `Sent`
- `Replied`
- `No reply`

### Messages database

Use these properties:

- `Title`
- `Lead`
- `Platform`
- `Status`
- `Rating`
- `Message Date`
- `Content`
- `Outcome Notes`

If the database must be rebuilt, use this definition:

```sql
CREATE TABLE (
  "Title" TITLE,
  "Lead" RELATION('a3858765-7baf-4fe9-ae85-fa993d3446a7'),
  "Platform" SELECT('LinkedIn':blue, 'Email':green, 'Slack':purple, 'X':gray),
  "Status" SELECT('Draft':gray, 'Ready':blue, 'Sent':yellow, 'Reply':green, 'No reply':red),
  "Rating" NUMBER,
  "Message Date" DATE,
  "Content" RICH_TEXT,
  "Outcome Notes" RICH_TEXT
)
```

Recommended message statuses:

- `Draft`
- `Ready`
- `Sent`
- `Reply`
- `No reply`

### Feedback Insights page

Keep four sections current:

- `What's Working`
- `What's Failing`
- `Proven Template Shape`
- `Notes`

## Operating Workflow

### 1) Reuse or rebuild the CRM

1. Fetch the CRM page first.
2. If the existing page is present, reuse it.
3. If it is missing or broken, recreate it under the Outreach parent page with the same databases and sections listed above.

Use Notion tools directly:

- `notion_notion-fetch` to inspect the page or database
- `notion_notion-create-pages` to create the CRM page or lead/message entries
- `notion_notion-create-database` to recreate the Leads or Messages databases
- `notion_notion-query-data-sources` to look up leads and message history
- `notion_notion-update-page` to refine the Feedback Insights page

### 2) Pick leads

When the user asks for prospects:

1. Prefer people at recognizable companies.
2. Prefer public builders, product engineers, founders, Office of CTO roles, or ecosystem-facing people.
3. Prefer warm context over raw follower count.
4. Keep the shortlist tight and actionable.

Default ranking order:

1. recognizable company
2. likely relevance to developer workflow or remote work
3. warm context or shared program/community tie
4. public profile quality
5. follower count as a tiebreaker only

### 3) Add or update a lead

For each lead:

1. confirm the correct LinkedIn profile
2. gather company, role, GitHub, and any warm context
3. write a concise `Outreach Angle`
4. set `Priority` and `Status`

### 4) Draft the first LinkedIn message

The first message should usually be 2-4 short paragraphs or 3-5 sentences total.

Default structure:

1. quick personal opener
2. specific reason this person is relevant
3. light shared context from GitHub, YC, OSS programs, or an adjacent ecosystem signal
4. a small ask for perspective, not a meeting request

Message rules:

- keep it warm and peer-to-peer
- do not sound like a sales sequence
- avoid generic praise
- avoid multiple asks
- avoid links in the first message unless the user explicitly wants one
- prefer asking for quick perspective over asking for time

### 5) Log sends and outcomes

After the user sends a message manually:

1. create or update the linked message row in `Messages`
2. set the lead `Status` to `Sent`
3. set `Message Date`
4. if a reply arrives, update message and lead statuses to `Reply` and `Replied`
5. if there is no response after a reasonable period, mark `No reply`
6. write 1-3 bullets into `Feedback Insights` describing what seems to have worked or failed

## Message Heuristics

Use these defaults unless the user asks for a different tone:

- short beats clever
- relevant beats polished
- one sharp question beats a broad invitation
- shared context should be mentioned lightly, not used as leverage
- if the user already has GitHub, YC, Slack, or OSS-program context, say so plainly and move on

Good example pattern:

```text
Hey Andrew - I'm building OpenWork and reached out because your work feels especially relevant.

I'd love your quick take on what makes a developer workflow product feel immediately useful instead of just technically impressive.

If you're open to it, I can send a very short note with the specific point where I'd value your perspective.
```

## Common Gotchas

- Verify LinkedIn carefully when the lead has a common name.
- Do not overfit to follower counts; recognizable company plus relevance is the main filter.
- Keep the first ask lightweight.
- Update the CRM after every send or reply so the learning loop stays useful.
- If the current CRM page is missing, rebuild it in the same Outreach area instead of creating random duplicates elsewhere.

## First-Time Setup (If Not Configured)

1. Make sure the Notion MCP connection is available.
2. Fetch the Outreach parent page: `https://www.notion.so/31b8ed524fef8013bc0dfc63ff37f92c`.
3. Create `Outreach CRM` under that page.
4. Recreate the Leads and Messages databases with the schema in this skill.
5. Create a `Feedback Insights` page with the four sections listed above.

## Notes

- This skill is optimized for manual LinkedIn outreach, not bulk automation.
- The default OpenWork angle is: warm outreach, short note, ask for perspective, no hard pitch.
- Reuse existing CRM assets whenever possible so history stays in one place.
