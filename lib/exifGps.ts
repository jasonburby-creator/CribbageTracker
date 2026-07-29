import type { Coords } from "@/lib/geo";

// Reads GPS coordinates out of a JPEG's EXIF block, if present. Must run on
// the *original* file the user picked — photo.ts's canvas-based compression
// strips all EXIF, so this is the only point in the pipeline where the data
// still exists. Only understands JPEG/EXIF (what phone cameras produce);
// anything else (HEIC, PNG, a screenshot) resolves to null.

const TAG_GPS_IFD = 0x8825;
const TAG_GPS_LAT_REF = 1;
const TAG_GPS_LAT = 2;
const TAG_GPS_LON_REF = 3;
const TAG_GPS_LON = 4;
const TYPE_RATIONAL = 5;

export async function readGpsFromJpeg(file: File): Promise<Coords | null> {
  try {
    if (file.type && !file.type.includes("jpeg") && !file.type.includes("jpg")) {
      return null;
    }
    // EXIF is always in the first segment or two, right after the JPEG SOI marker.
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) break; // not a marker — bail out
      if (marker === 0xffda) break; // start of scan: no more metadata follows
      const segLen = view.getUint16(offset + 2);
      if (marker === 0xffe1 && segLen >= 8) {
        const segStart = offset + 4;
        if (
          view.getUint32(segStart) === 0x45786966 && // "Exif"
          view.getUint16(segStart + 4) === 0x0000
        ) {
          return parseExifGps(view, segStart + 6);
        }
      }
      offset += 2 + segLen;
    }
    return null;
  } catch {
    return null;
  }
}

function parseExifGps(view: DataView, tiffStart: number): Coords | null {
  if (tiffStart + 8 > view.byteLength) return null;
  const little = view.getUint16(tiffStart) === 0x4949; // "II"
  const ifd0Start = tiffStart + view.getUint32(tiffStart + 4, little);
  const gpsIfdOffset = findTagValue(view, ifd0Start, little, TAG_GPS_IFD);
  if (gpsIfdOffset == null) return null;

  const gpsIfdStart = tiffStart + gpsIfdOffset;
  const latRef = readAsciiTag(view, gpsIfdStart, little, TAG_GPS_LAT_REF);
  const lonRef = readAsciiTag(view, gpsIfdStart, little, TAG_GPS_LON_REF);
  const lat = readRationalTriple(view, tiffStart, gpsIfdStart, little, TAG_GPS_LAT);
  const lon = readRationalTriple(view, tiffStart, gpsIfdStart, little, TAG_GPS_LON);
  if (!lat || !lon) return null;

  const toDecimal = (d: number, m: number, s: number) => d + m / 60 + s / 3600;
  let latitude = toDecimal(lat[0], lat[1], lat[2]);
  let longitude = toDecimal(lon[0], lon[1], lon[2]);
  if (latRef === "S") latitude = -latitude;
  if (lonRef === "W") longitude = -longitude;
  if (!isFinite(latitude) || !isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null; // zeroed tag, not a real fix
  return { latitude, longitude };
}

function findTagValue(
  view: DataView,
  ifdStart: number,
  little: boolean,
  wantedTag: number
): number | null {
  const count = view.getUint16(ifdStart, little);
  for (let i = 0; i < count; i++) {
    const entry = ifdStart + 2 + i * 12;
    if (view.getUint16(entry, little) === wantedTag) {
      return view.getUint32(entry + 8, little);
    }
  }
  return null;
}

function readAsciiTag(
  view: DataView,
  ifdStart: number,
  little: boolean,
  wantedTag: number
): string | null {
  const count = view.getUint16(ifdStart, little);
  for (let i = 0; i < count; i++) {
    const entry = ifdStart + 2 + i * 12;
    if (view.getUint16(entry, little) === wantedTag) {
      return String.fromCharCode(view.getUint8(entry + 8));
    }
  }
  return null;
}

function readRationalTriple(
  view: DataView,
  tiffStart: number,
  ifdStart: number,
  little: boolean,
  wantedTag: number
): [number, number, number] | null {
  const count = view.getUint16(ifdStart, little);
  for (let i = 0; i < count; i++) {
    const entry = ifdStart + 2 + i * 12;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    if (tag === wantedTag && type === TYPE_RATIONAL) {
      // 3 RATIONALs (deg, min, sec) = 24 bytes, always stored out-of-line.
      const dataOffset = tiffStart + view.getUint32(entry + 8, little);
      const rational = (j: number) => {
        const num = view.getUint32(dataOffset + j * 8, little);
        const den = view.getUint32(dataOffset + j * 8 + 4, little);
        return den ? num / den : 0;
      };
      return [rational(0), rational(1), rational(2)];
    }
  }
  return null;
}
