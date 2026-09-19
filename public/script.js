const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const messages = document.getElementById("messages");
const sendButton = document.getElementById("send-button");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = input.value.trim();

    if (!message) return;

    addMessage(message, "user");

    input.value = "";
    input.style.height = "auto";

    sendButton.disabled = true;

    const thinkingMessage = addMessage("Sarah está pensando...", "ai");

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: message
            })
        });

        const data = await response.json();

        thinkingMessage.remove();

        if (!response.ok) {
            throw new Error(data.error || "Erro ao comunicar com a Sarah.");
        }

        addMessage(data.reply, "ai");

    } catch (error) {
        thinkingMessage.remove();

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


function addMessage(text, type) {

    const message = document.createElement("div");

    message.className = `message ${
        type === "user" ? "user-message" : "ai-message"
    }`;

    const content = document.createElement("div");

    content.className = "message-content";

    content.textContent = text;

    message.appendChild(content);

    messages.appendChild(message);

    messages.scrollTop = messages.scrollHeight;

    return message;
}


function newChat() {

    messages.innerHTML = `
        <div class="welcome">
            <div class="welcome-logo">S</div>

            <h2>Olá, eu sou a Sarah. 👋</h2>

            <p>
                Como posso ajudar você hoje?
            </p>
        </div>
    `;

    input.focus();
}


input.addEventListener("input", () => {

    input.style.height = "auto";

    input.style.height =
        Math.min(input.scrollHeight, 160) + "px";

});


input.addEventListener("keydown", (event) => {

    if (event.key === "Enter" && !event.shiftKey) {

        event.preventDefault();

        form.requestSubmit();
    }

});
