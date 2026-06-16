import runpy
import sys

if __name__ == "__main__":
    if len(sys.argv) == 1:
        sys.argv.append("--all")

    runpy.run_module("src.main", run_name="__main__")
