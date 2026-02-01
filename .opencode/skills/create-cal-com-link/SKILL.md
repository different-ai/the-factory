---
name: create-cal-com-link
description: Create a Cal Com Link
---

## Quick Usage (Already Configured)

### 1) Configure env
- Copy `.env.example` to `.env` and set `CAL_API_KEY`.
- If you want the skill to store credentials, add them to `.env` and rotate keys later.

### 2) Run scripts
```bash
bash .opencode/skills/create-cal-com-link/scripts/create-schedule.sh
# copy schedule id + default availability id from the output

bash .opencode/skills/create-cal-com-link/scripts/delete-default-availability.sh <availability-id>
bash .opencode/skills/create-cal-com-link/scripts/add-spotty-availability.sh <schedule-id>
bash .opencode/skills/create-cal-com-link/scripts/create-event-type.sh <schedule-id> "Tom x OpenWork" "tom-x-openwork" 30 "integrations:daily"
```

## Common Gotchas

- Availability times must be ISO strings like `1970-01-01T08:00:00.000Z`.
- Availabilities are weekly; they do not auto-expire after a single week.
- A new schedule defaults to a 9-5 weekday availability you may want to delete.

## First-Time Setup (If Not Configured)

1. Create a Cal.com API key in Settings > Security.
2. Copy `.env.example` to `.env` and set `CAL_API_KEY`.
3. The scripts use runtime IDs (from the prior response) for schedule and availability.

## Notes

- Use PST via `America/Los_Angeles` for the schedule time zone.
- Days are numbers: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun.
- `scripts/` uses `.env.example` as the minimum configuration reference.
