/* =====================================================
   SARAH AI — SCRIPT PRINCIPAL
===================================================== */

let conversationHistory = [];
let isGenerating = false;


/* =====================================================
   ELEMENTOS
===================================================== */

const chatContainer =
    document.getElementById("messages");

const messageInput =
    document.getElementById("message");

const sendButton =
    document.getElementById("send-button");

const chatForm =
    document.getElementById("chat-form");

const welcomeScreen =
    document.querySelector(".welcome");

const sidebar =
    document.getElementById("sidebar");


/* =====================================================
   SCROLL
===================================================== */

function scrollToBottom() {

    if (!chatContainer) return;

    chatContainer.scrollTop =
        chatContainer.scrollHeight;
}


/* =====================================================
   ADICIONAR MENSAGEM
===================================================== */

function addMessage(
    text,
    type,
    webSearch = false
) {

    if (!chatContainer) return null;


    const messageWrapper =
        document.createElement("div");

    messageWrapper.className =
        `message ${type}`;


    const messageBubble =
        document.createElement("div");

    messageBubble.className =
        "message-bubble";


    /* Pesquisa na internet */

    if (
        type === "assistant" &&
        webSearch
    ) {

        const webIndicator =
            document.createElement("div");

        webIndicator.className =
            "web-source";

        webIndicator.textContent =
            "🌐 Pesquisado na internet";

        messageBubble.appendChild(
            webIndicator
        );
    }


    /* Texto */

    const textElement =
        document.createElement("div");

    textElement.className =
        "message-text";

    textElement.textContent =
        text || "";


    messageBubble.appendChild(
        textElement
    );

    messageWrapper.appendChild(
        messageBubble
    );

    chatContainer.appendChild(
        messageWrapper
    );


    scrollToBottom();


    return textElement;
}


/* =====================================================
   PENSANDO...
===================================================== */

