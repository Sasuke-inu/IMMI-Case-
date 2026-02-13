#!/usr/bin/env python3
"""Start the IMMI-Case web interface.

Usage:
    python web.py                    # Start on http://localhost:5000
    python web.py --port 8080        # Custom port
    python web.py --output mydata    # Custom data directory
"""

import argparse
import warnings

from immi_case_downloader.webapp import create_app


def main():
    parser = argparse.ArgumentParser(description="IMMI-Case Web Interface")
    parser.add_argument("--port", type=int, default=5000, help="Port (default: 5000)")
    parser.add_argument("--host", default="127.0.0.1", help="Host (default: 127.0.0.1)")
    parser.add_argument("--output", default="downloaded_cases", help="Data directory")
    parser.add_argument(
        "--backend", default="auto",
        choices=["auto", "sqlite", "csv", "supabase"],
        help="Storage backend (default: auto)",
    )
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    args = parser.parse_args()

    if args.debug and args.host == "0.0.0.0":
        warnings.warn(
            "Running in debug mode with public host 0.0.0.0 — "
            "this exposes the debugger to the network. "
            "Use --host 127.0.0.1 for safety.",
            RuntimeWarning,
            stacklevel=1,
        )

    app = create_app(output_dir=args.output, backend=args.backend)
    print(f"Starting IMMI-Case web interface at http://{args.host}:{args.port}")
    print(f"Data directory: {args.output}")
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
