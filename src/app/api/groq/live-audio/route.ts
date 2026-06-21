import { NextRequest, NextResponse } from "next/server";

const groqModel = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
const groqTranscriptionModel =
  process.env.GROQ_TRANSCRIPTION_MODEL ?? "whisper-large-v3-turbo";

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function transcribeAudio(file: File) {
  const formData = new FormData();
  formData.append("file", file, file.name || "speech.webm");
  formData.append("model", groqTranscriptionModel);
  formData.append("response_format", "json");
  formData.append("language", "en");
  formData.append("temperature", "0");

  const response = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq transcription failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<{ text?: string }>;
}

async function createGroqChatCompletion(messages: GroqMessage[]) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: groqModel,
        messages,
        temperature: 0.4,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq chat failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<{
    choices: Array<{ message: { content: string | null } }>;
  }>;
}

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "Missing GROQ_API_KEY" },
      { status: 500 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("audio");
  const meetingName = formData.get("meetingName");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  const transcription = await transcribeAudio(file);
  const transcript = transcription.text?.trim() ?? "";

  if (transcript.length < 4) {
    return NextResponse.json({ transcript, response: "" });
  }

  const groqResponse = await createGroqChatCompletion([
    {
      role: "system",
      content: [
        "You are Synapse API, a concise live meeting assistant.",
        "The user is speaking during a live call.",
        "Reply naturally in one or two short sentences.",
        "Do not mention transcription or audio processing.",
        meetingName ? `Meeting name: ${meetingName}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    {
      role: "user",
      content: transcript,
    },
  ]);

  return NextResponse.json({
    transcript,
    response: groqResponse.choices[0]?.message.content?.trim() ?? "",
  });
}
