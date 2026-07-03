export const runtime = "edge";

const VAPID_PUBLIC_KEY = "BOTRxmOOG-mT7D59Gs8Em2i4B9mjxPgAcnl9Hf7kyZ99-P8RMetAFvx5mxf9TM6xfG1kDgb6G26c6DJo9fTWgDM";

export async function GET() {
  return Response.json({ publicKey: VAPID_PUBLIC_KEY });
}
