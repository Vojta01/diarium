export const runtime = "edge";

const VAPID_PUBLIC_KEY = "BDQqhS8ckDCRGmoE6gfdRsoM9rGTbP9188B_Ue-XpHV3oNG9bbkG3rpLLONLwVT3D_mJFEhAjzhE2inp_hc0POY";

export async function GET() {
  return Response.json({ publicKey: VAPID_PUBLIC_KEY });
}
