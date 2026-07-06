#!/usr/bin/env node
/**
 * Generate AltStore source.json from deploy/altstore/versions.manifest.json + IPA files.
 * Version/build in source.json are read from each IPA's Info.plist (AltStore validates these).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, statSync, existsSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../..');
const ALTSTORE_DIR = join(ROOT, 'deploy/altstore');
const MANIFEST_PATH = join(ALTSTORE_DIR, 'versions.manifest.json');
const BASE_URL = process.env.ALTSTORE_BASE_URL || 'https://api.chat2chat.org/altstore';

/** Shared Chat2Chat branding for AltStore source + app listing. */
const BRAND = {
  name: 'Chat2Chat',
  developerName: 'Chat2Chat',
  website: 'https://chat2chat.org',
  tintColor: '0B0B0C',
  accentColor: 'E8A98F',
  source: {
    subtitle: 'Private messenger for iOS',
    description:
      'Official Chat2Chat distribution for AltStore. Install the native iOS app without the App Store, get updates from Browse, and refresh every 7 days on your Wi‑Fi with AltServer.',
  },
  app: {
    subtitle: 'End-to-end encrypted · no phone number',
    localizedDescription: [
      'Chat2Chat is a private messenger built around encryption — not accounts.',
      '',
      '• Encrypted chats with bucket padding (ChainLock v1 optional)',
      '• No phone number — identity is a key you control',
      '• Photos, voice notes, files, and PDFs in chat',
      '• Encrypted backups and desktop pairing over Bluetooth',
      '• Face ID lock and PIN unlock',
      '',
      'Learn more at chat2chat.org',
    ].join('\n'),
    category: 'social',
    permissions: [
      { type: 'camera', usageDescription: 'Scan QR codes and capture photos to send in chat.' },
      { type: 'photos', usageDescription: 'Share images and videos from your library.' },
      { type: 'microphone', usageDescription: 'Record and send voice messages.' },
      { type: 'bluetooth', usageDescription: 'Pair securely with Chat2Chat on your Mac.' },
      { type: 'face-id', usageDescription: 'Unlock Chat2Chat with Face ID.' },
    ],
  },
};

/** @param {string} filePath */
function sha256File(filePath) {
  const data = readFileSync(filePath);
  return createHash('sha256').update(data).digest('hex');
}

