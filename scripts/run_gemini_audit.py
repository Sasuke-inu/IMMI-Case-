#!/usr/bin/env python3
"""Run Gemini 2.5 Flash-Lite audit on generated batch files.

Reads audit_batch_XXXX.txt files, sends each to Gemini, saves JSON responses.
Supports resuming from where it left off.

Usage:
    python scripts/run_gemini_audit.py
    python scripts/run_gemini_audit.py --concurrency 5 --start 1 --end 10  # test first 10
"""

import argparse
import asyncio
import json
import os
import re
import time
from pathlib import Path

import google.generativeai as genai

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH_DIR = os.path.join(PROJECT_ROOT, "downloaded_cases", "audit_batches")
RESULTS_DIR = os.path.join(PROJECT_ROOT, "downloaded_cases", "audit_results")

MODEL_NAME = "gemini-2.5-flash-lite"


def setup_api():
    key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("Set GOOGLE_API_KEY or GEMINI_API_KEY environment variable")
    genai.configure(api_key=key)


def list_batch_files(start=1, end=None):
    """List batch .txt files in order."""
    files = sorted(Path(BATCH_DIR).glob("audit_batch_*.txt"))
    # Filter to only numbered batch files (not _meta.json)
    result = []
    for f in files:
        match = re.search(r"audit_batch_(\d+)\.txt$", f.name)
        if match:
            num = int(match.group(1))
            if num >= start and (end is None or num <= end):
                result.append((num, f))
    return result


def result_path(batch_num):
    return os.path.join(RESULTS_DIR, f"audit_result_{batch_num:04d}.json")


def is_done(batch_num):
    p = result_path(batch_num)
    return os.path.exists(p) and os.path.getsize(p) > 10


def extract_json(text):
    """Extract JSON array or objects from response text."""
    # Try to find JSON blocks in markdown code fences
    fenced = re.findall(r"```(?:json)?\s*\n(.*?)```", text, re.DOTALL)
    if fenced:
        parts = []
        for block in fenced:
            block = block.strip()
            try:
                parts.append(json.loads(block))
            except json.JSONDecodeError:
                pass
        if parts:
            return parts

    # Try parsing the entire text as JSON
    try:
        return [json.loads(text)]
    except json.JSONDecodeError:
        pass

    # Try finding JSON objects/arrays with regex
    objects = re.findall(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", text, re.DOTALL)
    results = []
    for obj in objects:
        try:
            results.append(json.loads(obj))
        except json.JSONDecodeError:
            pass
    return results if results else None


async def process_batch(sem, model, batch_num, batch_file, stats):
    """Process a single batch file with Gemini."""
    if is_done(batch_num):
        stats["skipped"] += 1
        return

    async with sem:
        try:
            prompt = batch_file.read_text(encoding="utf-8")
            tokens_est = len(prompt) // 4

            print(f"  [{batch_num:4d}] Sending ~{tokens_est:,} tokens...", flush=True)
            t0 = time.time()

            response = await asyncio.to_thread(
                model.generate_content,
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=65536,
                    response_mime_type="application/json",
                ),
            )

            elapsed = time.time() - t0
            resp_text = response.text

            # Save raw response
            raw_path = os.path.join(RESULTS_DIR, f"audit_result_{batch_num:04d}_raw.txt")
            with open(raw_path, "w", encoding="utf-8") as f:
                f.write(resp_text)

            # Parse JSON
            parsed = extract_json(resp_text)
            if parsed:
                with open(result_path(batch_num), "w", encoding="utf-8") as f:
                    json.dump(parsed, f, indent=2, ensure_ascii=False)
                stats["success"] += 1
                # Count audit entries: look for dicts with "outcome" or "case_id"
                n_cases = 0
                for p in parsed:
                    if isinstance(p, list):
                        n_cases += sum(1 for item in p if isinstance(item, dict) and ("case_id" in item or "outcome" in item))
                    elif isinstance(p, dict) and ("case_id" in p or "outcome" in p):
                        n_cases += 1
                print(f"  [{batch_num:4d}] OK — {n_cases} audits in {elapsed:.1f}s", flush=True)
            else:
                stats["parse_error"] += 1
                print(f"  [{batch_num:4d}] WARN — response not valid JSON ({len(resp_text)} chars)", flush=True)

        except Exception as e:
            stats["error"] += 1
            err_msg = str(e)[:200]
            print(f"  [{batch_num:4d}] ERROR — {err_msg}", flush=True)

            # Save error for retry
            err_path = os.path.join(RESULTS_DIR, f"audit_result_{batch_num:04d}_error.txt")
            with open(err_path, "w", encoding="utf-8") as f:
                f.write(str(e))

            # Rate limit backoff
            if "429" in str(e) or "quota" in str(e).lower():
                print(f"  [{batch_num:4d}] Rate limited, waiting 60s...", flush=True)
                await asyncio.sleep(60)


async def main_async(args):
    setup_api()
    os.makedirs(RESULTS_DIR, exist_ok=True)

    model = genai.GenerativeModel(MODEL_NAME)
    batches = list_batch_files(start=args.start, end=args.end)

    if not batches:
        print("No batch files found!")
        return

    # Count already done
    already_done = sum(1 for num, _ in batches if is_done(num))
    remaining = len(batches) - already_done

    print(f"Gemini Audit — Model: {MODEL_NAME}")
    print(f"  Total batches: {len(batches)}")
    print(f"  Already done: {already_done}")
    print(f"  Remaining: {remaining}")
    print(f"  Concurrency: {args.concurrency}")
    print(f"  Est. cost: ~${remaining * 154_000 / 1_000_000 * 0.10 + remaining * 2000 / 1_000_000 * 0.40:.2f}")
    print()

    if remaining == 0:
        print("All batches already processed!")
        return

    stats = {"success": 0, "error": 0, "parse_error": 0, "skipped": 0}
    sem = asyncio.Semaphore(args.concurrency)
    t_start = time.time()

    tasks = [process_batch(sem, model, num, f, stats) for num, f in batches]
    await asyncio.gather(*tasks)

    elapsed = time.time() - t_start
    print(f"\n{'='*60}")
    print(f"  Completed in {elapsed:.0f}s ({elapsed/60:.1f}m)")
    print(f"  Success: {stats['success']}")
    print(f"  Skipped (already done): {stats['skipped']}")
    print(f"  Parse errors: {stats['parse_error']}")
    print(f"  API errors: {stats['error']}")
    print(f"\n  Results: {RESULTS_DIR}/")


def main():
    parser = argparse.ArgumentParser(description="Run Gemini audit on batch files")
    parser.add_argument("--concurrency", type=int, default=5,
                        help="Max concurrent API calls (default: 5)")
    parser.add_argument("--start", type=int, default=1,
                        help="Start from batch number (default: 1)")
    parser.add_argument("--end", type=int, default=None,
                        help="End at batch number (default: all)")
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
