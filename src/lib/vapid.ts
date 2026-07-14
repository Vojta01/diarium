/**
 * Shared VAPID configuration module.
 * 
 * The VAPID public key is read from NEXT_PUBLIC_VAPID_PUBLIC_KEY env var,
 * with the current key as a backwards-compatible default.
 */
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BDQqhS8ckDCRGmoE6gfdRsoM9rGTbP9188B_Ue-XpHV3oNG9bbkG3rpLLONLwVT3D_mJFEhAjzhE2inp_hc0POY";

export const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:diarium@example.com";
