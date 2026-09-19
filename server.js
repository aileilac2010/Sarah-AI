const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;


/* =========================
   CONFIGURAÇÕES
========================= */

app.use(cors());

app.use(express.json());

app.use(express.static("public"));


/* =========================
   BAZAARLINK
========================= */

const client = new OpenAI({

    apiKey: process.env.BAZAARLINK_API_KEY,

    baseURL: "https://api.bazaarlink.ai/v1"

});


/* =========================
   CHAT
========================= */

app.post("/api/chat", async (req, res) => {

    try {

        const { messages } = req.body;


        /*
            Verificar mensagens
        */

        if (

            !Array.isArray(messages) ||

            messages.length === 0

        ) {

            return res.status(400).json({

                error: "Nenhuma mensagem foi enviada."

            });

        }


        /*
            Manter somente as últimas
            30 mensagens.
        */

        const recentMessages =
            messages.slice(-30);


        /*
            PERSONALIDADE DA SARAH
        */

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

                "Use o contexto das mensagens anteriores desta conversa. " +

                "Quando uma pergunta depender de informações atuais, notícias, acontecimentos recentes, preços ou fatos que possam ter mudado, use a pesquisa na internet quando estiver disponível. " +

                "Quando pesquisar na internet, informe claramente que a resposta foi pesquisada na internet. " +

                "Não invente informações. " +

                "Se não souber algo, diga claramente que não sabe."

        };


        /*
            PEDIDO À BAZAARLINK
        */

        const completion =

            await client.chat.completions.create({

                model:

                    process.env.BAZAARLINK_MODEL ||

                    "auto:free",


                messages: [

                    systemMessage,

                    ...recentMessages

                ],


                /*
                    Limite da resposta.

                    250 tokens deixa a resposta
                    curta sem ficar demasiado limitada.
                */

                max_tokens: 250,


                /*
                    Pesquisa na internet
                */

                plugins: [

                    {

                        id: "web"

                    }

                ]

            });


        /*
            RESPOSTA DA IA
        */

        const reply =

            completion
                .choices?.[0]
                ?.message?.content;


        if (!reply) {

            throw new Error(

                "A BazaarLink não retornou uma resposta."

            );

        }


        /*
            Detectar se a resposta
            possui indicação de pesquisa web.

            Esta primeira versão verifica
            informações retornadas pela API.
        */

        const messageData =
            completion.choices?.[0]?.message;


        const webSearch =

            Boolean(

                messageData?.annotations ||

                messageData?.citations ||

                messageData?.sources ||

                completion?.citations

            );


        /*
            Enviar para o navegador
        */

        res.json({

            reply: reply,

            webSearch: webSearch

        });


    } catch (error) {

        console.error(

            "Erro da BazaarLink:",

            error

        );


        res.status(500).json({

            error:

                "Não foi possível obter uma resposta da Sarah AI."

        });

    }

});


/* =========================
   SERVIDOR
========================= */

app.listen(PORT, () => {

    console.log(

        "Sarah AI rodando na porta " + PORT

    );

});
