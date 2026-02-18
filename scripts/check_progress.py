"""
Monitor scraping progress by querying R2 object counts.

Usage:
    python scripts/check_progress.py              # one-shot check
    python scripts/check_progress.py --watch 30   # refresh every 30 seconds
    python scripts/check_progress.py --errors      # list failed case IDs
"""

import argparse
import sys
import time
from datetime import datetime

from cloudflare_config import (
    R2_BUCKET_NAME,
    validate_config,
    get_r2_client,
)


def count_objects(client, bucket: str, prefix: str) -> int:
    """Count all objects under a prefix in R2."""
    count = 0
    continuation_token = None

    while True:
        kwargs = {
            "Bucket": bucket,
            "Prefix": prefix,
            "MaxKeys": 1000,
        }
        if continuation_token:
            kwargs["ContinuationToken"] = continuation_token

        resp = client.list_objects_v2(**kwargs)
        count += resp.get("KeyCount", 0)

        if resp.get("IsTruncated"):
            continuation_token = resp["NextContinuationToken"]
        else:
            break

    return count


def list_error_ids(client, bucket: str, limit: int = 50) -> list[dict]:
    """List error case IDs and their error messages."""
    import json

    errors = []
    continuation_token = None

    while len(errors) < limit:
        kwargs = {
            "Bucket": bucket,
            "Prefix": "errors/",
            "MaxKeys": min(100, limit - len(errors)),
        }
        if continuation_token:
            kwargs["ContinuationToken"] = continuation_token

        resp = client.list_objects_v2(**kwargs)

        for obj in resp.get("Contents", []):
            key = obj["Key"]
            try:
                body = client.get_object(Bucket=bucket, Key=key)["Body"].read()
                data = json.loads(body)
                errors.append({
                    "case_id": data.get("case_id", ""),
                    "url": data.get("url", ""),
                    "error": data.get("error", ""),
                    "error_code": data.get("error_code", 0),
                })
            except Exception as e:
                errors.append({"case_id": key, "error": str(e)})

        if resp.get("IsTruncated"):
            continuation_token = resp["NextContinuationToken"]
        else:
            break

    return errors


def display_progress(client, bucket: str, target: int = 86485):
    """Display current progress."""
    results = count_objects(client, bucket, "results/")
    errors = count_objects(client, bucket, "errors/")
    total = results + errors
    pct = (total / target * 100) if target > 0 else 0

    now = datetime.now().strftime("%H:%M:%S")
    print(
        f"[{now}] "
        f"Results: {results:,} | "
        f"Errors: {errors:,} | "
        f"Total: {total:,}/{target:,} ({pct:.1f}%)"
    )


def main():
    parser = argparse.ArgumentParser(description="Check AustLII scraping progress")
    parser.add_argument(
        "--watch",
        type=int,
        metavar="SECONDS",
        help="Auto-refresh interval in seconds",
    )
    parser.add_argument(
        "--target",
        type=int,
        default=86485,
        help="Expected total cases (default: 86485)",
    )
    parser.add_argument(
        "--errors",
        action="store_true",
        help="List failed case details",
    )
    parser.add_argument(
        "--error-limit",
        type=int,
        default=50,
        help="Max errors to show (default: 50)",
    )
    args = parser.parse_args()

    # Validate config
    config_errors = validate_config(require_r2=True)
    if config_errors:
        for e in config_errors:
            print(f"CONFIG ERROR: {e}")
        print("\nCreate scripts/.env with required values.")
        sys.exit(1)

    client = get_r2_client()

    if args.errors:
        print("Fetching error details...\n")
        errors = list_error_ids(client, R2_BUCKET_NAME, limit=args.error_limit)
        for err in errors:
            print(
                f"  {err.get('case_id', '?')} | "
                f"code={err.get('error_code', '?')} | "
                f"{err.get('error', '?')}"
            )
        print(f"\nShowing {len(errors)} errors")
        return

    print("=" * 60)
    print("AustLII Scraper — Progress Monitor")
    print("=" * 60)

    if args.watch:
        print(f"Refreshing every {args.watch}s (Ctrl+C to stop)\n")
        try:
            while True:
                display_progress(client, R2_BUCKET_NAME, target=args.target)
                time.sleep(args.watch)
        except KeyboardInterrupt:
            print("\nStopped.")
    else:
        display_progress(client, R2_BUCKET_NAME, target=args.target)


if __name__ == "__main__":
    main()
