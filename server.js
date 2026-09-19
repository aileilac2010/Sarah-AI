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

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Mensagem vazia."
      });
    }

    const completion = await client.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || "openrouter/free",
      messages: [
        {
          role: "system",
          content:
            "Você é Sarah AI, uma assistente de inteligência artificial amigável, inteligente e útil. Responda de forma clara e natural."
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const reply = completion.choices[0].message.content;

    res.json({
      reply
    });

  } catch (error) {
    console.error("Erro:", error);

    res.status(500).json({
      error: "Não foi possível obter uma resposta da Sarah AI."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Sarah AI rodando na porta ${PORT}`);
});
