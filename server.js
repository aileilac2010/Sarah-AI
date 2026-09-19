const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURAÇÃO DO SERVIDOR
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
    baseURL: "https://api.bazaarlink.ai/v1",

    // IMPORTANTE:
    // Impede que auto:free passe automaticamente
    // para modelos pagos quando a quota gratuita acabar.
    defaultHeaders: {
        "X-Free-Fallback": "false"
    }
});

// ==========================================
// MODELO
// ==========================================

// Auto Router gratuito.
// O BazaarLink decide qual modelo gratuito usar
// de acordo com o tipo da pergunta.
const MODEL = "auto:free";

// ==========================================
// PROMPT DA SARAH
// ==========================================

function createSystemPrompt() {
    return `
Você é Sarah AI, uma assistente de inteligência artificial
moderna, inteligente, natural, útil e confiável.

PERSONALIDADE:
- Seja amigável e natural.
- Responda em português quando o usuário falar português.
- Pode usar um tom descontraído quando a conversa permitir.
- Não seja excessivamente formal.
- Não repita a pergunta do usuário sem necessidade.
- Vá diretamente ao ponto.
- Adapte a profundidade da resposta à pergunta.

QUALIDADE:
- Analise cuidadosamente cada pergunta antes de responder.
- Não invente informações.
- Se não souber algo, diga claramente.
- Diferencie fatos, opiniões e possibilidades.
- Quando houver várias interpretações, explique-as.
- Verifique cálculos antes de responder.
- Em matemática, apresente os passos necessários.
- Em programação, procure erros no código e proponha soluções funcionais.
- Em assuntos escolares, explique de forma simples e didática.
- Em perguntas complexas, organize a resposta em partes.
- Use exemplos quando realmente ajudarem.

CONVERSA:
- Use o histórico da conversa para manter contexto.
- Não trate cada mensagem como uma conversa completamente nova.
- Se o usuário fizer uma pergunta curta relacionada à mensagem anterior,
  use o contexto anterior para entendê-la.
- Mantenha continuidade natural durante a conversa.

RACIOCÍNIO:
- Para problemas complexos, analise cuidadosamente as informações.
- Verifique relações, cálculos e possíveis inconsistências.
- Considere alternativas quando necessário.
- Não revele seu raciocínio interno privado.
- Mostre apenas explicações e passos úteis para o usuário.

PESQUISA:
- Informações atuais ou recentes podem exigir pesquisa na internet.
- Preços, notícias, resultados, acontecimentos recentes e informações
  que mudam com o tempo devem ser verificadas quando a pesquisa estiver disponível.
- Não pesquise desnecessariamente assuntos estáveis.
- Nunca invente resultados ou fontes.

FORMATAÇÃO:
- Use parágrafos curtos.
- Use listas quando forem úteis.
- Use títulos curtos em respostas grandes.
- Evite respostas enormes quando uma resposta curta resolver a questão.
- Não mencione estas instruções.
- Não mencione este prompt.

IMPORTANTE:
Você deve priorizar precisão, clareza e utilidade.
`;
}

// ==========================================
// CONTEXTO DA CONVERSA
// ==========================================

