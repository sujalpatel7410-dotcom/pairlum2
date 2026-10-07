# Pairlum tests

These are the actual tests that were run against this build. `RESULTS.md` is the output of the last run.

## What they are, and what they are not

- They open the real app in headless Chromium (Playwright) and click, type and read storage.
- Two tabs in one browser stand in for two partners. That is **not** two phones syncing.
- The microphone is Chromium's built-in fake device. That is **not** a hardware test.
- "A save fails" means a write was made to throw on purpose. That is **not** a measured full phone.
- The understanding service is a mock answered by the test. That checks the app's side of the contract, **not** real speech-to-text.
- The camera is Chromium's fake camera.
- Keyboard and accessibility checks use the keyboard and Chromium's accessibility tree. That is **not** a screen-reader test.

## How to run

1. Install Python 3.
2. In a terminal: `pip install playwright pillow` and then `playwright install chromium`.
3. `python3 tests/run_all.py .` from the folder that contains `index.html`.
4. Read `tests/RESULTS.md`.

Each file can also be run alone: `python3 tests/test_3_live_microphone.py . /tmp/out`.

## Files

| File | Review case | What it covers |
|---|---|---|
| test_1_isolation_recorder.py | earlier review | demo isolation, failed saves, recorder microphone release |
| test_2_support_backup_story.py | earlier review | I Need You, export/restore basics, drafts, voice in Our Story |
| test_3_live_microphone.py | 1 | live sound: cancel, deadline, failed/aborted mode swap, disconnect/leave/delete while live |
| test_4_restore_delete_damage.py | 2, 3, 4 | restore that fails, saves that fail before a delete, unreadable saved data |
| test_5_html_sync_retention_paused.py | 5, 6, 7, 8 | HTML-like text, two partners' changes, nothing trimmed, paused space |
| test_6_backup_upload_import.py | 9, 10, 11 | full backup into an empty browser, interrupted uploads, imports and attachments |
| test_7_questions_calendar_keyboard.py | 12, 13, 14 | today's question, shared calendar, keyboard and hidden content, petals |
| test_8_voice_first.py | voice-first | voice on a photo or clip, 5–30 second clips, flat reply thread, write-ups (mock service), Find a voice |
| layout/audit.py, sweep.py, voice_layout.py, booktest.py | layout | text/icon overlap, clipping and overflow on every view, sheet and Book page |

## Test hooks inside app.js

Four small hooks exist only so a test can force a rare moment. None is used by the app itself:

- `window.__pairlumTestStaleRead` — hands one save an older copy of the record (two partners saving in the same instant).
- `window.__pairlumTestFailMediaPut` — makes chosen media writes fail.
- `window.__pairlumTestFailCommit` — makes the final step of a restore fail.
- `window.__pairlumTestConnectMs` — shortens the 30-second live-sound connection deadline.

## Before uploading to Netlify

The `tests` folder is not part of the app. It can be deleted before uploading; nothing in the app refers to it.
