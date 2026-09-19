/* =========================================================
   SARAH AI
   Frontend Chat Engine
   ========================================================= */


/* =========================================================
   STATE
   ========================================================= */

let conversationHistory = [];

let isGenerating = false;

let currentConversationTitle = "Nova conversa";


/* =========================================================
   ELEMENTS
   ========================================================= */

const messagesContainer =
    document.getElementById("messages");

const messageInput =
    document.getElementById("message");

const sendButton =
    document.getElementById("send-button");

const chatForm =
    document.getElementById("chat-form");

const sidebar =
    document.getElementById("sidebar");

const sidebarOverlay =
    document.getElementById("sidebar-overlay");

const conversationList =
    document.getElementById("conversation-list");


/* =========================================================
   SCROLL
   ========================================================= */

function scrollToBottom() {

    if (!messagesContainer) return;

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}


/* =========================================================
   ADD MESSAGE
   ========================================================= */

function addMessage(
    text,
    type,
    webSearch = false
) {

    if (!messagesContainer) {
        return null;
    }


    const message =
        document.createElement("div");

    message.className =
        `message ${type}`;


    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble";


    /* Web indicator */

    if (
        type === "assistant" &&
        webSearch
    ) {

        const webIndicator =
            document.createElement("div");

        webIndicator.className =
            "web-source";

        webIndicator.textContent =
            "🌐 Pesquisa na internet ativada";

        bubble.appendChild(webIndicator);
    }


    /* Text */

    const textElement =
        document.createElement("div");

    textElement.className =
        "message-text";

    textElement.textContent =
        text || "";


    bubble.appendChild(textElement);

    message.appendChild(bubble);

    messagesContainer.appendChild(message);


    scrollToBottom();


    return textElement;
}


/* =========================================================
   THINKING
   ========================================================= */

function showThinking() {

    if (!messagesContainer) {
        return;
    }


    removeThinking();


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


    messagesContainer.appendChild(thinking);

    scrollToBottom();
}


function removeThinking() {

    const thinking =
        document.getElementById(
            "thinking-message"
        );

    if (thinking) {
        thinking.remove();
    }
}


/* =========================================================
   HIDE WELCOME
   ========================================================= */

function hideWelcome() {

    const welcome =
        document.querySelector(".welcome");

    if (welcome) {

        welcome.style.display =
            "none";
    }
}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

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


    /* Clear input */

    messageInput.value = "";

    messageInput.style.height =
        "auto";


    hideWelcome();


    /* User message */

    addMessage(
        text,
        "user"
    );


    /* History */

    conversationHistory.push({

        role: "user",

        content: text

    });


    /* Title */

    if (
        currentConversationTitle ===
        "Nova conversa"
    ) {

        currentConversationTitle =
            createConversationTitle(text);

        updateConversationTitle();
    }


    isGenerating = true;


    if (sendButton) {

        sendButton.disabled =
            true;
    }


    showThinking();


    try {

        const response =
            await fetch(
                "/api/chat",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            messages:
                                conversationHistory

                        })
                }
            );


        /* HTTP error */

        if (!response.ok) {

            let errorMessage =
                "Erro no servidor.";

            try {

                const data =
                    await response.json();

                if (data.error) {

                    errorMessage =
                        data.error;
                }

            } catch (error) {
                /* Ignore */
            }

            throw new Error(
                errorMessage
            );
        }


        /* Streaming not available */

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


        /* =================================================
           READ STREAM
           ================================================= */

        while (true) {

            const {
                value,
                done
            } = await reader.read();


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


            for (
                const event
                of events
            ) {

                const lines =
                    event.split("\n");


                const dataLine =
                    lines.find(
                        line =>
                            line.startsWith(
                                "data:"
                            )
                    );


                if (!dataLine) {
                    continue;
                }


                const jsonText =
                    dataLine
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
                        "Evento SSE inválido:",
                        jsonText
                    );

                    continue;
                }


                /* START */

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


                /* TEXT */

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


                /* ERROR */

                else if (
                    data.type ===
                    "error"
                ) {

                    throw new Error(
                        data.error ||
                        "Erro ao gerar resposta."
                    );
                }


                /* DONE */

                else if (
                    data.type ===
                    "done"
                ) {

                    removeThinking();
                }

            }
        }


        /* =================================================
           SAVE ASSISTANT MESSAGE
           ================================================= */

        if (fullResponse.trim()) {

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

    } finally {

        isGenerating =
            false;


        if (sendButton) {

            sendButton.disabled =
                false;
        }


        if (messageInput) {

            messageInput.focus();
        }

    }
}


/* =========================================================
   NEW CHAT
   ========================================================= */