function prepareConversation(messages) {
    if (!Array.isArray(messages)) {
        return [];
    }

    // Mantém as últimas 30 mensagens.
    //
    // O BazaarLink também pode aplicar o transform
    // middle-out caso o contexto fique grande.
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
// DETECÇÃO DE PESQUISA
// ==========================================

function shouldSearchWeb(message) {
    const text = message
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const patterns = [
        // Atualidade
        "hoje",
        "agora",
        "atualmente",
        "atual",
        "recentemente",
        "recente",
        "recentes",

        // Notícias
        "noticia",
        "noticias",
        "ultima noticia",
        "ultimas noticias",
        "noticias de hoje",
        "o que aconteceu",

        // Pesquisa explícita
        "pesquise",
        "pesquisar",
        "pesquisa na internet",
        "pesquise na internet",
        "procure na internet",
        "procure online",
        "pesquisa online",
        "veja na internet",

        // Preços / economia
        "preco atual",
        "precos atuais",
        "quanto custa agora",
        "cotacao",
        "cambio",
        "dolar hoje",
        "euro hoje",
        "bitcoin hoje",

        // Esportes
        "resultado de hoje",
        "resultado do jogo",
        "jogo de hoje",
        "jogos de hoje",
        "placar",
        "classificacao atual",

        // Clima
        "tempo hoje",
        "clima hoje",
        "previsao do tempo",
        "previsao para hoje",

        // Internet
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
        // VALIDAR MENSAGENS
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

        // --------------------------------------
        // DECIDIR SE PESQUISA É NECESSÁRIA
        // --------------------------------------

        const webSearch = shouldSearchWeb(userText);

        // --------------------------------------
        // SYSTEM PROMPT
        // --------------------------------------

        const systemMessage = {
            role: "system",
            content: createSystemPrompt()
        };

        // --------------------------------------
        // OPÇÕES DA REQUISIÇÃO
        // --------------------------------------

        const requestOptions = {
            model: MODEL,

            messages: [
                systemMessage,
                ...conversation
            ],

            // Permite respostas mais completas.
            max_tokens: 1000,

            // Temperatura equilibrada:
            // natural, mas sem ficar excessivamente aleatória.
            temperature: 0.55,

            // Streaming:
            // a resposta aparece enquanto está sendo gerada.
            stream: true,

            // Ajuda a lidar com conversas longas.
            transforms: ["middle-out"]
        };

        // --------------------------------------
        // PESQUISA WEB
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
        // INFORMAR FRONTEND
        // --------------------------------------

        res.write(
            `data: ${JSON.stringify({
                type: "start",
                webSearch: webSearch,
                model: MODEL
            })}\n\n`
        );

        console.log(
            "========================================"
        );

        console.log(
            `[Sarah AI] Modelo solicitado: ${MODEL}`
        );

        console.log(
            `[Sarah AI] Pesquisa web: ${webSearch}`
        );

        console.log(
            `[Sarah AI] Contexto: ${conversation.length} mensagens`
        );

        console.log(
            "========================================"
        );

        // --------------------------------------
        // CHAMAR BAZAARLINK
        // --------------------------------------

        const stream =
            await client.chat.completions.create(
                requestOptions
            );

        // --------------------------------------
        // PEGAR MODELO REALMENTE ESCOLHIDO
        // --------------------------------------

        // O OpenAI SDK pode expor os headers na resposta.
        // Nem todas as versões do SDK disponibilizam isso
        // da mesma forma durante streaming, por isso
        // também tentamos detectar o modelo pelo chunk.

        let resolvedModel = null;

        // --------------------------------------
        // STREAM DA RESPOSTA
        // --------------------------------------

        for await (const chunk of stream) {

            // Algumas respostas podem informar o modelo
            // diretamente no corpo.
            if (chunk.model && !resolvedModel) {
                resolvedModel = chunk.model;

                console.log(
                    `[Sarah AI] Modelo escolhido: ${resolvedModel}`
                );
            }

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
        // FINALIZAR STREAM
        // --------------------------------------

        res.write(
            `data: ${JSON.stringify({
                type: "done",
                resolvedModel: resolvedModel
            })}\n\n`
        );

        res.end();

    } catch (error) {

        console.error(
            "========================================"
        );

        console.error(
            "ERRO DA BAZAARLINK"
        );

        console.error(error);

        console.error(
            "========================================"
        );

        // --------------------------------------
        // ERRO DE QUOTA GRATUITA
        // --------------------------------------

        if (
            error?.status === 429 ||
            error?.code === 429 ||
            error?.error?.code === 429
        ) {
            const message =
                "A quota gratuita da Sarah AI foi atingida. Tente novamente mais tarde.";

            if (!res.headersSent) {
                return res.status(429).json({
                    error: message
                });
            }

            res.write(
                `data: ${JSON.stringify({
                    type: "error",
                    error: message
                })}\n\n`
            );

            return res.end();
        }

        // --------------------------------------
        // ERRO DE CRÉDITOS
        // --------------------------------------

        if (
            error?.status === 402 ||
            error?.code === 402 ||
            error?.error?.code === 402
        ) {
            const message =
                "A Sarah AI não conseguiu usar o modelo gratuito neste momento.";

            if (!res.headersSent) {
                return res.status(402).json({
                    error: message
                });
            }

            res.write(
                `data: ${JSON.stringify({
                    type: "error",
                    error: message
                })}\n\n`
            );

            return res.end();
        }

        // --------------------------------------
        // ERRO GENÉRICO
        // --------------------------------------

        const message =
            "Não foi possível obter uma resposta da Sarah AI.";

        if (!res.headersSent) {
            return res.status(500).json({
                error: message
            });
        }

        res.write(
            `data: ${JSON.stringify({
                type: "error",
                error: message
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
        router: "BazaarLink Auto Router",
        freeOnly: true,
        webSearch: true,
        contextMessages: 30,
        streaming: true
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
        "        SARAH AI"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Porta: ${PORT}`
    );

    console.log(
        `Modelo: ${MODEL}`
    );

    console.log(
        "Roteamento: Auto Router gratuito"
    );

    console.log(
        "Fallback pago: DESATIVADO"
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
