"""Runs every Pairlum test and writes RESULTS.md next to this file.
Usage:  python3 run_all.py <folder that contains index.html>
Needs:  Python 3, `pip install playwright pillow`, then `playwright install chromium`."""
import sys, os, subprocess, json, tempfile, datetime
here = os.path.dirname(os.path.abspath(__file__))
site = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.abspath(os.path.join(here, ".."))
work = tempfile.mkdtemp(prefix="pairlum-tests-")
res = os.path.join(work, "results.jsonl")
tests = sorted(f for f in os.listdir(here) if f.startswith("test_") and f.endswith(".py"))
rows = []
for t in tests:
    env = dict(os.environ, PAIRLUM_RESULTS=res)
    print("== " + t, flush=True)
    p = subprocess.run([sys.executable, os.path.join(here, t), site, os.path.join(work, t[:-3])], cwd=here, env=env, capture_output=True, text=True)
    out = p.stdout
    passed = sum(1 for l in out.splitlines() if l.startswith("PASS")); failed = [l for l in out.splitlines() if l.startswith("FAIL")]
    crashed = ("Traceback" in (p.stderr or "")) and not failed
    rows.append((t, passed, failed, crashed, (p.stderr or "")[-600:] if crashed else ""))
    print("   %d passed, %d failed%s" % (passed, len(failed), "  (stopped early: see RESULTS.md)" if crashed else ""), flush=True)
with open(os.path.join(here, "RESULTS.md"), "w") as f:
    f.write("# Test results\n\nRun: %s\nBuild folder: %s\n\n| Test file | Passed | Failed |\n|---|---|---|\n" % (datetime.datetime.now().strftime("%d %B %Y, %H:%M"), os.path.basename(site)))
    for t, n, bad, crashed, err in rows: f.write("| %s | %d | %s |\n" % (t, n, (str(len(bad)) + (" + stopped early" if crashed else ""))))
    f.write("\nTotal: %d passed, %d failed.\n" % (sum(r[1] for r in rows), sum(len(r[2]) for r in rows)))
    for t, n, bad, crashed, err in rows:
        if bad or crashed:
            f.write("\n## %s\n\n" % t)
            for l in bad: f.write("- " + l + "\n")
            if crashed: f.write("\n```\n" + err + "\n```\n")
print("\nTOTAL: %d passed, %d failed. Written to RESULTS.md" % (sum(r[1] for r in rows), sum(len(r[2]) for r in rows)))
sys.exit(1 if any(r[2] or r[3] for r in rows) else 0)