function showThinking() {

    if (!chatContainer) return;


    const thinking =
        document.createElement("div");

    thinking.className =
        "message assistant thinking-message";

    thinking.id =
        "thinking-message";


    thinking.innerHTML = `
        <div class="message-bubble">
            <div class="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;


    chatContainer.appendChild(
        thinking
    );


    scrollToBottom();
}


/* =====================================================
   REMOVER PENSANDO
===================================================== */

function removeThinking() {

    const thinking =
        document.getElementById(
            "thinking-message"
        );

    if (thinking) {
        thinking.remove();
    }
}


/* =====================================================
   ENVIAR MENSAGEM
===================================================== */

async function sendMessage() {

    if (isGenerating) {
        return;
    }


    if (!messageInput) {
        console.error(
            "Sarah AI: campo de mensagem não encontrado."
        );

        return;
    }


    const text =
        messageInput.value.trim();


    if (!text) {
        return;
    }


    /* Limpar campo */

    messageInput.value = "";

    messageInput.style.height =
        "auto";


    /* Esconder tela inicial */

    if (welcomeScreen) {

        welcomeScreen.style.display =
            "none";
    }


    /* Mostrar mensagem do usuário */

    addMessage(
        text,
        "user"
    );


    /* Guardar conversa */

    conversationHistory.push({

        role: "user",

        content: text

    });


    isGenerating = true;


    if (sendButton) {
        sendButton.disabled = true;
    }


    showThinking();


    try {

        /* ==========================================
           PEDIDO AO SERVIDOR
        ========================================== */

        const response =
            await fetch(
                "/api/chat",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        messages:
                            conversationHistory

                    })

                }
            );


        /* ==========================================
           ERRO HTTP
        ========================================== */

        if (!response.ok) {

            let errorMessage =
                "Erro no servidor.";

            try {

                const errorData =
                    await response.json();

                if (errorData.error) {

                    errorMessage =
                        errorData.error;
                }

            } catch (e) {}

            throw new Error(
                errorMessage
            );
        }


        /* ==========================================
           STREAM
        ========================================== */

        if (!response.body) {

            throw new Error(
                "O servidor não enviou uma resposta."
            );
        }


        const reader =
            response.body.getReader();


        const decoder =
            new TextDecoder(
                "utf-8"
            );


        let buffer = "";

        let fullResponse = "";

        let assistantTextElement =
            null;

        let webSearch = false;


        /* ==========================================
           RECEBER RESPOSTA
        ========================================== */

        while (true) {

            const {
                value,
                done
            } =
                await reader.read();


            if (done) {
                break;
            }


            buffer +=
                decoder.decode(
                    value,
                    {
                        stream: true
                    }
                );


            const events =
                buffer.split("\n\n");


            buffer =
                events.pop();


            /* ======================================
               PROCESSAR EVENTOS
            ====================================== */

            for (
                const event of events
            ) {

                const line =
                    event
                        .split("\n")
                        .find(
                            line =>
                                line.startsWith(
                                    "data:"
                                )
                        );


                if (!line) {
                    continue;
                }


                const jsonText =
                    line
                        .substring(5)
                        .trim();


                if (!jsonText) {
                    continue;
                }


                let data;


                try {

                    data =
                        JSON.parse(
                            jsonText
                        );

                } catch (error) {

                    console.warn(
                        "Evento inválido:",
                        jsonText
                    );

                    continue;
                }


                /* ==================================
                   INÍCIO
                ================================== */

                if (
                    data.type ===
                    "start"
                ) {

                    webSearch =
                        Boolean(
                            data.webSearch
                        );


                    removeThinking();


                    assistantTextElement =
                        addMessage(
                            "",
                            "assistant",
                            webSearch
                        );
                }


                /* ==================================
                   TEXTO
                ================================== */

                else if (
                    data.type ===
                    "text"
                ) {

                    removeThinking();


                    if (
                        !assistantTextElement
                    ) {

                        assistantTextElement =
                            addMessage(
                                "",
                                "assistant",
                                webSearch
                            );
                    }


                    assistantTextElement
                        .textContent +=
                        data.content;


                    fullResponse +=
                        data.content;


                    scrollToBottom();
                }


                /* ==================================
                   ERRO
                ================================== */

                else if (
                    data.type ===
                    "error"
                ) {

                    throw new Error(
                        data.error ||
                        "Erro ao gerar resposta."
                    );
                }

            }

        }


        /* ==========================================
           GUARDAR RESPOSTA DA SARAH
        ========================================== */

        if (fullResponse) {

            conversationHistory.push({

                role: "assistant",

                content: fullResponse

            });
        }


    } catch (error) {

        console.error(
            "Sarah AI:",
            error
        );


        removeThinking();


        addMessage(
            "Desculpa, ocorreu um erro ao falar com o servidor.",
            "assistant"
        );

    }


    /* ==========================================
       FINALIZAR
    ========================================== */

    isGenerating = false;


    if (sendButton) {
        sendButton.disabled = false;
    }


    if (messageInput) {
        messageInput.focus();
    }

}


/* =====================================================
   FORMULÁRIO
===================================================== */

if (chatForm) {

    chatForm.addEventListener(
        "submit",
        function(event) {

            event.preventDefault();

            sendMessage();

        }
    );
}


/* =====================================================
   ENTER
===================================================== */

if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        function(event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }

        }
    );


    /* Auto resize */

    messageInput.addEventListener(
        "input",
        function() {

            this.style.height =
                "auto";

            this.style.height =
                this.scrollHeight +
                "px";

        }
    );

}


/* =====================================================
   NOVO CHAT
===================================================== */

function newChat() {

    conversationHistory = [];


    if (!chatContainer) {
        return;
    }


    chatContainer.innerHTML = "";


    const welcome =
        document.createElement(
            "div"
        );


    welcome.className =
        "welcome";


    welcome.innerHTML = `

        <div class="welcome-logo">
            S
        </div>

        <h1>
            Olá, eu sou a <span>Sarah.</span>
        </h1>

        <p>
            Sua assistente de inteligência artificial.
        </p>

        <div class="suggestions">

            <button
                type="button"
                onclick="useSuggestion('Explique-me um assunto de forma simples')"
            >
                <span>💡</span>

                <strong>
                    Aprender
                </strong>

                <small>
                    Explique um assunto para mim
                </small>
            </button>


            <button
                type="button"
                onclick="useSuggestion('Ajude-me a criar uma ideia criativa')"
            >
                <span>✨</span>

                <strong>
                    Criar
                </strong>

                <small>
                    Ajude-me com uma ideia criativa
                </small>
            </button>


            <button
                type="button"
                onclick="useSuggestion('Pesquise e explique este assunto para mim')"
            >
                <span>🔎</span>

                <strong>
                    Explorar
                </strong>

                <small>
                    Quero descobrir algo novo
                </small>
            </button>


            <button
                type="button"
                onclick="useSuggestion('Ajude-me a resolver este problema')"
            >
                <span>🧠</span>

                <strong>
                    Resolver
                </strong>

                <small>
                    Ajude-me com um problema
                </small>
            </button>

        </div>
    `;


    chatContainer.appendChild(
        welcome
    );


    if (messageInput) {

        messageInput.value = "";

        messageInput.style.height =
            "auto";

        messageInput.focus();

    }

}


/* =====================================================
   SUGESTÃO
===================================================== */

function useSuggestion(text) {

    if (!messageInput) {
        return;
    }


    messageInput.value =
        text;


    messageInput.focus();


    messageInput.style.height =
        "auto";


    messageInput.style.height =
        messageInput.scrollHeight +
        "px";
}


/* =====================================================
   SIDEBAR
===================================================== */

function toggleSidebar() {

    if (!sidebar) {
        return;
    }


    sidebar.classList.toggle(
        "open"
    );
}


/* =====================================================
   DISPONIBILIZAR FUNÇÕES PARA O HTML
===================================================== */

window.sendMessage =
    sendMessage;

window.newChat =
    newChat;

window.useSuggestion =
    useSuggestion;

window.toggleSidebar =
    toggleSidebar;
