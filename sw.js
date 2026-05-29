const CACHE_VERSION = 'focusflow-v4';
const VIRTUAL_PNG_ICON_PATH = '/FocusFlow/assets/icon-192.png';
const PNG_ICON_SIZE = 192;
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC32_TABLE = createCrc32Table();

function createCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }

    table[index] = value >>> 0;
  }

  return table;
}

function writeUint32(target, offset, value) {
  target[offset] = (value >>> 24) & 255;
  target[offset + 1] = (value >>> 16) & 255;
  target[offset + 2] = (value >>> 8) & 255;
  target[offset + 3] = value & 255;
}

function concatBytes(chunks) {
  const totalLength = chunks.reduce((length, chunk) => length + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function crc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;

  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }

  return ((b << 16) | a) >>> 0;
}

function createPngChunk(type, data) {
  const typeBytes = new Uint8Array(type.length);

  for (let index = 0; index < type.length; index += 1) {
    typeBytes[index] = type.charCodeAt(index);
  }

  const length = new Uint8Array(4);
  const checksum = new Uint8Array(4);
  const crcInput = concatBytes([typeBytes, data]);

  writeUint32(length, 0, data.length);
  writeUint32(checksum, 0, crc32(crcInput));

  return concatBytes([length, typeBytes, data, checksum]);
}

function createStoredZlibStream(data) {
  const chunks = [new Uint8Array([0x78, 0x01])];
  let offset = 0;

  while (offset < data.length) {
    const remaining = data.length - offset;
    const blockLength = Math.min(65535, remaining);
    const isFinalBlock = offset + blockLength >= data.length;
    const header = new Uint8Array(5);

    header[0] = isFinalBlock ? 1 : 0;
    header[1] = blockLength & 255;
    header[2] = (blockLength >>> 8) & 255;
    header[3] = (~blockLength) & 255;
    header[4] = ((~blockLength) >>> 8) & 255;

    chunks.push(header, data.subarray(offset, offset + blockLength));
    offset += blockLength;
  }

  const checksum = new Uint8Array(4);
  writeUint32(checksum, 0, adler32(data));
  chunks.push(checksum);

  return concatBytes(chunks);
}

function setPixel(pixels, x, y, red, green, blue, alpha = 255) {
  if (x < 0 || x >= PNG_ICON_SIZE || y < 0 || y >= PNG_ICON_SIZE) return;

  const offset = ((y * PNG_ICON_SIZE) + x) * 4;
  pixels[offset] = red;
  pixels[offset + 1] = green;
  pixels[offset + 2] = blue;
  pixels[offset + 3] = alpha;
}

function drawRect(pixels, x, y, width, height, red, green, blue) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      setPixel(pixels, column, row, red, green, blue);
    }
  }
}

function drawCircle(pixels, centerX, centerY, radius, red, green, blue) {
  const radiusSquared = radius * radius;

  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;

      if ((dx * dx) + (dy * dy) <= radiusSquared) {
        setPixel(pixels, x, y, red, green, blue);
      }
    }
  }
}

function createIconPixels() {
  const pixels = new Uint8Array(PNG_ICON_SIZE * PNG_ICON_SIZE * 4);

  for (let y = 0; y < PNG_ICON_SIZE; y += 1) {
    for (let x = 0; x < PNG_ICON_SIZE; x += 1) {
      const progress = (x + y) / ((PNG_ICON_SIZE - 1) * 2);
      const red = Math.round(79 + (87 - 79) * progress);
      const green = Math.round(70 + (80 - 70) * progress);
      const blue = Math.round(229 + (224 - 229) * progress);
      setPixel(pixels, x, y, red, green, blue);
    }
  }

  drawRect(pixels, 40, 60, 112, 88, 244, 244, 245);
  drawRect(pixels, 40, 60, 112, 20, 207, 214, 237);

  for (const [x, y] of [[64, 100], [96, 100], [128, 100], [64, 124], [96, 124]]) {
    drawCircle(pixels, x, y, 6, 79, 70, 229);
  }

  for (let step = 0; step <= 115; step += 1) {
    const x = 50 + step;
    const y = Math.round(158 - (Math.sin(step / 115 * Math.PI * 1.5) * 5));
    drawCircle(pixels, x, y, 2, 174, 183, 255);
  }

  return pixels;
}

function createVirtualPngIconBytes() {
  const pixels = createIconPixels();
  const rowLength = 1 + (PNG_ICON_SIZE * 4);
  const raw = new Uint8Array(rowLength * PNG_ICON_SIZE);

  for (let y = 0; y < PNG_ICON_SIZE; y += 1) {
    const rawOffset = y * rowLength;
    const pixelOffset = y * PNG_ICON_SIZE * 4;
    raw[rawOffset] = 0;
    raw.set(pixels.subarray(pixelOffset, pixelOffset + (PNG_ICON_SIZE * 4)), rawOffset + 1);
  }

  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, PNG_ICON_SIZE);
  writeUint32(ihdr, 4, PNG_ICON_SIZE);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return concatBytes([
    PNG_SIGNATURE,
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', createStoredZlibStream(raw)),
    createPngChunk('IEND', new Uint8Array())
  ]);
}

function createVirtualPngIconResponse() {
  return new Response(createVirtualPngIconBytes(), {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'image/png'
    }
  });
}

const APP_SHELL = [
  '/FocusFlow/',
  '/FocusFlow/index.html',
  '/FocusFlow/app.js',
  '/FocusFlow/styles.css',
  '/FocusFlow/manifest.json',
  '/FocusFlow/assets/logo-focusflow.svg',
  '/FocusFlow/assets/icon-192.svg',
  '/FocusFlow/assets/icon-512.svg',
  '/FocusFlow/assets/maskable-icon-192.svg',
  '/FocusFlow/assets/maskable-icon-512.svg',
  '/FocusFlow/assets/apple-touch-icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL)
        .then(() => cache.put(VIRTUAL_PNG_ICON_PATH, createVirtualPngIconResponse())))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  const isNavigation = request.mode === 'navigate';
  const isVirtualPngIcon = requestUrl.origin === self.location.origin && requestUrl.pathname === VIRTUAL_PNG_ICON_PATH;
  const isSameOriginAsset = requestUrl.origin === self.location.origin && requestUrl.pathname.startsWith('/FocusFlow/');

  if (isVirtualPngIcon) {
    event.respondWith(
      caches.match(VIRTUAL_PNG_ICON_PATH).then((cached) => cached || createVirtualPngIconResponse())
    );
    return;
  }

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/FocusFlow/', copy));
          return response;
        })
        .catch(() => caches.match('/FocusFlow/index.html').then((cached) => cached || caches.match('/FocusFlow/')))
    );
    return;
  }

  if (isSameOriginAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});
