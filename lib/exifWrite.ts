import type { Coords } from "@/lib/geo";

// Canvas-based compression (see photo.ts) re-encodes the image from raw
// pixels, so it has no metadata to carry over — the original file's EXIF is
// gone by the time toBlob() runs. This rebuilds a minimal GPS-only EXIF
// segment from the coordinates we read off the original file, and splices it
// back into the compressed output, so the uploaded photo still carries its
// location. Deliberately GPS-only (no orientation/timestamp/camera info):
// canvas output is already upright, so copying the original Orientation tag
// back on top of already-corrected pixels would double-rotate the image in
// EXIF-aware viewers.

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const TIFF_SIZE = 140;

function decToDmsRational(
  absDecimal: number
): [number, number, number, number, number, number] {
  const totalSeconds = absDecimal * 3600;
  const deg = Math.floor(totalSeconds / 3600);
  const afterDeg = totalSeconds - deg * 3600;
  const min = Math.floor(afterDeg / 60);
  const sec = afterDeg - min * 60;
  // [degNum, degDen, minNum, minDen, secNum, secDen]
  return [deg, 1, min, 1, Math.round(sec * 1_000_000), 1_000_000];
}

// Builds a standalone EXIF APP1 segment (marker + TIFF + GPS IFD) with
// nothing but a GPS fix in it.
export function buildGpsExifSegment(coords: Coords): Uint8Array {
  const buf = new ArrayBuffer(TIFF_SIZE);
  const view = new DataView(buf);
  const little = true;

  // TIFF header: byte order "II", magic 42, IFD0 at offset 8.
  view.setUint8(0, 0x49);
  view.setUint8(1, 0x49);
  view.setUint16(2, 42, little);
  view.setUint32(4, 8, little);

  // IFD0: a single entry pointing at the GPS IFD (offset 26).
  view.setUint16(8, 1, little);
  view.setUint16(10, 0x8825, little); // GPS IFD pointer
  view.setUint16(12, 4, little); // LONG
  view.setUint32(14, 1, little);
  view.setUint32(18, 26, little);
  view.setUint32(22, 0, little); // no next IFD

  // GPS IFD at offset 26: 5 entries, tags in ascending order.
  const gpsStart = 26;
  view.setUint16(gpsStart, 5, little);

  const latRef = coords.latitude >= 0 ? "N" : "S";
  const lonRef = coords.longitude >= 0 ? "E" : "W";
  const [latD, latDd, latM, latMd, latS, latSd] = decToDmsRational(
    Math.abs(coords.latitude)
  );
  const [lonD, lonDd, lonM, lonMd, lonS, lonSd] = decToDmsRational(
    Math.abs(coords.longitude)
  );

  let e = gpsStart + 2;

  // GPSVersionID (required by spec for a GPS IFD to be considered valid).
  view.setUint16(e, 0x0000, little);
  view.setUint16(e + 2, 1, little); // BYTE
  view.setUint32(e + 4, 4, little);
  view.setUint8(e + 8, 2);
  view.setUint8(e + 9, 3);
  view.setUint8(e + 10, 0);
  view.setUint8(e + 11, 0);
  e += 12;

  // GPSLatitudeRef
  view.setUint16(e, 0x0001, little);
  view.setUint16(e + 2, 2, little); // ASCII
  view.setUint32(e + 4, 2, little); // 1 char + null
  view.setUint8(e + 8, latRef.charCodeAt(0));
  view.setUint8(e + 9, 0);
  e += 12;

  // GPSLatitude — 3 RATIONALs, stored out-of-line at offset 92.
  view.setUint16(e, 0x0002, little);
  view.setUint16(e + 2, 5, little); // RATIONAL
  view.setUint32(e + 4, 3, little);
  view.setUint32(e + 8, 92, little);
  e += 12;

  // GPSLongitudeRef
  view.setUint16(e, 0x0003, little);
  view.setUint16(e + 2, 2, little);
  view.setUint32(e + 4, 2, little);
  view.setUint8(e + 8, lonRef.charCodeAt(0));
  view.setUint8(e + 9, 0);
  e += 12;

  // GPSLongitude — 3 RATIONALs, stored out-of-line at offset 116.
  view.setUint16(e, 0x0004, little);
  view.setUint16(e + 2, 5, little);
  view.setUint32(e + 4, 3, little);
  view.setUint32(e + 8, 116, little);
  e += 12;

  view.setUint32(e, 0, little); // GPS IFD has no next IFD

  const writeRational = (offset: number, num: number, den: number) => {
    view.setUint32(offset, num, little);
    view.setUint32(offset + 4, den, little);
  };
  writeRational(92, latD, latDd);
  writeRational(100, latM, latMd);
  writeRational(108, latS, latSd);
  writeRational(116, lonD, lonDd);
  writeRational(124, lonM, lonMd);
  writeRational(132, lonS, lonSd);

  const payloadLen = EXIF_HEADER.length + TIFF_SIZE;
  const segment = new Uint8Array(4 + payloadLen);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = (payloadLen + 2) >> 8;
  segment[3] = (payloadLen + 2) & 0xff;
  segment.set(EXIF_HEADER, 4);
  segment.set(new Uint8Array(buf), 4 + EXIF_HEADER.length);
  return segment;
}

// Splices an EXIF APP1 segment into a JPEG blob, right after the SOI marker.
export async function injectExifSegment(
  blob: Blob,
  segment: Uint8Array
): Promise<Blob> {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return blob;
    const merged = new Uint8Array(2 + segment.length + (bytes.length - 2));
    merged.set(bytes.subarray(0, 2), 0);
    merged.set(segment, 2);
    merged.set(bytes.subarray(2), 2 + segment.length);
    return new Blob([merged], { type: "image/jpeg" });
  } catch {
    return blob;
  }
}
