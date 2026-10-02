#!/usr/bin/env python3
"""pdf_to_npc.py - extract Cohors Cthulhu NPC stat blocks from a sourcebook
PDF into this game's NPC interchange JSON format (schema/npc.schema.json).

Standalone counterpart to .claude/skills/import-npc/SKILL.md - both read the
SAME extraction rules from prompt.md and validate against the SAME schema,
so they can never drift apart. Use this one for batch conversion outside a
Claude Code session (no extra infra beyond an Anthropic API key); use the
skill for a one-off NPC inside an interactive session.

Usage:
    pip install anthropic pypdf jsonschema
    export ANTHROPIC_API_KEY=sk-ant-...
    python pdf_to_npc.py sourcebook.pdf --pages 40-55 --out ./npcs/

Output is a draft for human review before it goes anywhere near Roll20, not
a black box - always read run-log.md after a run.
"""
import argparse
import base64
import io
import json
import re
import sys
from pathlib import Path

import jsonschema
from anthropic import Anthropic
from pypdf import PdfReader, PdfWriter

SCRIPT_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = SCRIPT_DIR / "schema" / "npc.schema.json"
PROMPT_PATH = SCRIPT_DIR / "prompt.md"

# See lessons in this repo's own README about Anthropic model selection -
# claude-opus-5-5 is the recommended default for careful structured-output
# extraction work unless the caller asks for something else.
DEFAULT_MODEL = "claude-opus-5-5"

# Anthropic's PDF support caps requests at 32MB and 600 pages (100 for
# 200k-context models - not a concern for claude-opus-5-5's 1M window) -
# slicing to just the requested --pages keeps well clear of both limits and
# cuts token spend on a large sourcebook.
MAX_PDF_PAGES = 600


def parse_page_range(spec: str, page_count: int) -> tuple[int, int]:
    """'40-55' (1-indexed, inclusive) -> (0-indexed start, 0-indexed end-exclusive)."""
    match = re.fullmatch(r"(\d+)-(\d+)", spec.strip())
    if not match:
        raise ValueError(f"--pages must look like '40-55', got {spec!r}")
    start, end = int(match.group(1)), int(match.group(2))
    if start < 1 or end < start:
        raise ValueError(f"--pages range {spec!r} is not a valid ascending 1-indexed range")
    return start - 1, min(end, page_count)


def slice_pdf(pdf_path: Path, pages: str | None) -> bytes:
    reader = PdfReader(str(pdf_path))
    page_count = len(reader.pages)
    if pages is None:
        if page_count > MAX_PDF_PAGES:
            raise ValueError(
                f"{pdf_path} has {page_count} pages, over the {MAX_PDF_PAGES}-page API "
                "limit - pass --pages to select a subset."
            )
        with open(pdf_path, "rb") as f:
            return f.read()

    start, end = parse_page_range(pages, page_count)
    writer = PdfWriter()
    for i in range(start, end):
        writer.add_page(reader.pages[i])
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return slug or "npc"


def extract_json_payload(text: str):
    """Claude's response should be bare JSON, but tolerate a ```json fence
    or leading/trailing prose in case the model adds any."""
    text = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1)
    else:
        # Fall back to the outermost [...] or {...} span.
        start_candidates = [i for i in (text.find("["), text.find("{")) if i != -1]
        if start_candidates:
            start = min(start_candidates)
            end = max(text.rfind("]"), text.rfind("}"))
            if end > start:
                text = text[start:end + 1]
    return json.loads(text)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pdf", type=Path, help="Path to the sourcebook PDF")
    parser.add_argument("--pages", help="1-indexed inclusive page range, e.g. 40-55 (default: whole file)")
    parser.add_argument("--out", type=Path, default=Path("./npc-import-output"), help="Output directory")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Claude model ID (default: {DEFAULT_MODEL})")
    parser.add_argument("--focus", help="Optional: a specific NPC/monster name to extract, if the page range covers several")
    args = parser.parse_args()

    if not args.pdf.exists():
        sys.exit(f"error: {args.pdf} not found")

    schema = json.loads(SCHEMA_PATH.read_text())
    extraction_rules = PROMPT_PATH.read_text()

    print(f"Reading {args.pdf} (pages {args.pages or 'all'})...")
    pdf_bytes = slice_pdf(args.pdf, args.pages)
    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("ascii")

    focus_line = f"\n\nExtract only the NPC/monster named \"{args.focus}\" from these pages." if args.focus else "\n\nExtract every NPC/monster stat block found in these pages."

    system_prompt = (
        extraction_rules
        + "\n\n## Schema (authoritative)\n\n```json\n"
        + json.dumps(schema, indent=2)
        + "\n```\n\n"
        + "Respond with ONLY a JSON array of NPC objects matching this schema - "
        + "no prose, no markdown code fence, no explanation. If exactly one NPC "
        + "is found, still return it inside a one-element array."
        + focus_line
    )

    client = Anthropic()
    print(f"Calling {args.model}...")
    response = client.messages.create(
        model=args.model,
        max_tokens=16000,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": [
                {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": pdf_b64}},
                {"type": "text", "text": "Extract the NPC(s) from this document per the system instructions."},
            ],
        }],
    )

    text = next((b.text for b in response.content if b.type == "text"), "")
    if not text:
        sys.exit("error: model returned no text content - check response.stop_reason and try again")

    try:
        payload = extract_json_payload(text)
    except json.JSONDecodeError as e:
        sys.exit(f"error: could not parse model output as JSON ({e}). Raw output:\n{text}")

    npcs = payload if isinstance(payload, list) else [payload]
    if not npcs:
        sys.exit("No NPCs found in the given page range.")

    args.out.mkdir(parents=True, exist_ok=True)
    log_lines = [
        f"# Import run log",
        f"",
        f"- Source: `{args.pdf}` (pages {args.pages or 'all'})",
        f"- Model: `{args.model}`",
        f"- NPCs found: {len(npcs)}",
        f"",
    ]

    for npc in npcs:
        name = npc.get("name", "<unnamed>")
        slug = slugify(name)
        out_path = args.out / f"{slug}.json"
        try:
            jsonschema.validate(npc, schema)
            status = "OK - validates against schema"
        except jsonschema.ValidationError as e:
            status = f"NEEDS REVIEW - {e.message} (at {'/'.join(str(p) for p in e.path) or 'top level'})"

        out_path.write_text(json.dumps(npc, indent=2) + "\n")
        print(f"  {status}: {out_path}")
        log_lines.append(f"## {name}")
        log_lines.append(f"")
        log_lines.append(f"- File: `{out_path.name}`")
        log_lines.append(f"- Status: {status}")
        log_lines.append(f"")

    log_path = args.out / "run-log.md"
    log_path.write_text("\n".join(log_lines))
    print(f"\nWrote {len(npcs)} NPC(s) to {args.out}/ - see {log_path.name} before importing, every draft needs a human read.")


if __name__ == "__main__":
    main()
