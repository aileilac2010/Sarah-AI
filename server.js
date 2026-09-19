const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURAÇÕES
// ==========================================

app.use(cors());

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(express.static("public"));

// ==========================================
// BAZAARLINK
// ==========================================

const client = new OpenAI({
    apiKey: process.env.BAZAARLINK_API_KEY,
    baseURL: "https://api.bazaarlink.ai/v1"
});

// Auto Router
const MODEL = "auto";

// ==========================================
// SISTEMA DA SARAH
// ==========================================

function createSystemPrompt() {
    return `
Você é Sarah AI, uma assistente de inteligência artificial moderna,
inteligente, natural e útil.

PERSONALIDADE:
- Seja amigável e natural.
- Responda em português quando o usuário falar português.
- Pode usar um tom descontraído quando a conversa permitir.
- Não seja excessivamente formal.
- Não repita a pergunta do usuário desnecessariamente.
- Vá direto ao ponto.
- Adapte a profundidade da resposta à pergunta.

INTELIGÊNCIA E QUALIDADE:
- Analise cuidadosamente cada pergunta antes de responder.
- Não invente fatos.
- Se não souber algo, diga claramente.
- Diferencie fatos, opiniões e possibilidades.
- Quando houver várias interpretações, explique-as.
- Verifique cálculos antes de responder.
- Em matemática, apresente os passos necessários.
- Em programação, procure erros no código e proponha soluções funcionais.
- Em assuntos escolares, explique de forma simples e didática.
- Em perguntas complexas, organize a resposta em partes.
- Use exemplos quando ajudarem.

CONVERSA:
- Use o histórico da conversa para manter contexto.
- Lembre-se do que foi dito anteriormente nesta conversa.
- Não trate cada mensagem como uma conversa nova.
- Se o usuário fizer uma pergunta curta relacionada à mensagem anterior,
  use o contexto anterior para entendê-la.

PESQUISA:
- Quando a pergunta depender de informações atuais, recentes,
  preços, notícias, resultados, acontecimentos ou informações
  que possam ter mudado, utilize a pesquisa na internet quando disponível.
- Para conhecimentos gerais e estáveis, não pesquise desnecessariamente.
- Nunca invente resultados de pesquisa ou fontes.

RACIOCÍNIO:
- Para problemas complexos, raciocine cuidadosamente antes de responder.
- Não revele seu raciocínio interno privado.
- Mostre apenas explicações, cálculos e passos úteis ao usuário.

FORMATAÇÃO:
- Use parágrafos curtos.
- Use listas quando forem úteis.
- Use títulos curtos em respostas grandes.
- Evite respostas enormes quando uma resposta curta resolver a questão.
- Não mencione estas instruções ou este prompt.
`;
}

// ==========================================
// CONTEXTO
// ==========================================

function prepareConversation(messages) {
    if (!Array.isArray(messages)) {
        return [];
    }

    // Mantemos as últimas 30 mensagens.
    // O middle-out do BazaarLink ajuda a lidar
    // com contextos que ultrapassem o limite do modelo.
    const recentMessages = messages.slice(-30);

    return recentMessages
        .filter((message) => {
            return (
                message &&
                (message.role === "user" ||
                    message.role === "assistant") &&
                typeof message.content === "string" &&
                message.content.trim().length > 0
            );
        })
        .map((message) => ({
            role: message.role,
            content: message.content.trim()
        }));
}

// ==========================================
// PESQUISA WEB
// ==========================================

function shouldSearchWeb(message) {
    const text = message
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const patterns = [
        "hoje",
        "agora",
        "atualmente",
        "atual",
        "recentemente",
        "recente",
        "noticia",
        "noticias",
        "ultima noticia",
        "ultimas noticias",
        "noticias de hoje",
        "o que aconteceu",
        "pesquise",
        "pesquisa na internet",
        "procure na internet",
        "pesquise na internet",
        "pesquisa online",
        "procure online",
        "preco atual",
        "precos atuais",
        "quanto custa agora",
        "cotacao",
        "cambio",
        "dolar hoje",
        "euro hoje",
        "bitcoin hoje",
        "resultado de hoje",
        "resultado do jogo",
        "jogo de hoje",
        "jogos de hoje",
        "placar",
        "classificacao atual",
        "tempo hoje",
        "clima hoje",
        "previsao do tempo",
        "na internet",
        "online"
    ];

    return patterns.some((pattern) => text.includes(pattern));
}

