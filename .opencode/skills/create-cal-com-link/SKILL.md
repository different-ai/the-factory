---
name: create-cal-com-link
description: Create targeted Cal links for specific people or teams
---

## Quick Usage (Time-Boxed Link)

### 1) Configure env
- Copy `.env.example` to `.env` and set `CAL_API_KEY`.
- This is the only required env var for a fresh setup.

### 2) Run scripts
```bash
bash .opencode/skills/create-cal-com-link/scripts/create-schedule.sh "Jasper" "Asia/Singapore"
# copy schedule id + default availability id from the output

bash .opencode/skills/create-cal-com-link/scripts/delete-default-availability.sh <availability-id>
bash .opencode/skills/create-cal-com-link/scripts/add-availability-window.sh <schedule-id> "[1,2,3,4,5]" "10:00:00" "13:00:00"

bash .opencode/skills/create-cal-com-link/scripts/create-event-type.sh <schedule-id> "Jasper x Benjamin" "jasper-x-benjamin" 30 "integrations:daily"
bash .opencode/skills/create-cal-com-link/scripts/set-event-type-range.sh <event-type-id> 4 "Asia/Singapore"
```

## Time-Boxed Link Playbook

Use this when someone says: "Create a link for Jasper, he's on Singapore time, next 4 days."

### 1) Choose a schedule time zone
- Pick the invitee's time zone for clarity (ex: `Asia/Singapore`).

### 2) Create schedule + remove default availability
```bash
bash .opencode/skills/create-cal-com-link/scripts/create-schedule.sh "Jasper (next 4 days)" "Asia/Singapore"
# capture schedule id + availability id from the response
bash .opencode/skills/create-cal-com-link/scripts/delete-default-availability.sh <availability-id>
```

### 3) Add a clean availability window
```bash
bash .opencode/skills/create-cal-com-link/scripts/add-availability-window.sh <schedule-id> "[1,2,3,4,5]" "10:00:00" "13:00:00"
```

### 4) Create the event type + time-box it
```bash
bash .opencode/skills/create-cal-com-link/scripts/create-event-type.sh <schedule-id> "Jasper x Benjamin" "jasper-x-benjamin" 30 "integrations:daily"
bash .opencode/skills/create-cal-com-link/scripts/set-event-type-range.sh <event-type-id> 4 "Asia/Singapore"
```

## Common Gotchas

- Availability times must be ISO strings like `1970-01-01T08:00:00.000Z`.
- Availabilities are weekly; use `set-event-type-range.sh` to time-box the link.
- A new schedule defaults to a 9-5 weekday availability you may want to delete.

## First-Time Setup (If Not Configured)

1. Create a Cal.com API key in Settings > Security.
2. Copy `.env.example` to `.env` and set `CAL_API_KEY`.
3. The scripts use runtime IDs (from the prior response) for schedule and availability.

## Notes

- Use the invitee's time zone when sending a targeted link.
- Days are numbers: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun.
- `scripts/` uses `.env.example` as the minimum configuration reference.
