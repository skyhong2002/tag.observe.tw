#!/usr/bin/env python3
"""Import the public reference workbook without changing the crawl baseline.

Python 3 standard library only. Formula results come from the XLSX cached values;
we never evaluate spreadsheet formulas or replace missing values with zero.
"""

import argparse
import hashlib
import io
import json
import math
import posixpath
import re
import urllib.request
from urllib.parse import urlparse
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://docs.google.com/spreadsheets/d/1B5RsSVZSrjKSUFDFZ-2VVlU3-tpTN49J1YzLGOohalM"
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def cell_text(cell, strings):
    if cell.get("t") == "inlineStr":
        return "".join(t.text or "" for t in cell.findall(".//s:t", NS))
    value = cell.find("s:v", NS)
    text = value.text if value is not None and value.text else ""
    return strings[int(text)] if cell.get("t") == "s" and text else text


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def parse_workbook(payload, months):
    snapshots = []
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = [
                "".join(t.text or "" for t in item.findall(".//s:t", NS))
                for item in ET.fromstring(archive.read("xl/sharedStrings.xml"))
            ]
        relationships = {
            item.get("Id"): item.get("Target")
            for item in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        }
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        sheets = {sheet.get("name"): sheet for sheet in workbook.findall("s:sheets/s:sheet", NS)}
        for month in sorted(set(months), reverse=True):
            if not re.fullmatch(r"20\d{2}(0[1-9]|1[0-2])", month) or month not in sheets:
                raise ValueError(f"Unknown explicit YYYYMM sheet: {month}")
            sheet = sheets[month]
            target = relationships[sheet.get(f"{{{REL}}}id")]
            path = target.lstrip("/") if target.startswith("/") else posixpath.normpath("xl/" + target)
            worksheet = ET.fromstring(archive.read(path))
            rows = worksheet.findall("s:sheetData/s:row", NS)
            rel_path = posixpath.join(posixpath.dirname(path), "_rels", posixpath.basename(path) + ".rels")
            link_targets = {}
            if rel_path in archive.namelist():
                link_targets = {item.get("Id"): item.get("Target") for item in ET.fromstring(archive.read(rel_path))}
            links = {
                item.get("ref"): link_targets.get(item.get(f"{{{REL}}}id"))
                for item in worksheet.findall("s:hyperlinks/s:hyperlink", NS)
            }
            header = {re.sub(r"\d", "", c.get("r")): cell_text(c, strings).strip() for c in rows[0]}

            def column(label):
                return next((key for key, value in header.items() if value == label), None)

            name_col, traffic_col, growth_col = column("網站名"), column("流量"), column("成長")
            if not name_col or not traffic_col or not growth_col or name_col != "D":
                raise ValueError(f"{month}: unsupported headers; review the source before importing")
            domain_col = column("網址")
            sources = []
            for row in rows[1:]:
                cells = {re.sub(r"\d", "", c.get("r")): c for c in row}
                values = {key: cell_text(cell, strings).strip() for key, cell in cells.items()}
                name, category = values.get(name_col, ""), values.get("B", "")
                if not name or "新聞" not in category:
                    continue
                notes = []
                for key, label in [(traffic_col, "流量"), (growth_col, "月增減")]:
                    cell = cells.get(key)
                    if cell is not None:
                        formula = cell.find("s:f", NS)
                        if formula is not None and formula.text:
                            notes.append(f"原表{label}公式：={formula.text}")
                        if values.get(key) and number(values[key]) is None:
                            notes.append(f"原表{label}：{values[key]}")
                if re.search(r"/\s*\d", name):
                    notes.insert(0, "名稱含人工調整倍數，流量依原表結果呈現，未還原。")
                website = links.get(f"{domain_col}{row.get('r')}") or links.get(f"{name_col}{row.get('r')}")
                if website and urlparse(website).scheme not in ("http", "https"):
                    website = None
                sources.append({
                    "row": int(row.get("r")),
                    "name": name,
                    "domain": values.get(domain_col) or None,
                    "websiteUrl": website,
                    "classification": values.get("A") or None,
                    "category": category,
                    "rank": number(values.get(column("名次"))),
                    "traffic": number(values.get(traffic_col)),
                    "growth": number(values.get(growth_col)),
                    "notes": notes,
                })
            if not sources:
                raise ValueError(f"{month}: no news rows; refusing an empty import")
            snapshots.append({"month": month, "trafficColumn": traffic_col, "sources": sources})
    return snapshots


def available_months(payload):
    """Return month-shaped worksheet names, newest first.

    Public copies of the workbook sometimes expose a placeholder or copied
    worksheet for a month that is not yet published.  The parser still does
    the schema and row validation below; discovery only chooses which tabs to
    pass to it.
    """
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        return sorted(
            {
                sheet.get("name")
                for sheet in workbook.findall("s:sheets/s:sheet", NS)
                if sheet.get("name") and re.fullmatch(r"20\d{2}(0[1-9]|1[0-2])", sheet.get("name"))
            },
            reverse=True,
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="Previously downloaded XLSX; otherwise fetch the public workbook")
    parser.add_argument(
        "--months",
        nargs="+",
        required=True,
        help="Explicit YYYYMM tabs, or auto to import the three newest month tabs",
    )
    parser.add_argument("--output", type=Path, default=ROOT / "app/data/media-traffic.json")
    args = parser.parse_args()
    if args.input:
        payload = args.input.read_bytes()
    else:
        with urllib.request.urlopen(SOURCE + "/export?format=xlsx", timeout=60) as response:
            payload = response.read()
    if args.months == ["auto"]:
        months = available_months(payload)[:3]
        if len(months) < 1:
            raise ValueError("No YYYYMM worksheets found; refusing an empty import")
        print(f"Auto-selected worksheets: {' '.join(months)}")
    elif "auto" in args.months:
        raise ValueError("--months auto cannot be combined with explicit months")
    else:
        months = args.months
    snapshots = parse_workbook(payload, months)
    if args.months == ["auto"] and args.output.exists():
        # Refresh only the newest tabs while retaining reviewed history that is
        # no longer present in the workbook's rolling view.
        try:
            previous = json.loads(args.output.read_text())
            previous_snapshots = {
                snapshot.get("month"): snapshot
                for snapshot in previous.get("snapshots", [])
                if isinstance(snapshot, dict) and re.fullmatch(r"20\d{2}(0[1-9]|1[0-2])", str(snapshot.get("month")))
            }
            previous_snapshots.update({snapshot["month"]: snapshot for snapshot in snapshots})
            snapshots = [previous_snapshots[month] for month in sorted(previous_snapshots, reverse=True)]
        except (OSError, json.JSONDecodeError, TypeError):
            # A malformed old file must not prevent a validated fresh import.
            pass
    result = {
        "sourceUrl": SOURCE + "/edit?usp=sharing",
        "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourceSha256": hashlib.sha256(payload).hexdigest(),
        "unit": None,
        "scope": "各月份原表主題欄含「新聞」的列；保留缺值、原始分類與人工調整結果。",
        "snapshots": snapshots,
    }
    # Validate everything before replacing the snapshot. Never update classifications
    # or traffic-baseline.json implicitly: these have separate reviewed scopes.
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    for snapshot in snapshots:
        print(f"{snapshot['month']}: {len(snapshot['sources'])} news sources")
    print(f"Saved {args.output}")


if __name__ == "__main__":
    main()
