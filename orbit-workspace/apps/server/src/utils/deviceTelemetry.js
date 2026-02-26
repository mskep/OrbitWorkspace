import net from 'node:net';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let geoip = null;
try {
  geoip = require('geoip-lite');
} catch {
  geoip = null;
}

const GEO_CACHE_TTL_MS = 60 * 60 * 1000;
const geoCache = new Map();

function readHeader(headers, keys) {
  for (const key of keys) {
    const value = headers?.[key];
    if (Array.isArray(value)) {
      if (value[0]) return String(value[0]);
    } else if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return null;
}

function sanitizeText(value, maxLen = 256) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function normalizeIp(rawIp) {
  if (!rawIp) return null;

  let ip = String(rawIp).trim();
  if (!ip) return null;

  // X-Forwarded-For may contain a list; first one is the original client.
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  // [IPv6]:port
  if (ip.startsWith('[') && ip.includes(']')) {
    ip = ip.slice(1, ip.indexOf(']'));
  }

  // IPv4:port
  const ipv4Port = ip.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/);
  if (ipv4Port) {
    ip = ipv4Port[1];
  }

  // ::ffff:127.0.0.1
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }

  return net.isIP(ip) ? ip : null;
}

function maskIp(ip) {
  if (!ip) return null;

  const version = net.isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split('.');
    return `${a}.${b}.***.***`;
  }

  if (version === 6) {
    const groups = ip.split(':').filter(Boolean);
    const head = groups.slice(0, 2).join(':') || '****';
    return `${head}:****:****:****`;
  }

  return null;
}

function resolveGeo(ip, headers) {
  const headerCountry = sanitizeText(readHeader(headers, ['cf-ipcountry', 'x-country-code', 'x-vercel-ip-country']), 16);
  const headerRegion = sanitizeText(readHeader(headers, ['x-region', 'x-vercel-ip-country-region']), 64);
  const headerCity = sanitizeText(readHeader(headers, ['x-city', 'x-vercel-ip-city']), 128);

  if (headerCountry || headerRegion || headerCity) {
    return {
      country: headerCountry || null,
      region: headerRegion || null,
      city: headerCity || null,
    };
  }

  if (!geoip || !ip || !net.isIP(ip)) {
    return { country: null, region: null, city: null };
  }

  const cached = geoCache.get(ip);
  const now = Date.now();
  if (cached && (now - cached.ts) < GEO_CACHE_TTL_MS) {
    return cached.value;
  }

  const info = geoip.lookup(ip) || {};
  const value = {
    country: sanitizeText(info.country, 16),
    region: sanitizeText(info.region, 64),
    city: sanitizeText(info.city, 128),
  };

  geoCache.set(ip, { ts: now, value });
  return value;
}

export function buildDeviceTelemetry(request) {
  const forwarded = readHeader(request?.headers, ['x-forwarded-for']);
  const candidate = forwarded || request?.ip || request?.socket?.remoteAddress || null;

  const ip = normalizeIp(candidate);
  const userAgent = sanitizeText(readHeader(request?.headers, ['user-agent']), 512);
  const geo = resolveGeo(ip, request?.headers || {});

  return {
    ip,
    ipMasked: maskIp(ip),
    userAgent,
    country: geo.country,
    region: geo.region,
    city: geo.city,
  };
}
