export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const hasKey = !!privateKey;

  return Response.json({
    hasPrivateKey: hasKey,
    privateKeyLength: privateKey?.length || 0,
    privateKeyPreview: privateKey
      ? privateKey.slice(0, 4) + "..." + privateKey.slice(-4)
      : null,
  });
}