function newChat() {

    if (isGenerating) {
        return;
    }


    conversationHistory = [];


    currentConversationTitle =
        "Nova conversa";


    if (!messagesContainer) {
        return;
    }


    messagesContainer.innerHTML = "";


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
            Olá, eu sou a
            <span>Sarah.</span>
        </h1>

        <p>
            Sua assistente de inteligência artificial.
        </p>


        <div class="suggestions">


            <button
                type="button"
                onclick="useSuggestion('Explique-me um assunto de forma simples')"
            >

                <div class="suggestion-icon">
                    ✦
                </div>

                <div class="suggestion-content">

                    <strong>
                        Aprender
                    </strong>

                    <span>
                        Explique um assunto para mim
                    </span>

                </div>

            </button>


            <button
                type="button"
                onclick="useSuggestion('Ajude-me a criar uma ideia criativa')"
            >

                <div class="suggestion-icon">
                    ✨
                </div>

                <div class="suggestion-content">

                    <strong>
                        Criar
                    </strong>

                    <span>
                        Ajude-me com uma ideia criativa
                    </span>

                </div>

            </button>


            <button
                type="button"
                onclick="useSuggestion('Pesquise e explique este assunto para mim')"
            >

                <div class="suggestion-icon">
                    ◉
                </div>

                <div class="suggestion-content">

                    <strong>
                        Explorar
                    </strong>

                    <span>
                        Descubra algo novo
                    </span>

                </div>

            </button>


            <button
                type="button"
                onclick="useSuggestion('Ajude-me a resolver este problema')"
            >

                <div class="suggestion-icon">
                    ◇
                </div>

                <div class="suggestion-content">

                    <strong>
                        Resolver
                    </strong>

                    <span>
                        Ajude-me com um problema
                    </span>

                </div>

            </button>


        </div>
    `;


    messagesContainer.appendChild(
        welcome
    );


    updateConversationTitle();


    if (messageInput) {

        messageInput.value = "";

        messageInput.style.height =
            "auto";

        messageInput.focus();
    }


    closeSidebarOnMobile();
}


/* =========================================================
   SUGGESTION
   ========================================================= */

function useSuggestion(text) {

    if (!messageInput) {
        return;
    }


    messageInput.value =
        text;


    messageInput.focus();


    autoResizeTextarea();
}


/* =========================================================
   TEXTAREA AUTO RESIZE
   ========================================================= */

function autoResizeTextarea() {

    if (!messageInput) {
        return;
    }


    messageInput.style.height =
        "auto";


    messageInput.style.height =
        Math.min(
            messageInput.scrollHeight,
            160
        ) + "px";
}


/* =========================================================
   CREATE TITLE
   ========================================================= */

function createConversationTitle(
    text
) {

    const clean =
        text
            .replace(/\s+/g, " ")
            .trim();


    if (!clean) {
        return "Nova conversa";
    }


    if (clean.length <= 32) {
        return clean;
    }


    return (
        clean.substring(0, 32)
        + "..."
    );
}


/* =========================================================
   UPDATE SIDEBAR TITLE
   ========================================================= */

function updateConversationTitle() {

    if (!conversationList) {
        return;
    }


    conversationList.innerHTML = "";


    const item =
        document.createElement(
            "button"
        );


    item.className =
        "conversation-item active";


    item.type =
        "button";


    item.onclick =
        function () {
            scrollToBottom();
        };


    item.innerHTML = `

        <span class="conversation-icon">
            💬
        </span>

        <span class="conversation-name">
            ${escapeHTML(
                currentConversationTitle
            )}
        </span>

    `;


    conversationList.appendChild(
        item
    );
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text;

    return div.innerHTML;
}


/* =========================================================
   SIDEBAR
   ========================================================= */

function toggleSidebar() {

    if (!sidebar) {
        return;
    }


    sidebar.classList.toggle(
        "open"
    );


    if (sidebarOverlay) {

        const isOpen =
            sidebar.classList.contains(
                "open"
            );


        sidebarOverlay.style.display =
            isOpen
                ? "block"
                : "";
    }
}


function closeSidebarOnMobile() {

    if (
        window.innerWidth <= 900 &&
        sidebar
    ) {

        sidebar.classList.remove(
            "open"
        );


        if (sidebarOverlay) {

            sidebarOverlay.style.display =
                "";
        }
    }
}


/* =========================================================
   FORM
   ========================================================= */

if (chatForm) {

    chatForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            sendMessage();

        }
    );
}


/* =========================================================
   ENTER / SHIFT + ENTER
   ========================================================= */

if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }

        }
    );


    messageInput.addEventListener(
        "input",
        function () {

            autoResizeTextarea();

        }
    );
}


/* =========================================================
   MOBILE RESIZE
   ========================================================= */

window.addEventListener(
    "resize",
    function () {

        if (
            window.innerWidth > 900 &&
            sidebar
        ) {

            sidebar.classList.remove(
                "open"
            );


            if (sidebarOverlay) {

                sidebarOverlay.style.display =
                    "";
            }
        }

    }
);


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.sendMessage =
    sendMessage;

window.newChat =
    newChat;

window.useSuggestion =
    useSuggestion;

window.toggleSidebar =
    toggleSidebar;


/* =========================================================
   STARTUP
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        if (messageInput) {

            messageInput.focus();
        }

    }
);
