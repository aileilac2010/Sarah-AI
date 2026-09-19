let conversationHistory = [];
let isGenerating = false;

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


// ==========================================
// SCROLL
// ==========================================

function scrollToBottom() {

    if (!chatContainer) return;

    chatContainer.scrollTop =
        chatContainer.scrollHeight;
}


// ==========================================
// ESCAPAR HTML
// ==========================================

function escapeHTML(text) {

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ==========================================
// MARKDOWN SIMPLES
// ==========================================

function renderMarkdown(text) {

    if (!text) {
        return "";
    }

    let source = String(text);

    // --------------------------------------
    // Proteger blocos de código
    // --------------------------------------

    const codeBlocks = [];

    source = source.replace(
        /```(\w+)?\n?([\s\S]*?)```/g,
        function (_, language, code) {

            const index =
                codeBlocks.length;

            codeBlocks.push({
                language:
                    language || "",
                code:
                    code.trim()
            });

            return `___CODEBLOCK_${index}___`;
        }
    );


    // --------------------------------------
    // Escapar HTML
    // --------------------------------------

    source =
        escapeHTML(source);


    // --------------------------------------
    // Títulos
    // --------------------------------------

    source = source.replace(
        /^### (.*)$/gm,
        "<h3>$1</h3>"
    );

    source = source.replace(
        /^## (.*)$/gm,
        "<h2>$1</h2>"
    );

    source = source.replace(
        /^# (.*)$/gm,
        "<h1>$1</h1>"
    );


    // --------------------------------------
    // Negrito
    // --------------------------------------

    source = source.replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>"
    );

    source = source.replace(
        /__(.+?)__/g,
        "<strong>$1</strong>"
    );


    // --------------------------------------
    // Itálico
    // --------------------------------------

    source = source.replace(
        /(^|[^*])\*([^*\n]+)\*(?!\*)/g,
        "$1<em>$2</em>"
    );


    // --------------------------------------
    // Código inline
    // --------------------------------------

    source = source.replace(
        /`([^`\n]+)`/g,
        "<code>$1</code>"
    );


    // --------------------------------------
    // Listas numeradas
    // --------------------------------------

    source = source.replace(
        /(?:^|\n)((?:\d+\.\s+.+(?:\n|$))+)/g,
        function (_, block) {

            const items =
                block
                    .trim()
                    .split(/\n/)
                    .map(function (line) {

                        return line.replace(
                            /^\d+\.\s+/,
                            ""
                        );

                    })
                    .map(function (item) {

                        return `<li>${item}</li>`;

                    })
                    .join("");

            return `\n<ol>${items}</ol>\n`;
        }
    );


    // --------------------------------------
    // Listas com marcadores
    // --------------------------------------

    source = source.replace(
        /(?:^|\n)((?:[-*]\s+.+(?:\n|$))+)/g,
        function (_, block) {

            const items =
                block
                    .trim()
                    .split(/\n/)
                    .map(function (line) {

                        return line.replace(
                            /^[-*]\s+/,
                            ""
                        );

                    })
                    .map(function (item) {

                        return `<li>${item}</li>`;

                    })
                    .join("");

            return `\n<ul>${items}</ul>\n`;
        }
    );


    // --------------------------------------
    // TABELAS MARKDOWN
    // --------------------------------------

    source = convertTables(source);


    // --------------------------------------
    // Blockquotes
    // --------------------------------------

    source = source.replace(
        /^&gt;\s?(.*)$/gm,
        "<blockquote>$1</blockquote>"
    );


    // --------------------------------------
    // Linhas horizontais
    // --------------------------------------

    source = source.replace(
        /^---$/gm,
        "<hr>"
    );


    // --------------------------------------
    // Quebras de linha
    // --------------------------------------

    source = source.replace(
        /\n{2,}/g,
        "</p><p>"
    );

    source = source.replace(
        /\n/g,
        "<br>"
    );


    // --------------------------------------
    // Restaurar blocos de código
    // --------------------------------------

    codeBlocks.forEach(
        function (block, index) {

            const language =
                block.language
                    ? `<span class="code-language">${escapeHTML(block.language)}</span>`
                    : "";

            const code =
                escapeHTML(block.code);

            const html = `
                <pre>
                    ${language}
                    <code>${code}</code>
                </pre>
            `;

            source = source.replace(
                `___CODEBLOCK_${index}___`,
                html
            );
        }
    );


    return `<div class="markdown-content"><p>${source}</p></div>`;
}


// ==========================================
// TABELAS
// ==========================================

function convertTables(text) {

    const lines =
        text.split("\n");

    const result = [];

    let i = 0;

    while (i < lines.length) {

        const line =
            lines[i].trim();

        // Possível cabeçalho
        if (
            line.includes("|") &&
            i + 1 < lines.length &&
            /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(
                lines[i + 1]
            )
        ) {

            const headerCells =
                splitTableRow(line);

            i++;

            const separator =
                lines[i];

            const alignments =
                splitTableRow(separator)
                    .map(function (cell) {

                        const value =
                            cell.trim();

                        if (
                            value.startsWith(":") &&
                            value.endsWith(":")
                        ) {
                            return "center";
                        }

                        if (
                            value.startsWith(":")
                        ) {
                            return "left";
                        }

                        if (
                            value.endsWith(":")
                        ) {
                            return "right";
                        }

                        return "left";
                    });

            i++;

            const rows = [];

            while (
                i < lines.length &&
                lines[i].includes("|") &&
                lines[i].trim() !== ""
            ) {

                rows.push(
                    splitTableRow(lines[i])
                );

                i++;
            }

            let html =
                '<div class="table-wrapper"><table>';

            html += "<thead><tr>";

            headerCells.forEach(
                function (cell, index) {

                    const alignment =
                        alignments[index] || "left";

                    html += `
                        <th style="text-align:${alignment}">
                            ${cell.trim()}
                        </th>
                    `;
                }
            );

            html += "</tr></thead>";

            html += "<tbody>";

            rows.forEach(
                function (row) {

                    html += "<tr>";

                    headerCells.forEach(
                        function (_, index) {

                            const cell =
                                row[index] || "";

                            const alignment =
                                alignments[index] || "left";

                            html += `
                                <td style="text-align:${alignment}">
                                    ${cell.trim()}
                                </td>
                            `;
                        }
                    );

                    html += "</tr>";
                }
            );

            html += "</tbody></table></div>";

            result.push(html);

            continue;
        }

        result.push(lines[i]);

        i++;
    }

    return result.join("\n");
}


// ==========================================
// DIVIDIR LINHA DA TABELA
// ==========================================

function splitTableRow(row) {

    let value =
        row.trim();

    if (value.startsWith("|")) {
        value =
            value.substring(1);
    }

    if (value.endsWith("|")) {
        value =
            value.substring(
                0,
                value.length - 1
            );
    }

    return value.split("|");
}


// ==========================================
// ADICIONAR MENSAGEM
// ==========================================

function addMessage(
    text,
    type,
    webSearch = false
) {

    if (!chatContainer) {
        return null;
    }

    const messageWrapper =
        document.createElement("div");

    messageWrapper.className =
        `message ${type}`;


    const messageBubble =
        document.createElement("div");

    messageBubble.className =
        "message-bubble";


    // Pesquisa
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

        messageBubble.appendChild(
            webIndicator
        );
    }


    const textElement =
        document.createElement("div");

    textElement.className =
        "message-text";


    if (type === "assistant") {

        textElement.innerHTML =
            renderMarkdown(text);

    } else {

        textElement.textContent =
            text || "";
    }


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


// ==========================================
// THINKING
// ==========================================

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


function removeThinking() {

    const thinking =
        document.getElementById(
            "thinking-message"
        );

    if (thinking) {
        thinking.remove();
    }
}


// ==========================================
// ENVIAR
// ==========================================

async function sendMessage() {

    if (isGenerating) {
        return;
    }

    if (!messageInput) {
        return;
    }

    const text =
        messageInput.value.trim();

    if (!text) {
        return;
    }


    messageInput.value = "";

    messageInput.style.height =
        "auto";


    if (welcomeScreen) {
        welcomeScreen.style.display =
            "none";
    }


    // Mensagem do usuário
    addMessage(
        text,
        "user"
    );


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


        // ==================================
        // STREAM
        // ==================================

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
                buffer.split(
                    "\n\n"
                );


            buffer =
                events.pop();


            for (
                const event of events
            ) {

                const line =
                    event
                        .split("\n")
                        .find(
                            function (line) {
                                return line.startsWith(
                                    "data:"
                                );
                            }
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


                // ==========================
                // START
                // ==========================

                if (
                    data.type === "start"
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


                // ==========================
                // TEXTO
                // ==========================

                else if (
                    data.type === "text"
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


                    fullResponse +=
                        data.content;


                    assistantTextElement.innerHTML =
                        renderMarkdown(
                            fullResponse
                        );


                    scrollToBottom();
                }


                // ==========================
                // ERRO
                // ==========================

                else if (
                    data.type === "error"
                ) {

                    throw new Error(
                        data.error ||
                        "Erro ao gerar resposta."
                    );
                }
            }
        }


        // ==================================
        // GUARDAR HISTÓRICO
        // ==================================

        if (fullResponse) {

            conversationHistory.push({
                role: "assistant",
                content:
                    fullResponse
            });
        }


    } catch (error) {

        console.error(
            "Sarah AI:",
            error
        );


        removeThinking();


        addMessage(
            error.message ||
                "Desculpa, ocorreu um erro.",
            "assistant"
        );
    }


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


// ==========================================
// FORM
// ==========================================

if (chatForm) {

    chatForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            sendMessage();
        }
    );
}


// ==========================================
// ENTER
// ==========================================

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

            this.style.height =
                "auto";

            this.style.height =
                this.scrollHeight +
                "px";
        }
    );
}


// ==========================================
// NOVO CHAT
// ==========================================

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
            Olá, eu sou a
            <span>Sarah.</span>
        </h1>

        <p>
            Sua assistente de inteligência artificial.
        </p>

        <div class="suggestions">

            <button
                type="button"
                onclick="useSuggestion(
                    'Explique-me um assunto de forma simples'
                )"
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
                onclick="useSuggestion(
                    'Ajude-me a criar uma ideia criativa'
                )"
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
                onclick="useSuggestion(
                    'Pesquise e explique este assunto para mim'
                )"
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
                onclick="useSuggestion(
                    'Ajude-me a resolver este problema'
                )"
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


// ==========================================
// SUGESTÕES
// ==========================================

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


// ==========================================
// SIDEBAR
// ==========================================

function toggleSidebar() {

    if (!sidebar) {
        return;
    }

    sidebar.classList.toggle(
        "open"
    );
}


// ==========================================
// FUNÇÕES GLOBAIS
// ==========================================

window.sendMessage =
    sendMessage;

window.newChat =
    newChat;

window.useSuggestion =
    useSuggestion;

window.toggleSidebar =
    toggleSidebar;
