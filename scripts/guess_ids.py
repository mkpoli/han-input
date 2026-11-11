# /// script
# requires-python = ">=3.10"
# dependencies = ["cairosvg", "numpy", "pillow", "torch", "timm"]
# ///
"""Read a guessed IDS from every printed record that has a glyph image and no IDS.

Writes `guess` on the record: the sequence, han2ids' confidence and the model it came from. The
catalogue keeps attested descriptions in `kind: "ids"`; a guess never enters that field.

The reader lives in the sibling han2ids checkout (v0.4.0), whose checkpoint is a release asset:

    mkdir -p cache/han2ids
    curl -L -o cache/han2ids/han2ids-v0.4.pt \\
      https://github.com/mkpoli/han2ids/releases/download/v0.4.0/han2ids-v0.4.pt

Run it from the han2ids checkout so its package and venv are in reach:

    cd ../han2ids
    uv run --with cairosvg python ../han-input/scripts/guess_ids.py --batch 8

`--limit` stops after that many records, for a pilot. A record that already carries `guess` is
skipped, so an interrupted run resumes.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHARSETS = ROOT / "app/public/charsets"
HAN2IDS = Path(__file__).resolve().parent.parent.parent / "han2ids"
if str(HAN2IDS / "src") not in sys.path:
    sys.path.insert(0, str(HAN2IDS / "src"))

import cairosvg
import torch
from PIL import Image

from han2ids.grammar import ARITY, advance, valid_ids
from han2ids.infer import Han2IDS, tensor, variants
from han2ids.tokenizer import BOS, EOS

MODEL = "han2ids-v0.4"
SIZE = 224

# The sheets hold one <symbol> per ebag glyph; a record names the sheet and the symbol.
SHEETS: dict[str, dict[str, tuple[str, str]]] = {}


def sprite_image(sheet: str, symbol: str) -> Image.Image:
    if sheet not in SHEETS:
        text = (CHARSETS / "ebag-sprites" / f"{sheet}.svg").read_text()
        symbols = {}
        for match in re.finditer(r'<symbol id="([^"]+)" viewBox="([^"]+)">(.*?)</symbol>', text, re.S):
            symbols[match.group(1)] = (match.group(2), match.group(3))
        SHEETS[sheet] = symbols
    view, body = SHEETS[sheet][symbol]
    png = cairosvg.svg2png(
        bytestring=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}">{body}</svg>'.encode(),
        output_width=SIZE, output_height=SIZE, background_color="white",
    )
    return Image.open(io.BytesIO(png)).convert("L")


def image_of(record: dict) -> Image.Image | None:
    if record.get("sprite"):
        return sprite_image(record["sprite"]["sheet"], record["sprite"]["symbol"])
    if record.get("glyph"):
        return Image.open(CHARSETS / record["glyph"])
    return None


@torch.no_grad()
def read_batch(reader: Han2IDS, pictures: list[Image.Image]) -> list[tuple[str, float, str, bool]]:
    """Greedy decode one image's four crops with the encoder run once, then pick the reading the
    image model's own routine would pick: em-box unless another valid crop beats it by 0.08."""
    names: list[str] = []
    flat = []
    for picture in pictures:
        for name, variant in variants(picture):
            names.append(name)
            flat.append(tensor(variant))
    images = torch.stack(flat).to(reader.device)
    model = reader.model.eval()
    batch, device = images.size(0), images.device
    memory = model.encoder.forward_features(images)
    if memory.dim() == 4:
        memory = memory.flatten(2).transpose(1, 2)
    memory = model.memory_proj(memory)
    tokens = torch.full((batch, 1), BOS, dtype=torch.long, device=device)
    stacks = [[1] for _ in range(batch)]
    finished = torch.zeros(batch, dtype=torch.bool, device=device)
    scores = torch.zeros(batch, device=device)
    lengths = torch.zeros(batch, device=device)
    operators = torch.tensor([i for i, char in enumerate(reader.itos) if char in ARITY], device=device)
    operands = torch.tensor([i for i, char in enumerate(reader.itos) if i >= 4 and char not in ARITY], device=device)
    for step in range(48):
        length = tokens.size(1)
        target = model.tok(tokens) * math.sqrt(model.d_model)
        target = target + model.pos(torch.arange(length, device=device))[None]
        causal = torch.triu(torch.full((length, length), float("-inf"), device=device), 1)
        out = model.decoder(target, memory, tgt_mask=causal, tgt_key_padding_mask=tokens.eq(0))
        logprobs = torch.log_softmax(model.head(out)[:, -1].float(), dim=-1)
        mask = torch.full_like(logprobs, float("-inf"))
        for i in range(batch):
            if finished[i] or not stacks[i]:
                mask[i, EOS] = 0
            elif step == 0:
                mask[i, operators] = 0
            else:
                mask[i, operators] = 0
                mask[i, operands] = 0
        choice = (logprobs + mask).argmax(-1)
        scores += (logprobs + mask)[torch.arange(batch, device=device), choice]
        lengths += (~finished)
        tokens = torch.cat([tokens, choice[:, None]], 1)
        for i in range(batch):
            if finished[i]:
                continue
            if choice[i].item() == EOS:
                finished[i] = True
            else:
                advance(stacks[i], reader.itos[choice[i].item()])
        if finished.all():
            break
    confidence = (scores / lengths.clamp(min=1)).exp().tolist()
    out_tokens = tokens[:, 1:].tolist()
    readings = [
        (reader.vocab.decode(out_tokens[i]), float(confidence[i]), names[i], valid_ids(reader.vocab.decode(out_tokens[i])))
        for i in range(batch)
    ]
    picked = []
    for start in range(0, len(readings), 4):
        block = readings[start:start + 4]
        if not block[0][3]:
            valid = [i for i, item in enumerate(block) if item[3]]
            best = max(valid, key=lambda i: block[i][1]) if valid else 0
        else:
            best = 0
            for i in range(1, len(block)):
                if block[i][3] and block[i][1] > block[0][1] + 0.08:
                    best = i
        picked.append(block[best])
    return picked