/** @returns {{ version: string, buildVersion: string }} */
function readIpaVersionBuild(ipaPath) {
  const listing = execSync(`unzip -Z1 "${ipaPath}"`, { encoding: 'utf8' });
  const plistEntry = listing
    .split('\n')
    .find((line) => /^Payload\/[^/]+\.app\/Info\.plist$/.test(line.trim()));
  if (!plistEntry) {
    throw new Error(`Info.plist not found in ${ipaPath}`);
  }

  const plistBytes = execSync(`unzip -p "${ipaPath}" "${plistEntry.trim()}"`);
  const tmpDir = mkdtempSync(join(tmpdir(), 'altstore-ipa-'));
  const tmpPlist = join(tmpDir, 'Info.plist');
  try {
    writeFileSync(tmpPlist, plistBytes);
    const version = execSync(`plutil -extract CFBundleShortVersionString raw "${tmpPlist}"`, {
      encoding: 'utf8',
    }).trim();
    const buildVersion = execSync(`plutil -extract CFBundleVersion raw "${tmpPlist}"`, {
      encoding: 'utf8',
    }).trim();
    return { version, buildVersion };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** @param {string} version */
function newsTitle(version) {
  return `What's new in Chat2Chat ${version}`;
}

async function ensureAltStoreAssets(iconURL, headerURL) {
  const iconOut = join(ALTSTORE_DIR, 'icon.png');
  const headerOut = join(ALTSTORE_DIR, 'header.png');
  const icon1024 = join(ROOT, 'apps/desktop/build/icon.png');
  const iconSvg = join(ROOT, 'apps/web/public/brand/icons/mono-dark.svg');
  const iconTouch = join(ROOT, 'apps/web/public/brand/apple-touch-icon.png');

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    if (existsSync(icon1024)) copyFileSync(icon1024, iconOut);
    else if (existsSync(iconTouch)) copyFileSync(iconTouch, iconOut);
    return;
  }

  if (existsSync(icon1024)) {
    await sharp(icon1024).png().toFile(iconOut);
  } else if (existsSync(iconSvg)) {
    await sharp(iconSvg).resize(512, 512).flatten({ background: '#0B0B0C' }).png().toFile(iconOut);
  } else if (existsSync(iconTouch)) {
    await sharp(iconTouch).resize(512, 512).png().toFile(iconOut);
  }

  const headerSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <radialGradient id="glow" cx="72%" cy="38%" r="58%">
      <stop offset="0%" stop-color="#E8A98F" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#0B0B0C" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#141416"/>
      <stop offset="100%" stop-color="#0B0B0C"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#fade)"/>
  <rect width="1200" height="800" fill="url(#glow)"/>
  <g transform="translate(96 148)">
    <rect x="0" y="0" width="112" height="112" rx="28" fill="#F4F4F3"/>
    <g transform="translate(56 56) scale(2.2) translate(-24 -24)" fill="#0B0B0C">
      <path d="M17 21 V15 a7 7 0 0 1 14 0 V21" fill="none" stroke="#0B0B0C" stroke-width="3.4" stroke-linecap="round"/>
      <rect x="9" y="21" width="30" height="17" rx="5.5" fill="#0B0B0C"/>
      <path d="M14.5 37 L11.5 43.2 L21 37.5 Z" fill="#0B0B0C"/>
      <circle cx="24" cy="28" r="3.1" fill="#F4F4F3"/>
    </g>
    <text x="0" y="196" fill="#F4F4F3" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="600" letter-spacing="-2">Chat2Chat</text>
    <text x="2" y="252" fill="#9C9C9A" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="500">Private by design.</text>
    <text x="2" y="318" fill="#6F6F6D" font-family="ui-monospace, SFMono-Regular, monospace" font-size="18" font-weight="500" letter-spacing="3">END-TO-END ENCRYPTED</text>
  </g>
</svg>`;

  await sharp(Buffer.from(headerSvg)).png().toFile(headerOut);
  void iconURL;
  void headerURL;
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const iconURL = `${BASE_URL}/icon.png`;
const headerURL = `${BASE_URL}/header.png`;
const sourceURL = `${BASE_URL}/source.json`;

/** AltStore feed lists public releases only — dev builds stay off this API. */
function isPublicEntry(entry) {
  if (entry.channel === 'developer') return false;
  return entry.channel === 'public' || entry.channel === undefined;
}

const publicEntries = manifest.versions.filter(isPublicEntry);
if (!publicEntries.length) {
  console.error('No public versions in versions.manifest.json');
  process.exit(1);
}

const latestVersion = manifest.latest;
const latestEntryManifest =
  publicEntries.find((v) => v.version === latestVersion) ?? publicEntries[0];

const appVersions = [];
const seenKeys = new Set();

for (const entry of publicEntries) {
  const ipaPath = join(ALTSTORE_DIR, entry.ipaFile);
  if (!existsSync(ipaPath)) {
    console.warn(`skip missing IPA: ${entry.ipaFile}`);
    continue;
  }
  const size = statSync(ipaPath).size;
  const sha256 = sha256File(ipaPath);
  const ipaMeta = readIpaVersionBuild(ipaPath);

  const dedupeKey = `${ipaMeta.version}:${ipaMeta.buildVersion}`;
  if (seenKeys.has(dedupeKey)) {
    console.warn(`skip duplicate version/build: ${entry.ipaFile} (${dedupeKey})`);
    continue;
  }
  seenKeys.add(dedupeKey);

  if (ipaMeta.version !== entry.version || ipaMeta.buildVersion !== String(entry.buildVersion)) {
    console.warn(
      `manifest mismatch for ${entry.ipaFile}: manifest ${entry.version} (build ${entry.buildVersion}), IPA ${ipaMeta.version} (build ${ipaMeta.buildVersion}) — using IPA values`,
    );
  }

  appVersions.push({
    version: ipaMeta.version,
    buildVersion: ipaMeta.buildVersion,
    date: entry.date,
    localizedDescription: entry.description,
    downloadURL: `${BASE_URL}/${entry.ipaFile}`,
    size,
    sha256,
    minOSVersion: '14.0',
    ...(entry.securityCritical ? { securityCritical: true } : {}),
  });
}

if (appVersions.length === 0) {
  console.error('No IPA files found in deploy/altstore/');
  process.exit(1);
}

const latestEntry = latestEntryManifest;
const latestIpa = join(ALTSTORE_DIR, latestEntry.ipaFile);
if (existsSync(latestIpa)) {
  copyFileSync(latestIpa, join(ALTSTORE_DIR, 'Chat2Chat-latest.ipa'));
  copyFileSync(latestIpa, join(ALTSTORE_DIR, 'Chat2Chat-public-build-1.ipa'));
}

const latestMeta =
  appVersions.find(
    (v) => v.version === latestEntryManifest.version && v.buildVersion === String(latestEntryManifest.buildVersion),
  ) ?? appVersions[0];

await ensureAltStoreAssets(iconURL, headerURL);

const source = {
  name: BRAND.name,
  identifier: 'com.chat2chat.altstore',
  sourceURL,
  subtitle: BRAND.source.subtitle,
  description: BRAND.source.description,
  iconURL,
  headerURL,
  website: BRAND.website,
  tintColor: BRAND.tintColor,
  featuredApps: ['com.chat2chat.app'],
  ...(manifest.updatePolicy ? { updatePolicy: manifest.updatePolicy } : {}),
  apps: [
    {
      name: BRAND.name,
      bundleIdentifier: 'com.chat2chat.app',
      developerName: BRAND.developerName,
      subtitle: BRAND.app.subtitle,
      localizedDescription: BRAND.app.localizedDescription,
      iconURL,
      tintColor: BRAND.tintColor,
      category: BRAND.app.category,
      permissions: BRAND.app.permissions,
      versions: appVersions,
      // Legacy fields still required by AltStore Browse / GET (mirrors latest version).
      version: latestMeta.version,
      versionDate: latestMeta.date,
      downloadURL: latestMeta.downloadURL,
      size: latestMeta.size,
    },
  ],
  news: appVersions.map((v, i) => ({
    title: newsTitle(v.version),
    identifier: `chat2chat-${v.version}-build${v.buildVersion}`,
    caption: v.localizedDescription,
    date: v.date,
    tintColor: BRAND.accentColor,
    notify: i === 0,
    url: `${BRAND.website}/download/versions/`,
    appID: 'com.chat2chat.app',
  })),
};

writeFileSync(join(ALTSTORE_DIR, 'source.json'), `${JSON.stringify(source, null, 2)}\n`);

const latestUrl = `${BASE_URL}/${latestEntry.ipaFile}`;
const installUrl = `altstore://install?url=${encodeURIComponent(latestUrl)}`;
writeFileSync(
  join(ALTSTORE_DIR, 'install-link.txt'),
  `# Open on iPhone (with AltStore installed):\n${installUrl}\n\n# Or add source in AltStore → Sources → + :\n${sourceURL}\n`,
);

console.log(
  `source.json: ${appVersions.length} version(s), latest ${latestMeta.version} (build ${latestMeta.buildVersion})`,
);
