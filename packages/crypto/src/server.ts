/** Relay-safe exports — no libsignal native dependency. */
export {
  sign,
  verify,
  base64UrlEncode,
  base64UrlDecode,
  utf8ToBytes,
} from './identity.js';
