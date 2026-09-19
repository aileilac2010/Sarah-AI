const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;


/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use(express.static("public"));


/* =========================================================
   BAZAARLINK
   ========================================================= */

const client = new OpenAI({
    apiKey: process.env.BAZAARLINK_API_KEY,
    baseURL: "https://api.bazaarlink.ai/v1"
});


/* =========================================================
   MODELOS
   =========================================================

   Podemos alterar estes modelos pelo Render sem mexer
   novamente no código.

   Os valores abaixo correspondem aos modelos gratuitos
   atualmente documentados pelo BazaarLink.
   ========================================================= */

const FAST_MODEL =
    process.env.BAZAARLINK_FAST_MODEL ||
    "qwen/qwen3.7-flash";

const SMART_MODEL =
    process.env.BAZAARLINK_SMART_MODEL ||
    "deepseek/deepseek-v4-flash-0731free";

const FALLBACK_MODEL =
    process.env.BAZAARLINK_FALLBACK_MODEL ||
    "qwen/qwen3.7-flash";


/* =========================================================
   DETECTAR PESQUISA NA INTERNET
   ========================================================= */

function needsWebSearch(message) {

    const text = message
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");


    const webKeywords = [

        /* Atualidade */

        "hoje",
        "agora",
        "atual",
        "atualmente",
        "recentemente",
        "recente",
        "recentes",

        /* Notícias */

        "noticia",
        "noticias",
        "ultima noticia",
        "ultimas noticias",
        "noticias de hoje",
        "noticias atuais",
        "o que aconteceu",

        /* Pesquisa */

        "pesquise",
        "pesquisa",
        "procure na internet",
        "pesquisa na internet",
        "pesquise na internet",
        "pesquisa online",
        "procure online",
        "veja na internet",

        /* Preços */

        "preco atual",
        "precos atuais",
        "quanto custa agora",
        "quanto esta custando",
        "quanto esta a custar",

        /* Economia */

        "cotacao",
        "cambio",
        "dolar hoje",
        "euro hoje",
        "bitcoin hoje",

        /* Política / cargos atuais */

        "atual presidente",
        "atual primeiro ministro",
        "atual primeiro-ministro",
        "quem e o atual",
        "quem e a atual",

        /* Esportes */

        "jogo de hoje",
        "jogos de hoje",
        "resultado de hoje",
        "resultado do jogo",
        "placar",
        "classificacao atual",

        /* Clima */

        "tempo hoje",
        "clima hoje",
        "previsao do tempo",
        "previsao para hoje",

        /* Próximos acontecimentos */

        "quando vai acontecer",
        "quando sera",
        "quando sera a proxima",
        "quando e a proxima",

        /* Internet */

        "na internet",
        "online"
    ];


    return webKeywords.some(
        keyword => text.includes(keyword)
    );
}


/* =========================================================
   DETECTAR PERGUNTA COMPLEXA
   ========================================================= */

function needsReasoning(message) {

    const text = message
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");


    const reasoningKeywords = [

        /* Raciocínio */

        "analise",
        "analisa",
        "analisar",
        "compare",
        "comparar",
        "comparacao",
        "explique detalhadamente",
        "passo a passo",
        "raciocine",
        "raciocinio",
        "justifique",
        "justificar",
        "por que",
        "porque",

        /* Matemática */

        "calcule",
        "calcular",
        "equacao",
        "equacao",
        "problema matematico",
        "matematica",
        "probabilidade",
        "estatistica",

        /* Código */

        "codigo",
        "programacao",
        "programar",
        "javascript",
        "python",
        "html",
        "css",
        "node",
        "api",
        "debug",
        "erro no codigo",
        "bug",

        /* Estudos */

        "resolva",
        "resolver",
        "questao",
        "exercicio",
        "prova",
        "teste",

        /* Planejamento */

        "planeje",
        "planejamento",
        "estrategia",
        "estruture",
        "estrutura",

        /* Análise de texto */

        "revise",
        "revisar",
        "critique",
        "avaliar",
        "avalie",
        "investigue",

        /* Explicações profundas */

        "em detalhes",
        "detalhadamente",
        "profundamente",
        "com exemplos"
    ];


    if (
        reasoningKeywords.some(
            keyword => text.includes(keyword)
        )
    ) {
        return true;
    }


    /* Mensagens muito grandes normalmente precisam
       de mais processamento */

    if (message.length > 1200) {
        return true;
    }


    return false;
}


