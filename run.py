#!/usr/bin/env python3
"""Entry point script for the immigration case downloader.

Usage:
    python run.py search              # Search for immigration cases
    python run.py download            # Download full case texts
    python run.py list-databases      # List available databases

Or use as a module:
    python -m immi_case_downloader search
"""

from immi_case_downloader.cli import main

if __name__ == "__main__":
    main()
