const form = document.getElementById("chat-form");

const input = document.getElementById("message");

const messages = document.getElementById("messages");

const sendButton = document.getElementById("send-button");


/*
    HISTÓRICO DA CONVERSA

    Fica disponível enquanto a página
    estiver aberta.
*/

let conversationHistory = [];


/* =========================
   ENVIAR MENSAGEM
========================= */

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    const message = input.value.trim();

    if (!message) return;


    /* Mostrar mensagem do usuário */

    addMessage(message, "user");


    input.value = "";

    input.style.height = "auto";


    sendButton.disabled = true;


    /* Guardar no histórico */

    conversationHistory.push({

        role: "user",

        content: message

    });


    /* Mensagem de processamento */

    const thinkingMessage = addMessage(

        "Sarah está pensando...",

        "ai"

    );


    try {

        const response = await fetch("/api/chat", {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                messages: conversationHistory

            })

        });


        const data = await response.json();


        thinkingMessage.remove();


        if (!response.ok) {

            throw new Error(

                data.error ||

                "Erro ao comunicar com a Sarah."

            );

        }


        /*
            Mostrar resposta
        */

        addMessage(

            data.reply,

            "ai",

            data.webSearch === true

        );


        /*
            Guardar resposta da Sarah
        */

        conversationHistory.push({

            role: "assistant",

            content: data.reply

        });


    } catch (error) {

        thinkingMessage.remove();


        /*
            Remover última mensagem
            caso tenha ocorrido erro
        */

        conversationHistory.pop();


        addMessage(

            "Desculpa, ocorreu um erro ao tentar responder. Tenta novamente.",

            "ai"

        );


        console.error(error);

    } finally {

        sendButton.disabled = false;

        input.focus();

    }

});


/* =========================
   ADICIONAR MENSAGEM
========================= */

function addMessage(text, type, webSearch = false) {

    const message = document.createElement("div");


    message.className =

        type === "user"

            ? "message user-message"

            : "message ai-message";


    const wrapper = document.createElement("div");


    const content = document.createElement("div");


    content.className = "message-content";


    content.textContent = text;


    wrapper.appendChild(content);


    /*
        Aviso de pesquisa web
    */

    if (webSearch && type === "ai") {

        const webIndicator =
            document.createElement("div");


        webIndicator.className = "web-source";


        webIndicator.textContent =
            "🌐 Pesquisado na internet";


        wrapper.appendChild(webIndicator);

    }


    message.appendChild(wrapper);


    messages.appendChild(message);


    messages.scrollTo({

        top: messages.scrollHeight,

        behavior: "smooth"

    });


    return message;

}


/* =========================
   NOVO CHAT
========================= */

function newChat() {

    conversationHistory = [];


    messages.innerHTML = `

        <div class="welcome">

            <div class="welcome-logo">
                S
            </div>

            <h1>
                Olá, eu sou a Sarah.
            </h1>

            <p>
                Sua assistente de inteligência artificial.
            </p>

            <div class="suggestions">

                <button
                    onclick="useSuggestion(
                        'Explique-me um assunto de forma simples'
                    )"
                >

                    <span>💡</span>

                    <div>

                        <strong>Aprender</strong>

                        <small>
                            Explique um assunto para mim
                        </small>

                    </div>

                </button>


                <button
                    onclick="useSuggestion(
                        'Ajude-me a criar uma ideia criativa'
                    )"
                >

                    <span>✨</span>

                    <div>

                        <strong>Criar</strong>

                        <small>
                            Ajude-me com uma ideia
                        </small>

                    </div>

                </button>


                <button
                    onclick="useSuggestion(
                        'Pesquise e explique este assunto para mim'
                    )"
                >

                    <span>🔎</span>

                    <div>

                        <strong>Explorar</strong>

                        <small>
                            Quero descobrir algo novo
                        </small>

                    </div>

                </button>


                <button
                    onclick="useSuggestion(
                        'Ajude-me a resolver este problema'
                    )"
                >

                    <span>🧠</span>

                    <div>

                        <strong>Resolver</strong>

                        <small>
                            Ajude-me com um problema
                        </small>

                    </div>

                </button>

            </div>

        </div>

    `;

    input.focus();

}


/* =========================
   SUGESTÕES
========================= */

function useSuggestion(text) {

    input.value = text;

    input.focus();

    input.style.height = "auto";

    input.style.height =

        Math.min(

            input.scrollHeight,

            160

        ) + "px";

}


/* =========================
   SIDEBAR
========================= */

function toggleSidebar() {

    const sidebar =
        document.getElementById("sidebar");


    sidebar.classList.toggle("open");

}


/* =========================
   TEXTAREA
========================= */

input.addEventListener("input", () => {

    input.style.height = "auto";


    input.style.height =

        Math.min(

            input.scrollHeight,

            160

        ) + "px";

});


/* =========================
   ENTER
========================= */

input.addEventListener("keydown", (event) => {

    if (

        event.key === "Enter" &&

        !event.shiftKey

    ) {

        event.preventDefault();

        form.requestSubmit();

    }

});
