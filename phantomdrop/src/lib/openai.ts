export async function verifyDelivery(base64Image: string): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Is there a package, box, bag, or parcel sitting at or near a doorstep, porch, entrance, or door in this image? Reply with only YES or NO.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "low",
              },
            },
          ],
        },
      ],
      max_tokens: 10,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI API error ${response.status}: ${JSON.stringify(err)}`
    );
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase();
  return answer === "YES";
}

export async function imageFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix, keep only base64 payload
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
