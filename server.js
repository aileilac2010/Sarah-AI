```javascript
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;


app.use(cors());

app.use(express.json());

app.use(express.static("public"));


/* CONEXÃO COM BAZAARLINK */

const client = new OpenAI({

    apiKey: process.env.BAZAARLINK_API_KEY,

    baseURL: "https://api.bazaarlink.ai/v1"

});


/* CHAT */

app.post("/api/chat", async (req, res) => {

    try {

        const { messages } = req.body;


        /*
            Verificar se recebemos uma conversa válida
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
            Limitar o tamanho da conversa
        */

        const recentMessages =
            messages.slice(-30);


        /*
            Instrução principal da Sarah
        */

        const systemMessage = {

            role: "system",

            content:
                "Você é Sarah AI, uma assistente de inteligência artificial amigável, inteligente e útil. " +
                "Responda de forma clara, natural e objetiva. " +
                "Use o contexto das mensagens anteriores desta conversa para entender perguntas e referências do usuário. " +
                "Quando a pergunta depender de informações atuais, notícias, acontecimentos recentes, preços, pessoas ou fatos que possam ter mudado, use a pesquisa na internet. " +
                "Quando utilizar informações encontradas na internet, mencione claramente as fontes quando possível. " +
                "Não invente informações sobre o usuário. " +
                "Se você não souber algo, diga claramente que não sabe."

        };


        /*
            Enviar instrução + histórico + acesso à web
        */

        const completion =
            await client.chat.completions.create({

                /*
                    :online ativa o encaminhamento
                    para pesquisa web quando suportado.
                */

                model:
                    process.env.BAZAARLINK_MODEL ||
                    "auto:free:online",


                messages: [
                    systemMessage,
                    ...recentMessages
                ],


                /*
                    Ativar o plugin de pesquisa web.
                */

                plugins: [
                    {
                        id: "web"
                    }
                ]

            });


        /*
            Obter resposta
        */

        const reply =
            completion.choices?.[0]?.message?.content;


        if (!reply) {

            throw new Error(
                "A BazaarLink não retornou uma resposta."
            );

        }


        /*
            Enviar resposta para o navegador
        */

        res.json({

            reply: reply

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


/* SERVIDOR */

app.listen(PORT, () => {
    console.log("Sarah AI rodando na porta " + PORT);
});
