# MasterCat Friskies – Chat com o Tompero (Cloudflare)

Web app de chat em que o Tompero avalia a foto do prato do gato.
A avaliação usa o Workers AI (modelo Gemma 4 com visão), que tem 10.000 neurons grátis por dia na sua conta Cloudflare.

## Publicar (2 comandos)

No Terminal, dentro desta pasta:

```bash
npx wrangler login      # só na primeira vez: abre o navegador para autorizar a sua conta Cloudflare
npx wrangler deploy
```

No fim, o Wrangler mostra o endereço: `https://mastercat-tompero.<seu-subdominio>.workers.dev`.

## Sem Terminal (só a página, sem IA)

Cloudflare → Workers & Pages → Create → Upload static files → arraste a pasta `public`.
Nesse caso a página roda em modo demonstração: os pratos de exemplo têm notas fixas e fotos reais recebem uma nota estimada.

## Arquivos

- `public/` – a página e as imagens
- `src/index.js` – rotas `/api/avaliar` (foto) e `/api/conversa` (texto), com o prompt do Tompero
- `wrangler.jsonc` – configuração (nome do Worker, pasta da página, IA)

Se a cota grátis do dia acabar, a página cai sozinha para o modo demonstração até 21h (00:00 UTC).
