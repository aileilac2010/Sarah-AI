const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;


/* =====================================================
   CONFIGURAÇÕES
===================================================== */

app.use(cors());

app.use(express.json());

app.use(express.static("public"));


/* =====================================================
   BAZAARLINK
===================================================== */

const client = new OpenAI({
    apiKey: process.env.BAZAARLINK_API_KEY,
    baseURL: "https://api.bazaarlink.ai/v1"
});


/* =====================================================
   DETECTAR SE A PERGUNTA PRECISA DE INTERNET
===================================================== */

function needsWebSearch(message) {

    const text = message
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const webKeywords = [

        // Tempo / atualidade
        "hoje",
        "agora",
        "atual",
        "atualmente",
        "recentemente",
        "recentes",
        "ultima noticia",
        "ultimas noticias",
        "noticias de hoje",
        "noticias atuais",

        // Pesquisa
        "pesquise",
        "pesquisa",
        "procure na internet",
        "pesquisa na internet",
        "pesquise na internet",
        "pesquisa online",

        // Preços
        "preco atual",
        "precos atuais",
        "quanto custa agora",
        "quanto esta custando",
        "quanto esta a custar",

        // Mercado / câmbio
        "cotacao",
        "cambio",
        "dolar hoje",
        "euro hoje",

        // Eventos
        "o que aconteceu hoje",
        "o que aconteceu ontem",
        "ultimas novidades",
        "novidades de hoje",

        // Informação que muda frequentemente
        "quem e o atual",
        "quem e a atual",
        "atual presidente",
        "atual primeiro ministro",
        "atual primeiro-ministro",

        // Esportes
        "jogo de hoje",
        "jogos de hoje",
        "resultado de hoje",
        "resultado do jogo",
        "placar",
        "classificacao atual",

        // Clima
        "tempo hoje",
        "clima hoje",
        "previsao do tempo",
        "previsao para hoje",

        // Datas
        "quando vai acontecer",
        "quando sera",
        "quando e a proxima",

        // Web explícita
        "na internet",
        "online"
    ];

    return webKeywords.some(keyword =>
        text.includes(keyword)
    );
}


/* =====================================================
   CHAT
===================================================== */

app.post("/api/chat", async (req, res) => {

    try {

        const { messages } = req.body;


        /* ---------------------------------------------
           VALIDAR MENSAGENS
        --------------------------------------------- */

        if (
            !Array.isArray(messages) ||
            messages.length === 0
        ) {

            return res.status(400).json({
                error: "Nenhuma mensagem foi enviada."
            });

        }


        /* ---------------------------------------------
           PEGAR ÚLTIMA MENSAGEM DO USUÁRIO
        --------------------------------------------- */

        const lastUserMessage =
            [...messages]
                .reverse()
                .find(message =>
                    message.role === "user"
                );


        const userText =
            lastUserMessage?.content || "";


        /* ---------------------------------------------
           DECIDIR SE PRECISA DE WEB
        --------------------------------------------- */

        const useWeb =
            needsWebSearch(userText);


        /* ---------------------------------------------
           HISTÓRICO MENOR
           
           Isso reduz o contexto enviado para a API.
        --------------------------------------------- */

        const recentMessages =
            messages.slice(-12);


        /* ---------------------------------------------
           PERSONALIDADE DA SARAH
        --------------------------------------------- */

        const systemMessage = {

            role: "system",

            content:

                "Você é Sarah AI, uma assistente de inteligência artificial amigável, inteligente e útil. " +

                "Responda de forma curta, direta e natural. " +

                "Na maioria das perguntas, responda em no máximo 1 a 3 parágrafos curtos. " +

                "Evite introduções desnecessárias, repetições e conclusões longas. " +

                "Não explique mais do que foi perguntado. " +

                "Use listas curtas quando forem úteis. " +

                "Só dê respostas longas quando o usuário pedir explicitamente uma explicação detalhada. " +

                "Use o contexto recente da conversa. " +

                "Não invente informações. " +

                "Se não souber algo, diga claramente que não sabe. " +

                (

                    useWeb

                        ? "Esta pergunta pode depender de informações atuais. A pesquisa na internet foi ativada. Use-a quando necessário e baseie a resposta nas informações encontradas."

                        : "Esta pergunta não necessita de pesquisa na internet. Responda usando o conhecimento disponível."
                )

        };


        /* ---------------------------------------------
           CONFIGURAÇÃO DO PEDIDO
        --------------------------------------------- */

        const requestOptions = {

            model:
                process.env.BAZAARLINK_MODEL ||
                "auto:free",

            messages: [
                systemMessage,
                ...recentMessages
            ],

            max_tokens: 180,

            temperature: 0.7,

            stream: true

        };


        /* ---------------------------------------------
           WEB SOMENTE QUANDO NECESSÁRIO
        --------------------------------------------- */

        if (useWeb) {

            requestOptions.plugins = [
                {
                    id: "web"
                }
            ];

        }


        /* ---------------------------------------------
           CABEÇALHOS SSE
        --------------------------------------------- */

        res.setHeader(
            "Content-Type",
            "text/event-stream"
        );

        res.setHeader(
            "Cache-Control",
            "no-cache"
        );

        res.setHeader(
            "Connection",
            "keep-alive"
        );

        res.flushHeaders();


        /* ---------------------------------------------
           AVISAR FRONTEND SE WEB FOI ATIVADA
        --------------------------------------------- */

        res.write(
            `data: ${JSON.stringify({
                type: "start",
                webSearch: useWeb
            })}\n\n`
        );


        /* ---------------------------------------------
           PEDIDO STREAMING À BAZAARLINK
        --------------------------------------------- */

        const stream =
            await client.chat.completions.create(
                requestOptions
            );


        /* ---------------------------------------------
           RECEBER CADA PARTE DA RESPOSTA
        --------------------------------------------- */

        for await (const chunk of stream) {

            const content =
                chunk.choices?.[0]?.delta?.content;


            if (content) {

                res.write(
                    `data: ${JSON.stringify({
                        type: "text",
                        content: content
                    })}\n\n`
                );

            }

        }


        /* ---------------------------------------------
           FINALIZAR STREAM
        --------------------------------------------- */

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


        /*
           Se ainda não começamos o SSE,
           podemos devolver JSON normal.
        */

        if (!res.headersSent) {

            return res.status(500).json({

                error:
                    "Não foi possível obter uma resposta da Sarah AI."

            });

        }


        /*
           Se o streaming já começou,
           enviamos o erro como evento SSE.
        */

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


/* =====================================================
   SERVIDOR
===================================================== */

app.listen(PORT, () => {

    console.log(
        "Sarah AI rodando na porta " + PORT
    );

});
