import { NextResponse } from "next/server";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const name = str(data.name);
  const email = str(data.email);
  const phone = str(data.phone);
  const subject = str(data.subject);
  const message = str(data.message);

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!message || message.length < 5) {
    return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
  }

  const [row] = await db
    .insert(contactMessages)
    .values({
      name,
      email,
      phone: phone || null,
      subject: subject || null,
      message,
    })
    .returning({ id: contactMessages.id });

  return NextResponse.json({ ok: true, id: row.id });
}
