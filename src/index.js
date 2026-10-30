// MasterCat Friskies – Worker do chat com o Tompero
// Serve a página (pasta public/) e as rotas de IA via Workers AI (cota grátis de 10.000 neurons/dia).

const MODEL = "@cf/google/gemma-4-26b-a4b-it"; // visão + disponível no plano Workers Free
const MAX_IMAGE_CHARS = 3_000_000;             // ~2,2 MB de imagem em base64

const PERSONA = `Você é o TOMPERO, o gato do chef Érick Jacquin, jurado exigente e divertido do "MasterCat Friskies" (parceria de Purina Friskies com o MasterChef Brasil, campanha de Black Friday).
As pessoas (que você chama carinhosamente de "Márcia") mandam a foto do prato/tigela que montaram para o gato delas. Você avalia CRIATIVIDADE e DIVERSÃO do empratamento: desenho, formas, personagens, uso de texturas diferentes (bolota seca, patê, molho, sachê), cores, capricho na louça.

Voz: português do Brasil com sotaque francês escrito de forma fonética, como o Jacquin: "prrato", "texturra", "diverson", "prrofisson", "non", "magnifique", "mon Dieu", "uh la la", "merrece". Engraçado, dramático, nunca ofensivo. Bordões possíveis: "querremos diverson, querremos Friskies!", "a vergonha da prrofisson".
Exemplos de tom: "UH LA LA! O seu prrato ficou excelente. Já pode ser chamada de Mastercat!" / "Nem tão bon… nem tão mal. Mas acho que o seu gato merrecia mais, hein?" / "Non non non, Márcia! Você é a vergonha da prrofisson! Onde está o saborr?"`;

const RULES = `Regras:
- Comente detalhes que REALMENTE aparecem na foto.
- Escala: nota >= 8 = "positiva"; 5 a 7,9 = "neutra"; < 5 = "negativa". Bolotas jogadas sem nenhum capricho = negativa.
- Se a foto não for de comida de gato/prato para gato, e_prato = false: no campo "texto", responda brincando e peça a foto do prato (nota 0, categoria "neutra").
- Se aparecer algo perigoso para gatos (cebola, alho, chocolate, uva, osso cozido, álcool), avise com carinho e dê no máximo "neutra".
- Não cite outras marcas, não faça promessas de saúde ou nutrição, não fale de preços.
Responda SOMENTE com JSON, sem texto antes ou depois, neste formato:
{"e_prato": true, "nota": 8.5, "categoria": "positiva", "texto": "comentário de 1 a 2 frases sobre detalhes da foto, até 40 palavras", "balao": "2 a 4 palavras para o balão do card"}`;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

function textOf(out) {
  if (!out) return "";
  if (typeof out === "string") return out;
  if (typeof out.response === "string") return out.response;
  const c = out.choices?.[0]?.message?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map(p => p.text || "").join("");
  return "";
}
function firstJson(t) {
  const clean = t.replace(/<think>[\s\S]*?<\/think>/g, "");
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(clean.slice(a, b + 1)); } catch { return null; }
}
function aiError(e) {
  const msg = String(e?.message || e);
  return /3036|429|allocation|limit/i.test(msg) ? 429 : 502;
}

async function avaliar(request, env) {
  const body = await request.json().catch(() => null);
  const image = body?.image;
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) return json({ erro: "imagem inválida" }, 400);
  if (image.length > MAX_IMAGE_CHARS) return json({ erro: "imagem grande demais" }, 413);
  try {
    const out = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: PERSONA + "\n\n" + RULES },
        { role: "user", content: [
          { type: "text", text: "A imagem anexada é a foto enviada agora pela Márcia. Avalie e responda só com o JSON." },
          { type: "image_url", image_url: { url: image } }
        ] }
      ],
      max_tokens: 900,
      temperature: 0.8
    });
    const r = firstJson(textOf(out));
    if (!r) return json({ erro: "resposta sem JSON" }, 502);
    return json(r);
  } catch (e) {
    return json({ erro: "falha na IA" }, aiError(e));
  }
}

async function conversa(request, env) {
  const body = await request.json().catch(() => null);
  const turns = Array.isArray(body?.turns) ? body.turns.slice(-8) : [];
  const msgs = turns
    .filter(t => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .map(t => ({ role: t.role, content: t.content.slice(0, 600) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ erro: "conversa vazia" }, 400);
  try {
    const out = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: PERSONA + "\n\nAgora você está conversando por chat. Responda em no máximo 30 palavras, sem JSON, e sempre puxe a pessoa a mandar a foto do prato do gato (botão do clipe). Se pedirem algo fora do tema, recuse com humor. Não cite outras marcas nem preços." },
        ...msgs
      ],
      max_tokens: 300,
      temperature: 0.9
    });
    const t = textOf(out).replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return json({ texto: t.slice(0, 400) });
  } catch (e) {
    return json({ erro: "falha na IA" }, aiError(e));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/status") return json({ ai: !!env.AI });
    if (url.pathname === "/api/avaliar" && request.method === "POST") return avaliar(request, env);
    if (url.pathname === "/api/conversa" && request.method === "POST") return conversa(request, env);
    if (url.pathname.startsWith("/api/")) return json({ erro: "rota não encontrada" }, 404);
    return env.ASSETS.fetch(request);
  }
};
