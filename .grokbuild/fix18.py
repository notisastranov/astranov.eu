import runpy
for name in ("fix18a.py", "fix18b.py", "fix18c.py", "fix18d.py"):
    runpy.run_path(".grokbuild/" + name)
print("ok18x")
print("ok18")
