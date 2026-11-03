
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";

// ==========================================
// 1. SELECT HTML ELEMENTS
// ==========================================

const chatForm = document.getElementById("ChatForm");
const userInput = document.getElementById("userInput");
const chatMessages = document.getElementById("chatMessages");
const welcomeScreen = document.getElementById("welcomeScreen");

const historyList = document.getElementById("historyList");
const emptyHistory = document.getElementById("emptyHistory");

const newChatBtn = document.querySelector(".new-chat-btn");
const sidebar = document.querySelector(".sidebar");
const menuBtn = document.getElementById("menuBtn");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const shareBtn = document.querySelector(".share-btn");

const chatArea = document.querySelector(".chat-area");
const miniAiIcon = document.getElementById("miniAiIcon");
const sendBtn = document.getElementById("sendBtn");

// ==========================================
// 2. MARKDOWN CONFIGURATION
// ==========================================

marked.setOptions({
    gfm: true,
    breaks: true
});

// ==========================================
// 3. CHAT STATE
// ==========================================

const STORAGE_KEY = "nexoraChats";

let chats = loadChats();
let currentChat = null;
let isGenerating = false;

// ==========================================
// 4. LOAD SAVED CHATS
// ==========================================

function loadChats() {
    try {
        const savedChats = localStorage.getItem(STORAGE_KEY);
        const parsedChats = savedChats ? JSON.parse(savedChats) : [];

        if (!Array.isArray(parsedChats)) {
            return [];
        }

        return parsedChats.filter(chat =>
            chat &&
            typeof chat.id === "string" &&
            Array.isArray(chat.messages)
        );
    } catch (error) {
        console.error("Unable to load chat history:", error);
        return [];
    }
}

// ==========================================
// 5. SAVE CHATS
// ==========================================

function saveChats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch (error) {
        console.error("Unable to save chat history:", error);
    }
}

// ==========================================
// 6. RENDER MARKDOWN SAFELY
// ==========================================

function renderMarkdown(element, text) {
    const html = marked.parse(text || "");

    element.innerHTML = DOMPurify.sanitize(html);

    // Add Copy buttons to code blocks.
    addCodeCopyButtons(element);
}

// ==========================================
// 7. ADD COPY BUTTONS TO CODE BLOCKS
// ==========================================

function addCodeCopyButtons(container) {
    const codeBlocks = container.querySelectorAll("pre");

    codeBlocks.forEach(pre => {
        // Avoid creating duplicate buttons.
        if (pre.querySelector(".copy-code-btn")) {
            return;
        }

        const code = pre.querySelector("code");

        if (!code) {
            return;
        }

        const copyButton = document.createElement("button");

        copyButton.type = "button";
        copyButton.className = "copy-code-btn";
        copyButton.textContent = "Copy";
        copyButton.setAttribute("aria-label", "Copy code");

        copyButton.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(code.textContent);

                copyButton.textContent = "Copied!";

                setTimeout(() => {
                    copyButton.textContent = "Copy";
                }, 1500);
            } catch (error) {
                console.error("Unable to copy code:", error);
                copyButton.textContent = "Copy failed";

                setTimeout(() => {
                    copyButton.textContent = "Copy";
                }, 1500);
            }
        });

        pre.appendChild(copyButton);
    });
}

// ==========================================
// 8. CREATE A MESSAGE
// ==========================================

function createMessageElement(sender, text = "") {
    const messageElement = document.createElement("div");

    messageElement.classList.add(
        sender === "user" ? "user-message" : "ai-message"
    );

    renderMarkdown(messageElement, text);

    chatMessages.appendChild(messageElement);

    return messageElement;
}

// ==========================================
// 9. SCROLL TO LATEST MESSAGE
// ==========================================

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==========================================
// 10. SHOW OR HIDE WELCOME SCREEN
// ==========================================

function showWelcomeScreen() {
    welcomeScreen.style.display = "";
    chatArea.classList.remove("chatting");
}

function showChatScreen() {
    welcomeScreen.style.display = "none";
    chatArea.classList.add("chatting");
}

// ==========================================
// 11. RENDER RECENT CHATS
// ==========================================

function renderHistory() {
    historyList.replaceChildren();

    emptyHistory.style.display = chats.length ? "none" : "block";

    // Display the newest conversation first.
    [...chats].reverse().forEach(chat => {
        const historyItem = document.createElement("div");

        historyItem.className = "history-item";

        // Highlight the currently selected conversation.
        if (currentChat && currentChat.id === chat.id) {
            historyItem.classList.add("active");
        }

        const title = document.createElement("span");

        title.className = "history-chat-title";
        title.textContent = chat.title || "New Chat";
        title.title = title.textContent;

        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.className = "delete-chat-btn";
        deleteButton.textContent = "×";
        deleteButton.title = "Delete chat";
        deleteButton.setAttribute("aria-label", "Delete chat");

        historyItem.append(title, deleteButton);
        historyList.appendChild(historyItem);

        // Open the selected conversation.
        title.addEventListener("click", () => {
            if (isGenerating) {
                return;
            }

            openChat(chat.id);
            closeSidebar();
        });

        // Delete a conversation.
        deleteButton.addEventListener("click", event => {
            event.stopPropagation();

            if (isGenerating) {
                return;
            }

            deleteChat(chat.id);
        });
    });
}

