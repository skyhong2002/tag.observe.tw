import importlib.util
import io
import unittest
import zipfile

from pathlib import Path

spec = importlib.util.spec_from_file_location("import_media_traffic", Path(__file__).with_name("import-media-traffic.py"))
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


def workbook(header, rows, hyperlinks="", relationships=""):
    """Small XLSX fixture with a non-sequential relationship target."""
    ns = importer.NS["s"]
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("xl/workbook.xml", f'<workbook xmlns="{ns}" xmlns:r="{importer.REL}"><sheets><sheet name="202608" sheetId="3" r:id="rId7"/></sheets></workbook>')
        archive.writestr("xl/_rels/workbook.xml.rels", '<Relationships><Relationship Id="rId7" Target="worksheets/sheet42.xml"/></Relationships>')
        archive.writestr("xl/worksheets/sheet42.xml", f'<worksheet xmlns="{ns}" xmlns:r="{importer.REL}"><sheetData><row r="1">{header}</row>{rows}</sheetData>{hyperlinks}</worksheet>')
        if relationships:
            archive.writestr("xl/worksheets/_rels/sheet42.xml.rels", relationships)
    return output.getvalue()


def workbook_with_months(months):
    ns = importer.NS["s"]
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        sheets = "".join(f'<sheet name="{month}" sheetId="{i}" r:id="rId{i}"/>' for i, month in enumerate(months, 1))
        relationships = "".join(
            f'<Relationship Id="rId{i}" Target="worksheets/sheet{i}.xml"/>' for i, _ in enumerate(months, 1)
        )
        archive.writestr("xl/workbook.xml", f'<workbook xmlns="{ns}" xmlns:r="{importer.REL}"><sheets>{sheets}</sheets></workbook>')
        archive.writestr("xl/_rels/workbook.xml.rels", f"<Relationships>{relationships}</Relationships>")
        for i, _ in enumerate(months, 1):
            archive.writestr(f"xl/worksheets/sheet{i}.xml", f'<worksheet xmlns="{ns}"/>')
    return output.getvalue()


def text_cell(ref, value):
    return f'<c r="{ref}" t="inlineStr"><is><t>{value}</t></is></c>'


class ImportMediaTrafficTest(unittest.TestCase):
    def test_available_months_discovers_newest_month_tabs(self):
        payload = workbook_with_months(["202601", "notes", "202610", "202609", "2026-old"])
        self.assertEqual(importer.available_months(payload), ["202610", "202609", "202601"])

    def test_hyperlinks_supply_website_without_fabricating_original_domain(self):
        header = ''.join(text_cell(ref, value) for ref, value in [("D1", "網站名"), ("E1", "流量"), ("F1", "成長")])
        rows = ''.join('<row r="%d">%s%s</row>' % (i, text_cell(f"B{i}", "新聞"), text_cell(f"D{i}", "媒體")) for i in [2, 3])
        hyperlinks = '<hyperlinks><hyperlink ref="D2" r:id="news"/><hyperlink ref="D3" r:id="unsafe"/></hyperlinks>'
        relationships = '<Relationships><Relationship Id="news" Target="https://news.example/section"/><Relationship Id="unsafe" Target="javascript:alert(1)"/></Relationships>'
        sources = importer.parse_workbook(workbook(header, rows, hyperlinks, relationships), ["202608"])[0]["sources"]
        self.assertEqual(sources[0]["websiteUrl"], "https://news.example/section")
        self.assertIsNone(sources[0]["domain"])
        self.assertIsNone(sources[1]["websiteUrl"])

    def test_header_mapping_cached_formulas_missing_zero_and_news_scope(self):
        header = ''.join(text_cell(ref, value) for ref, value in [
            ("D1", "網站名"), ("E1", "網址"), ("F1", "流量"), ("G1", "成長"),
        ])
        identity = text_cell("B2", "新聞, 社論") + text_cell("D2", "媒體 /3")
        rows = f'<row r="2">{identity}<c r="F2"><f>2.3/3</f><v>0.7666666667</v></c><c r="G2" t="e"><v>#DIV/0!</v></c></row>'
        rows += '<row r="3">' + text_cell("B3", "新聞") + text_cell("D3", "零流量") + '<c r="F3"><v>0</v></c></row>'
        rows += '<row r="4">' + text_cell("B4", "新聞") + text_cell("D4", "未提供") + '</row>'
        rows += '<row r="5">' + text_cell("B5", "電商") + text_cell("D5", "非新聞") + '<c r="F5"><v>100</v></c></row>'
        sources = importer.parse_workbook(workbook(header, rows), ["202608"])[0]["sources"]
        self.assertEqual(len(sources), 3)
        self.assertEqual(sources[0]["traffic"], 0.7666666667)
        self.assertIsNone(sources[0]["growth"])
        self.assertIsNone(sources[0]["domain"])
        self.assertIn("原表流量公式：=2.3/3", sources[0]["notes"])
        self.assertIn("原表月增減：#DIV/0!", sources[0]["notes"])
        self.assertEqual(sources[1]["traffic"], 0)
        self.assertIsNone(sources[2]["traffic"])

    def test_old_month_column_shift_is_read_by_header(self):
        header = ''.join(text_cell(ref, value) for ref, value in [("D1", "網站名"), ("E1", "流量"), ("F1", "成長")])
        rows = '<row r="8">' + text_cell("B8", "新聞") + text_cell("D8", "UDN") + '<c r="E8"><v>39.96</v></c><c r="F8"><v>-0.0246</v></c></row>'
        source = importer.parse_workbook(workbook(header, rows), ["202608"])[0]["sources"][0]
        self.assertEqual(source["traffic"], 39.96)
        self.assertEqual(source["growth"], -0.0246)
        self.assertEqual(source["row"], 8)

    def test_unknown_schema_or_month_fails_instead_of_guessing(self):
        payload = workbook(text_cell("D1", "網站名") + text_cell("E1", "網站"), "")
        with self.assertRaisesRegex(ValueError, "unsupported headers"):
            importer.parse_workbook(payload, ["202608"])
        with self.assertRaisesRegex(ValueError, "Unknown explicit"):
            importer.parse_workbook(payload, ["202607"])


if __name__ == "__main__":
    unittest.main()