def records_files() -> list[Path]:
    return sorted(CHARSETS.glob("*_records.json"))


def targets(files: list[Path], limit: int | None) -> list[tuple[Path, dict, int]]:
    found = []
    for path in files:
        data = json.loads(path.read_text())
        for index, record in enumerate(data.get("records", [])):
            if record.get("kind") == "ids" or record.get("guess"):
                continue
            if not (record.get("glyph") or record.get("sprite")):
                continue
            found.append((path, data, index))
            if limit and len(found) >= limit:
                return found
    return found


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, default=ROOT / "cache/han2ids/han2ids-v0.4.pt")
    parser.add_argument("--batch", type=int, default=8, help="images per encoder pass")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    found = targets(records_files(), args.limit)
    print(f"{len(found)} records with an image and no IDS", flush=True)
    reader = Han2IDS(args.checkpoint)
    print(f"device {reader.device}", flush=True)
    started = time.time()
    done = 0
    dirty: dict[Path, dict] = {}
    for start in range(0, len(found), args.batch):
        chunk = found[start:start + args.batch]
        pictures = []
        kept = []
        for path, data, index in chunk:
            try:
                picture = image_of(data["records"][index])
            except Exception as error:  # a missing sheet or cut image stays unguessed
                print(f"skip {path.name}#{index}: {error}", flush=True)
                continue
            if picture is not None:
                pictures.append(picture)
                kept.append((path, data, index))
        if not pictures:
            continue
        readings = read_batch(reader, pictures)
        for (path, data, index), (ids, confidence, variant, valid) in zip(kept, readings):
            if not valid:
                continue
            record = data["records"][index]
            record["guess"] = {
                "ids": ids,
                "confidence": round(confidence, 3),
                "model": MODEL,
                "variant": variant,
            }
            dirty[path] = data
        done += len(kept)
        if done % (args.batch * 20) == 0:
            elapsed = time.time() - started
            print(f"{done}/{len(found)} · {done / elapsed:.1f}/s · {elapsed:.0f}s", flush=True)
        if start % (args.batch * 100) == 0:
            for path, data in dirty.items():
                path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
            dirty.clear()
    for path, data in dirty.items():
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {done} guesses in {time.time() - started:.0f}s", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