// ==========================================
// 12. START A NEW CHAT
// ==========================================

function startNewChat() {
    if (isGenerating) {
        return;
    }

    currentChat = null;

    chatMessages.replaceChildren();

    showWelcomeScreen();
    renderHistory();

    userInput.focus();

    closeSidebar();
}

// ==========================================
// 13. OPEN AN EXISTING CHAT
// ==========================================

function openChat(chatId) {
    const selectedChat = chats.find(chat => chat.id === chatId);

    if (!selectedChat) {
        return;
    }

    currentChat = selectedChat;

    chatMessages.replaceChildren();

    showChatScreen();

    currentChat.messages.forEach(message => {
        createMessageElement(message.sender, message.text);
    });

    // Refresh sidebar to highlight the selected chat.
    renderHistory();

    scrollToBottom();
}

// ==========================================
// 14. DELETE A CHAT
// ==========================================

function deleteChat(chatId) {
    chats = chats.filter(chat => chat.id !== chatId);

    // If the active chat was deleted, return to welcome screen.
    if (currentChat && currentChat.id === chatId) {
        currentChat = null;

        chatMessages.replaceChildren();

        showWelcomeScreen();
    }

    saveChats();
    renderHistory();
}

// ==========================================
// 15. CREATE A CHAT WHEN NEEDED
// ==========================================

function ensureCurrentChat(firstMessage) {
    if (currentChat) {
        return;
    }

    currentChat = {
        id: crypto.randomUUID(),
        title: firstMessage.slice(0, 35),
        messages: []
    };

    chats.push(currentChat);
}

// ==========================================
// 16. SEND MESSAGE TO AI
// ==========================================

chatForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (isGenerating) {
        return;
    }

    const message = userInput.value.trim();

    if (!message) {
        return;
    }

    if (message.length > 10000) {
        alert("Your message is too long. Please shorten it.");
        return;
    }

    isGenerating = true;

    if (sendBtn) {
        sendBtn.disabled = true;
    }

    userInput.disabled = true;

    ensureCurrentChat(message);

    showChatScreen();

    // Store and display the user message.
    currentChat.messages.push({
        sender: "user",
        text: message
    });

    createMessageElement("user", message);

    userInput.value = "";

    saveChats();
    renderHistory();
    scrollToBottom();

    // Create an empty AI message for streaming.
    const aiMessageElement = createMessageElement("ai", "");

    let aiReply = "";

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            let errorMessage = "Unable to get a response. Please try again.";

            try {
                const errorData = await response.json();

                if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch {
                // Use the default error message.
            }

            throw new Error(errorMessage);
        }

        if (!response.body) {
            throw new Error("Streaming is not supported by this browser.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Read the AI response progressively.
        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            aiReply += decoder.decode(value, { stream: true });

            renderMarkdown(aiMessageElement, aiReply);

            scrollToBottom();
        }

        // Flush any remaining decoded text.
        aiReply += decoder.decode();

        renderMarkdown(aiMessageElement, aiReply);

        if (!aiReply.trim()) {
            aiReply = "I couldn't generate a response. Please try again.";

            renderMarkdown(aiMessageElement, aiReply);
        }
    } catch (error) {
        console.error("Chat request failed:", error);

        aiReply = error.message || "Something went wrong. Please try again.";

        renderMarkdown(aiMessageElement, aiReply);
    } finally {
        // Save the complete AI response.
        currentChat.messages.push({
            sender: "ai",
            text: aiReply
        });

        saveChats();
        renderHistory();
        scrollToBottom();

        isGenerating = false;

        userInput.disabled = false;

        if (sendBtn) {
            sendBtn.disabled = false;
        }

        userInput.focus();
    }
});

// ==========================================
// 17. NEW CHAT BUTTON
// ==========================================

newChatBtn.addEventListener("click", startNewChat);

// ==========================================
// 18. MOBILE SIDEBAR
// ==========================================

function openSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("active");
}

function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("active");
}

menuBtn.addEventListener("click", () => {
    if (sidebar.classList.contains("open")) {
        closeSidebar();
    } else {
        openSidebar();
    }
});

sidebarOverlay.addEventListener("click", closeSidebar);

// ==========================================
// 19. SHARE CONVERSATION
// ==========================================

shareBtn.addEventListener("click", async () => {
    if (!currentChat || currentChat.messages.length === 0) {
        alert("Start a conversation before sharing.");
        return;
    }

    const conversation = currentChat.messages
        .map(message => {
            const sender = message.sender === "user" ? "You" : "Nexora AI";

            return `${sender}:\n${message.text}`;
        })
        .join("\n\n");

    try {
        if (navigator.share) {
            await navigator.share({
                title: currentChat.title || "Nexora AI Conversation",
                text: conversation
            });
        } else if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(conversation);

            alert("Conversation copied successfully!");
        } else {
            alert("Sharing is not supported in this browser.");
        }
    } catch (error) {
        if (error.name !== "AbortError") {
            console.error("Sharing failed:", error);

            alert("Unable to share this conversation.");
        }
    }
});

// ==========================================
// 20. INITIALIZE APPLICATION
// ==========================================

renderHistory();

console.log("Nexora AI initialized successfully.");

