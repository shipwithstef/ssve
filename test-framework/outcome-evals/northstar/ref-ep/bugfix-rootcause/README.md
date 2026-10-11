# Studio schedule

The owner's schedule and the free-trial rule. Every "day" is a studio day: the calendar date in
the studio's time zone (`STUDIO_TZ`, default `Australia/Sydney`), daylight saving included.

- `src/dates.mjs`: `dayKey` and `formatTime`, shared by the schedule and the trial rules.
- `src/schedule.mjs`: classes grouped by studio day, in start order.
- `src/trials.mjs`: one free trial class per customer per studio day.

## Test

    node --test

Runs the tests in `test/`. There is nothing to install.
