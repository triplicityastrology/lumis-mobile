import { createHash } from "node:crypto";

const PROHIBITED_LABELS = ["web export", "mockup", "placeholder", "storybook", "figma export", "static web"];

export function inspectImage(buffer) {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { format: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { format: "jpeg", height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += length + 2;
    }
  }
  stop("IMAGE_FORMAT_INVALID");
}

export function validateCaptureBuffers(entries, control) {
  stopUnless(Array.isArray(entries) && entries.length === 13, "CAPTURE_COUNT_INVALID");
  const expected = control.captures.map(({ file }) => file);
  stopUnless(JSON.stringify(entries.map(({ file }) => file)) === JSON.stringify(expected), "CAPTURE_SET_INVALID");
  const hashes = new Set();
  let commonDimensions = null;
  return entries.map(({ file, buffer }, index) => {
    stopUnless(Buffer.isBuffer(buffer), "CAPTURE_BYTES_INVALID");
    const image = inspectImage(buffer);
    stopUnless(image.format === "png", "CAPTURE_FORMAT_INVALID");
    stopUnless(image.width < image.height, "CAPTURE_ORIENTATION_INVALID");
    const viewport = matchViewport(image, control.accepted_logical_viewports);
    stopUnless(viewport !== null, "CAPTURE_DIMENSIONS_INVALID");
    const dimensions = `${image.width}x${image.height}`;
    if (commonDimensions === null) commonDimensions = dimensions;
    stopUnless(commonDimensions === dimensions, "CAPTURE_VIEWPORT_INCONSISTENT");
    const metadata = buffer.toString("latin1").toLowerCase();
    stopUnless(PROHIBITED_LABELS.every((label) => !metadata.includes(label)), "NON_NATIVE_LABEL_DETECTED");
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    stopUnless(!hashes.has(sha256), "DUPLICATE_CAPTURE");
    hashes.add(sha256);
    return {
      file,
      state: control.captures[index].state,
      width: image.width,
      height: image.height,
      logical_viewport: { width: viewport.width, height: viewport.height },
      scale: viewport.scale,
      full_frame_safe_area_bounds: { x: 0, y: 0, width: image.width, height: image.height },
      sha256,
    };
  });
}

export function renderContactSheet(captures, captureRoot, references) {
  const cards = [
    ...references.map((item) => card(item.label, item.path, "Comparison reference only")),
    ...captures.map((item) => card(item.state, `${captureRoot}/${item.file}`, `${item.width}x${item.height}`)),
  ].join("\n");
  return `<!doctype html><meta charset="utf-8"><title>Care Circle native evidence</title><style>body{font-family:system-ui;background:#0b1728;color:#fff;margin:24px}h1{font-size:24px}.note{color:#d9c48d}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.card{background:#16273d;border:1px solid #38506d;padding:12px}.card img{display:block;width:100%;height:420px;object-fit:contain;background:#050b13}.card p{overflow-wrap:anywhere}</style><h1>Care Circle native capture evidence</h1><p class="note">Human comparison required. This sheet does not claim visual similarity.</p><div class="grid">${cards}</div>`;
}

function card(label, path, detail) {
  return `<section class="card"><h2>${escapeHtml(label)}</h2><img src="file://${escapeHtml(path)}" alt="${escapeHtml(label)}"><p>${escapeHtml(detail)}</p></section>`;
}

function matchViewport(image, viewports) {
  for (const viewport of viewports) {
    for (const scale of [1, 2, 3, 4]) {
      if (image.width === viewport.width * scale && image.height === viewport.height * scale) return { ...viewport, scale };
    }
  }
  return null;
}

function escapeHtml(value) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function stopUnless(condition, code) { if (!condition) stop(code); }
function stop(code) { throw new Error(`STOP_S2_T150_${code}`); }
