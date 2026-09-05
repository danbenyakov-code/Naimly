export async function sendLeadNotification(input: { to: string; businessName: string; lead: { name: string; phone: string; email: string; message: string } }) {
  const endpoint = process.env.EMAIL_API_URL;
  const secret = process.env.EMAIL_API_SECRET;
  if (!endpoint || !secret || !input.to) return { sent: false, reason: "not_configured" } as const;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
    body: JSON.stringify({
      to: input.to,
      template: "new-lead",
      subject: `פנייה חדשה מהכרטיס של ${input.businessName}`,
      variables: input,
    }),
    cache: "no-store",
  });
  return response.ok ? { sent: true } as const : { sent: false, reason: "provider_error" } as const;
}
