/* =====================================================
   SARAH AI — SCRIPT PRINCIPAL
===================================================== */


/* =====================================================
   ESTADO DA CONVERSA
===================================================== */

let conversationHistory = [];

let isGenerating = false;


/* =====================================================
   ELEMENTOS DA INTERFACE
===================================================== */

const chatContainer =
    document.getElementById("chatContainer");

const messageInput =
    document.getElementById("messageInput");

const sendButton =
    document.getElementById("sendButton");

const welcomeScreen =
    document.getElementById("welcomeScreen");


/* =====================================================
   ADICIONAR MENSAGEM NA INTERFACE
===================================================== */

function addMessage(
    text,
    type,
    webSearch = false
) {

    const messageWrapper =
        document.createElement("div");

    messageWrapper.className =
        `message ${type}`;


    const messageBubble =
        document.createElement("div");

    messageBubble.className =
        "message-bubble";


    /*
       Indicador de pesquisa
    */

    if (
        type === "assistant" &&
        webSearch
    ) {

        const webIndicator =
            document.createElement("div");

        webIndicator.className =
            "web-source";

        webIndicator.innerHTML =
            "🌐 Pesquisado na internet";

        messageBubble.appendChild(
            webIndicator
        );

    }


    /*
       Texto
    */

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


    /*
       Scroll automático
    */

    chatContainer.scrollTop =
        chatContainer.scrollHeight;


    return textElement;

}


/* =====================================================
   INDICADOR "SARAH ESTÁ PENSANDO"
===================================================== */

function showThinking() {

    const thinking =
        document.createElement("div");

    thinking.className =
        "message assistant thinking-message";

    thinking.id =
        "thinkingMessage";


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


    chatContainer.scrollTop =
        chatContainer.scrollHeight;

}


/* =====================================================
   REMOVER INDICADOR
===================================================== */

function removeThinking() {

    const thinking =
        document.getElementById(
            "thinkingMessage"
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


    const text =
        messageInput.value.trim();


    if (!text) {
        return;
    }


    /*
       Limpar input
    */

    messageInput.value = "";

    messageInput.style.height =
        "auto";


    /*
       Esconder tela inicial
    */

    if (welcomeScreen) {

        welcomeScreen.style.display =
            "none";

    }


    /*
       Mostrar mensagem do usuário
    */

    addMessage(
        text,
        "user"
    );


    /*
       Guardar mensagem
    */

    conversationHistory.push({

        role: "user",

        content: text

    });


    /*
       Estado de carregamento
    */

    isGenerating = true;


    sendButton.disabled =
        true;


    showThinking();


    try {

        /* ---------------------------------------------
           PEDIDO AO SERVIDOR
        --------------------------------------------- */

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


        if (!response.ok) {

            throw new Error(
                "Erro no servidor."
            );

        }


        /*
           Streaming
        */

        const reader =
            response.body.getReader();


        const decoder =
            new TextDecoder();


        let buffer = "";

        let fullResponse = "";

        let assistantTextElement =
            null;

        let webSearch = false;


        /* ---------------------------------------------
           RECEBER STREAM
        --------------------------------------------- */

        while (true) {

            const {
                value,
                done
            } = await reader.read();


            if (done) {
                break;
            }


            /*
               Converter bytes → texto
            */

            buffer +=
                decoder.decode(
                    value,
                    {
                        stream: true
                    }
                );


            /*
               Separar eventos SSE
            */

            const events =
                buffer.split("\n\n");


            /*
               Guardar último pedaço
               caso esteja incompleto
            */

            buffer =
                events.pop();


            /*
               Processar eventos
            */

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
                       