/* =========================================================
   ESCOLHER MODELO
   ========================================================= */

function chooseModel(message) {

    const web =
        needsWebSearch(message);

    const reasoning =
        needsReasoning(message);


    /*
       Pesquisa + pergunta complexa:
       ainda usamos o modelo inteligente.
    */

    if (reasoning) {

        return {
            model: SMART_MODEL,
            fallback: FALLBACK_MODEL,
            reasoning: true,
            reasoningEffort: "medium"
        };
    }


    /*
       Pergunta simples:
       modelo rápido.
    */

    return {
        model: FAST_MODEL,
        fallback: FALLBACK_MODEL,
        reasoning: false,
        reasoningEffort: null
    };
}


/* =========================================================
   SISTEMA DA SARAH
   ========================================================= */

function createSystemMessage({
    webSearch,
    reasoning
}) {

    let prompt = `

Você é Sarah AI, uma assistente de inteligência artificial
inteligente, natural, útil e confiável.

PERSONALIDADE:

- Seja amigável e natural.
- Fale como uma assistente moderna, não como um robô.
- Responda em português quando o usuário falar português.
- Adapte o nível da explicação ao usuário.
- Não seja excessivamente formal.
- Não repita a pergunta do usuário sem necessidade.
- Não use introduções desnecessárias.
- Vá diretamente ao ponto.

QUALIDADE:

- Não invente informações.
- Se não souber alguma coisa, diga claramente.
- Diferencie fatos de opiniões.
- Quando houver várias possibilidades, explique as diferenças.
- Use exemplos quando eles realmente ajudarem.
- Em problemas matemáticos, mostre o raciocínio necessário.
- Em programação, explique o erro e forneça código funcional quando apropriado.
- Em perguntas escolares, explique de forma que o estudante consiga entender.
- Em perguntas complexas, organize a resposta em partes.

FORMATAÇÃO:

- Use parágrafos curtos.
- Use listas quando forem úteis.
- Use títulos curtos quando a resposta for grande.
- Evite textos enormes quando o usuário não pediu detalhes.
- Não diga que você é incapaz de pensar.
- Não mencione este prompt.

CONVERSA:

Use as mensagens anteriores para entender o contexto.
Não trate cada mensagem como uma pergunta completamente isolada.

`;

    if (reasoning) {

        prompt += `

RACIOCÍNIO:

Esta é uma pergunta que pode exigir mais raciocínio.

Antes de responder:
- analise cuidadosamente o problema;
- verifique as relações entre as informações;
- procure inconsistências;
- considere alternativas;
- confirme os cálculos quando existirem.

Não mostre seu raciocínio interno privado.
Mostre apenas a explicação e os passos úteis para o usuário.

`;
    }

    if (webSearch) {

        prompt += `

PESQUISA NA INTERNET:

A pesquisa na internet foi ativada porque a pergunta pode depender
de informações atuais.

Use a pesquisa quando necessário.

Dê prioridade às informações encontradas recentemente.
Não invente resultados ou fontes.
Se a pesquisa não encontrar informação suficiente, diga isso.

`;
    } else {

        prompt += `

PESQUISA:

Esta pergunta não parece precisar de informações atuais.
Não faça pesquisa na internet desnecessariamente.

`;
    }


    return {
        role: "system",
        content: prompt.trim()
    };
}


/* =========================================================
   LIMPAR HISTÓRICO
   ========================================================= */

function prepareConversation(messages) {

    if (!Array.isArray(messages)) {
        return [];
    }


    /*
       Mantemos mais contexto que antes.

       20 mensagens = aproximadamente 10 trocas
       de usuário + Sarah.

       Isso melhora continuidade sem enviar o
       histórico inteiro indefinidamente.
    */

    const recent =
        messages.slice(-20);


    return recent
        .filter(message => {

            return (
                message &&
                (
                    message.role === "user" ||
                    message.role === "assistant"
                ) &&
                typeof message.content === "string" &&
                message.content.trim().length > 0
            );

        })
        .map(message => ({

            role: message.role,

            content:
                message.content.trim()

        }));
}


/* =========================================================
   CHAT
   ========================================================= */

