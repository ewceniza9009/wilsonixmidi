/**
 * WILSONIX MIDIKEY Elite - Cryptographic Asymmetric Public Key (ECDSA P-256)
 * Mathematical guarantee: Only the private key (held by Wilsonix Admin) can issue valid signatures.
 * This public key can only VERIFY signatures; it CANNOT be used to forge or generate license keys.
 */

export const LICENSE_PUBLIC_KEY_SPKI = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEkp2XnOkzTA5RgvRrCo/P9n8O3myNJRXrex2uB5DhBHUOiNg3CBSqcsb0aCi7PxR9H2GQlkoFaMaaIjgGT1sEPg==";
export const LICENSE_ALGORITHM = {
  name: "ECDSA",
  namedCurve: "P-256",
  hash: { name: "SHA-256" },
};