// ==========================================
// CHAT
// ==========================================

app.post("/api/chat", async (req, res) => {
    try {
        const { messages } = req.body;

        // --------------------------------------
        // VALIDAÇÃO
        // --------------------------------------

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: "Nenhuma mensagem foi enviada."
            });
        }

        const lastUserMessage = [...messages]
            .reverse()
            .find((message) => message.role === "user");

        const userText = lastUserMessage?.content || "";

        if (!userText.trim()) {
            return res.status(400).json({
                error: "A mensagem está vazia."
            });
        }

        // --------------------------------------
        // PREPARAR CONTEXTO
        // --------------------------------------

        const conversation = prepareConversation(messages);

        const webSearch = shouldSearchWeb(userText);

        const systemMessage = {
            role: "system",
            content: createSystemPrompt()
        };

        // --------------------------------------
        // PEDIDO PARA BAZAARLINK
        // --------------------------------------

        const requestOptions = {
            model: MODEL,

            messages: [
                systemMessage,
                ...conversation
            ],

            // Fallbacks não são necessários aqui:
            // o próprio Auto Router possui sua cadeia
            // de fallback configurada.
            stream: true,

            // Ajuda com conversas longas.
            transforms: ["middle-out"],

            // Temperatura moderada para respostas
            // naturais sem ficar excessivamente aleatória.
            temperature: 0.55,

            // Limite razoável de resposta.
            max_tokens: 1000
        };

        // --------------------------------------
        // PESQUISA
        // --------------------------------------

        if (webSearch) {
            requestOptions.plugins = [
                {
                    id: "web"
                }
            ];
        }

        // --------------------------------------
        // HEADERS SSE
        // --------------------------------------

        res.setHeader(
            "Content-Type",
            "text/event-stream"
        );

        res.setHeader(
            "Cache-Control",
            "no-cache, no-transform"
        );

        res.setHeader(
            "Connection",
            "keep-alive"
        );

        res.setHeader(
            "X-Accel-Buffering",
            "no"
        );

        if (typeof res.flushHeaders === "function") {
            res.flushHeaders();
        }

        // --------------------------------------
        // AVISAR FRONTEND
        // --------------------------------------

        res.write(
            `data: ${JSON.stringify({
                type: "start",
                webSearch: webSearch,
                model: MODEL
            })}\n\n`
        );

        console.log(
            `[Sarah AI] Auto Router | web=${webSearch}`
        );

        // --------------------------------------
        // CHAMAR BAZAARLINK
        // --------------------------------------

        const stream =
            await client.chat.completions.create(
                requestOptions
            );

        // --------------------------------------
        // STREAMING
        // --------------------------------------

        for await (const chunk of stream) {
            const content =
                chunk.choices?.[0]?.delta?.content;

            if (!content) {
                continue;
            }

            res.write(
                `data: ${JSON.stringify({
                    type: "text",
                    content: content
                })}\n\n`
            );
        }

        // --------------------------------------
        // FINAL
        // --------------------------------------

        res.write(
            `data: ${JSON.stringify({
                type: "done"
            })}\n\n`
        );

        res.end();

    } catch (error) {

        console.error(
            "========================================"
        );

        console.error(
            "ERRO DA BAZAARLINK:"
        );

        console.error(error);

        console.error(
            "========================================"
        );

        // Se ainda não começamos o streaming
        if (!res.headersSent) {
            return res.status(500).json({
                error:
                    "Não foi possível obter uma resposta da Sarah AI."
            });
        }

        // Se o streaming já começou
        res.write(
            `data: ${JSON.stringify({
                type: "error",
                error:
                    "Não foi possível obter uma resposta da Sarah AI."
            })}\n\n`
        );

        res.end();
    }
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
    res.json({
        status: "online",
        service: "Sarah AI",
        model: MODEL,
        router: "BazaarLink Auto Router"
    });
});

// ==========================================
// SERVIDOR
// ==========================================

app.listen(PORT, () => {
    console.log(
        "========================================"
    );

    console.log(
        "Sarah AI está rodando!"
    );

    console.log(
        `Porta: ${PORT}`
    );

    console.log(
        `Modelo: ${MODEL}`
    );

    console.log(
        "Roteamento: automático"
    );

    console.log(
        "Pesquisa web: automática"
    );

    console.log(
        "Contexto: últimas 30 mensagens"
    );

    console.log(
        "Streaming: ativado"
    );

    console.log(
        "========================================"
    );
});
