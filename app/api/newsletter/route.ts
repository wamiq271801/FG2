import { NextRequest, NextResponse } from "next/server";

/** Mock newsletter subscription. */
export function POST(req: NextRequest) {
  return req
    .json()
    .then((b) => {
      const email = typeof b?.email === "string" ? b.email : "";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return NextResponse.json({ error: "Invalid email" }, { status: 422 });
      }
      return NextResponse.json({ ok: true });
    })
    .catch(() => NextResponse.json({ error: "Invalid body" }, { status: 400 }));
}
