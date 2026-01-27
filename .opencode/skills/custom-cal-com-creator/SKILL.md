---
name: custom-cal-com-creator
description: Create a Cal.com schedule with spotty PST availability and an event type.
---

## Quick Usage (Already Configured)

### 1) Create a schedule (PST)
```bash
curl -sS -X POST "https://api.cal.com/v1/schedules?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name":"PST Spotty This Week","timeZone":"America/Los_Angeles"}'
```

### 2) Remove the default 9-5 availability
```bash
curl -sS -X DELETE "https://api.cal.com/v1/availabilities/${DEFAULT_AVAILABILITY_ID}?apiKey=${CAL_API_KEY}"
```

### 3) Add spotty availability blocks (weekly)
```bash
curl -sS -X POST "https://api.cal.com/v1/availabilities?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":${SCHEDULE_ID},"days":[2],"startTime":"1970-01-01T08:00:00.000Z","endTime":"1970-01-01T08:45:00.000Z"}'
curl -sS -X POST "https://api.cal.com/v1/availabilities?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":${SCHEDULE_ID},"days":[2],"startTime":"1970-01-01T09:30:00.000Z","endTime":"1970-01-01T10:00:00.000Z"}'
curl -sS -X POST "https://api.cal.com/v1/availabilities?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":${SCHEDULE_ID},"days":[2],"startTime":"1970-01-01T11:15:00.000Z","endTime":"1970-01-01T12:00:00.000Z"}'
curl -sS -X POST "https://api.cal.com/v1/availabilities?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":${SCHEDULE_ID},"days":[3],"startTime":"1970-01-01T08:15:00.000Z","endTime":"1970-01-01T09:00:00.000Z"}'
curl -sS -X POST "https://api.cal.com/v1/availabilities?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":${SCHEDULE_ID},"days":[3],"startTime":"1970-01-01T10:30:00.000Z","endTime":"1970-01-01T11:00:00.000Z"}'
curl -sS -X POST "https://api.cal.com/v1/availabilities?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":${SCHEDULE_ID},"days":[3],"startTime":"1970-01-01T11:30:00.000Z","endTime":"1970-01-01T12:00:00.000Z"}'
curl -sS -X POST "https://api.cal.com/v1/availabilities?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":${SCHEDULE_ID},"days":[5],"startTime":"1970-01-01T08:00:00.000Z","endTime":"1970-01-01T08:30:00.000Z"}'
curl -sS -X POST "https://api.cal.com/v1/availabilities?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":${SCHEDULE_ID},"days":[5],"startTime":"1970-01-01T09:45:00.000Z","endTime":"1970-01-01T10:15:00.000Z"}'
curl -sS -X POST "https://api.cal.com/v1/availabilities?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"scheduleId":${SCHEDULE_ID},"days":[5],"startTime":"1970-01-01T11:00:00.000Z","endTime":"1970-01-01T11:45:00.000Z"}'
```

### 4) Create the event type (Cal Video)
```bash
curl -sS -X POST "https://api.cal.com/v1/event-types?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Tom x OpenWork","slug":"tom-x-openwork","length":30,"scheduleId":${SCHEDULE_ID},"metadata":{},"locations":[{"type":"integrations:daily"}]}'
```

## Common Gotchas

- Availability times must be ISO strings like `1970-01-01T08:00:00.000Z`.
- Availabilities are weekly; they do not auto-expire after a single week.
- A new schedule defaults to a 9-5 weekday availability you may want to delete.

## First-Time Setup (If Not Configured)

1. Create a Cal.com API key in Settings > Security.
2. Export it as `CAL_API_KEY` in your shell or a local env file.

## Notes

- Use PST via `America/Los_Angeles` for the schedule time zone.
- Days are numbers: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun.
