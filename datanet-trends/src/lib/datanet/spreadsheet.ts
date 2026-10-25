import type { MenuRow, Shop } from "@/lib/datanet/types";

const HEADERS = [
  "category_el",
  "category_en",
  "name_el",
  "name_en",
  "description_el",
  "description_en",
  "price_eur",
  "price_note_el",
  "price_note_en",
  "available",
  "media_kind",
  "media_url",
  "efood_text_el",
  "source_code",
  "has_options",
  "prev_price_eur",
  "observed_on",
  "source_url",
] as const;

function cells(row: MenuRow): string[] {
  return [
    row.categoryEl,
    row.categoryEn,
    row.nameEl,
    row.nameEn,
    row.descriptionEl,
    row.descriptionEn,
    row.price == null ? "" : String(row.price),
    row.priceNoteEl,
    row.priceNoteEn,
    row.available ? "yes" : "no",
    row.mediaKind,
    row.mediaUrl,
    row.catalogTextEl,
    row.sourceCode,
    row.hasOptions ? "yes" : "no",
    row.prevPrice == null ? "" : String(row.prevPrice),
    row.observedOn,
    row.sourceUrl,
  ];
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(rows: MenuRow[]): string {
  const lines = [HEADERS.join(",")];
  for (const row of rows) lines.push(cells(row).map(csvEscape).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function xml(value: string): string {
  return value
    .split("&").join("&" + "amp;")
    .split("<").join("&" + "lt;")
    .split(">").join("&" + "gt;")
    .split('"').join("&" + "quot;");
}

function crc32(data: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function storeZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const enc = new TextEncoder();
  for (const file of files) {
    const name = enc.encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, file.data);
    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, file.data.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(name, 46);
    central.push(cen);
    offset += local.length + file.data.length;
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const part of central) centralSize += part.length;
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  const chunks = [...parts, ...central, end];
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let p = 0;
  for (const chunk of chunks) {
    out.set(chunk, p);
    p += chunk.length;
  }
  return out;
}

export function toOds(shop: Shop, rows: MenuRow[]): Uint8Array {
  const enc = new TextEncoder();
  const header = HEADERS.map((h) => `<table:table-cell office:value-type="string"><text:p>${xml(h)}</text:p></table:table-cell>`).join("");
  const body = rows
    .map((row) => {
      const tds = cells(row)
        .map((value, index) => {
          if (index === 6 && value !== "") {
            return `<table:table-cell office:value-type="float" office:value="${xml(value)}"><text:p>${xml(value)}</text:p></table:table-cell>`;
          }
          return `<table:table-cell office:value-type="string"><text:p>${xml(value)}</text:p></table:table-cell>`;
        })
        .join("");
      return `<table:table-row>${tds}</table:table-row>`;
    })
    .join("");
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" office:version="1.2">
<office:body><office:spreadsheet>
<table:table table:name="${xml(shop.slug)}">
<table:table-row>${header}</table:table-row>
${body}
</table:table>
</office:spreadsheet></office:body></office:document-content>`;
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;
  return storeZip([
    { name: "mimetype", data: enc.encode("application/vnd.oasis.opendocument.spreadsheet") },
    { name: "content.xml", data: enc.encode(content) },
    { name: "META-INF/manifest.xml", data: enc.encode(manifest) },
  ]);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