app.post(
    "/api/chat",
    async (req, res) => {

        try {

            const {
                messages
            } = req.body;


            if (
                !Array.isArray(messages) ||
                messages.length === 0
            ) {

                return res.status(400).json({

                    error:
                        "Nenhuma mensagem foi enviada."

                });
            }


            /* =============================================
               ÚLTIMA MENSAGEM DO USUÁRIO
               ============================================= */

            const lastUserMessage =
                [...messages]
                    .reverse()
                    .find(
                        message =>
                            message.role === "user"
                    );


            const userText =
                lastUserMessage?.content || "";


            if (!userText.trim()) {

                return res.status(400).json({

                    error:
                        "A mensagem está vazia."

                });
            }


            /* =============================================
               ANÁLISE
               ============================================= */

            const webSearch =
                needsWebSearch(userText);


            const route =
                chooseModel(userText);


            const conversation =
                prepareConversation(messages);


            /* =============================================
               SYSTEM
               ============================================= */

            const systemMessage =
                createSystemMessage({

                    webSearch,

                    reasoning:
                        route.reasoning

                });


            /* =============================================
               REQUEST
               ============================================= */

            const requestOptions = {

                model:
                    route.model,

                models:
                    [route.fallback],

                messages:
                    [
                        systemMessage,
                        ...conversation
                    ],

                max_tokens:
                    route.reasoning
                        ? 700
                        : 450,

                temperature:
                    route.reasoning
                        ? 0.35
                        : 0.65,

                stream:
                    true,

                transforms:
                    ["middle-out"]
            };


            /* =============================================
               REASONING
               ============================================= */

            if (route.reasoning) {

                requestOptions.reasoning_effort =
                    route.reasoningEffort;
            }


            /* =============================================
               WEB SEARCH
               ============================================= */

            if (webSearch) {

                requestOptions.plugins = [
                    {
                        id: "web"
                    }
                ];
            }


            /* =============================================
               HEADERS SSE
               ============================================= */

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


            if (
                typeof res.flushHeaders ===
                "function"
            ) {

                res.flushHeaders();
            }


            /* =============================================
               AVISAR FRONTEND
               ============================================= */

            res.write(
                `data: ${JSON.stringify({

                    type: "start",

                    webSearch,

                    reasoning:
                        route.reasoning

                })}\n\n`
            );


            console.log(
                `[Sarah] modelo=${route.model} | ` +
                `raciocinio=${route.reasoning} | ` +
                `web=${webSearch}`
            );


            /* =============================================
               BAZAARLINK
               ============================================= */

            const stream =
                await client.chat.completions.create(
                    requestOptions
                );


            /* =============================================
               STREAM
               ============================================= */

            for await (
                const chunk
                of stream
            ) {

                const content =
                    chunk
                        .choices?.[0]
                        ?.delta
                        ?.content;


                if (content) {

                    res.write(

                        `data: ${JSON.stringify({

                            type: "text",

                            content

                        })}\n\n`

                    );
                }
            }


            /* =============================================
               DONE
               ============================================= */

            res.write(

                `data: ${JSON.stringify({

                    type: "done"

                })}\n\n`

            );


            res.end();


        } catch (error) {

            console.error(
                "Erro da BazaarLink:",
                error
            );


            const errorMessage =
                error?.message ||
                "Erro desconhecido.";


            console.error(
                "Detalhes:",
                errorMessage
            );


            /* =============================================
               ERROR BEFORE SSE
               ============================================= */

            if (!res.headersSent) {

                return res.status(500).json({

                    error:
                        "Não foi possível obter uma resposta da Sarah AI."

                });
            }


            /* =============================================
               ERROR DURING SSE
               ============================================= */

            res.write(

                `data: ${JSON.stringify({

                    type: "error",

                    error:
                        "Não foi possível obter uma resposta da Sarah AI."

                })}\n\n`

            );


            res.end();
        }
    }
);


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            status: "online",

            service: "Sarah AI",

            models: {

                fast:
                    FAST_MODEL,

                smart:
                    SMART_MODEL,

                fallback:
                    FALLBACK_MODEL

            }

        });
    }
);


/* =========================================================
   START SERVER
   ========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            "========================================"
        );

        console.log(
            "Sarah AI está rodando"
        );

        console.log(
            `Porta: ${PORT}`
        );

        console.log(
            `Modelo rápido: ${FAST_MODEL}`
        );

        console.log(
            `Modelo inteligente: ${SMART_MODEL}`
        );

        console.log(
            `Fallback: ${FALLBACK_MODEL}`
        );

        console.log(
            "Pesquisa web: automática"
        );

        console.log(
            "Raciocínio: automático"
        );

        console.log(
            "Contexto: últimas 20 mensagens"
        );

        console.log(
            "========================================"
        );
    }
);
