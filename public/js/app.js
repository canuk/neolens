// app.js
let chatHistory = [];
let canvasElement, canvas;
let video, outputData, messageInput, sendButton, chatMessages;

// Functions
function showPage(pageId) {
    console.log('Showing page:', pageId);
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    const activePage = document.getElementById(pageId);
    if (activePage) {
        activePage.classList.add('active');
    } else {
        console.error('Page not found:', pageId);
    }

    if (pageId === 'qrPage') {
        startCamera();
    } else {
        stopCamera();
    }

    if (pageId === 'chatPage' && chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function stopCamera() {
    if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
}

function startCamera() {
    if (!video) {
        video = document.getElementById('qrVideo');
        if (!video) {
            console.error('QR video element not found');
            return;
        }
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(function(stream) {
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();
        requestAnimationFrame(tick);
    })
    .catch(function(error) {
        console.error('Error accessing the camera:', error);
        if (outputData) {
            outputData.innerText = 'Error accessing the camera. Please check permissions.';
        }
    });
}

function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        if (!canvasElement) {
            canvasElement = document.createElement("canvas");
            canvasElement.width = video.videoWidth;
            canvasElement.height = video.videoHeight;
            canvas = canvasElement.getContext("2d", { willReadFrequently: true });
        }
        canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });

        if (code) {
            outputData.innerText = `QR Code detected: ${code.data}`;
            if (code.data === "DJI Mavic Air") {
                showPage('chatPage');
                initializeChat();
            }
        } else {
            outputData.innerText = "No QR Code detected";
        }
    }
    if (document.getElementById('qrPage').classList.contains('active')) {
        requestAnimationFrame(tick);
    }
}

function initializeChat() {
    chatMessages.innerHTML = '';
    addMessage("Hello! I've detected that you're asking about the <em>DJI Mavic Air</em> Drone. How can I assist you with this device?", 'received');
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        addMessage(message, ['sent']);
        messageInput.value = '';
        
        const loadingMessage = addMessage('', ['received', 'loading']);
        const dotFlashing = document.createElement('div');
        dotFlashing.className = 'dot-flashing';
        loadingMessage.appendChild(dotFlashing);
        
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            loadingMessage.remove();
            addMessage(result.response, ['received']);
            setTimeout(() => {
                addMessage(`<a href='/aframe.html'>Tap to view Augmented Instructions</a>`, 'received');
            }, 1500);               
        } catch (error) {
            console.error('Error querying Pinecone Assistant:', error);
            loadingMessage.remove();
            addMessage('Sorry, I encountered an error while processing your request.', ['received', 'error']);
        }
    }
}

function addMessage(text, classes) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (Array.isArray(classes)) {
        classes.forEach(className => {
            if (className) messageElement.classList.add(className.trim());
        });
    } else if (typeof classes === 'string') {
        messageElement.classList.add(classes.trim());
    }
    
    if (!classes.includes('loading')) {
        const htmlContent = DOMPurify.sanitize(marked.parse(text));
        messageElement.innerHTML = htmlContent;
    }
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageElement;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    video = document.getElementById('qrVideo');
    outputData = document.getElementById('output');
    messageInput = document.getElementById('messageInput');
    sendButton = document.getElementById('sendButton');
    chatMessages = document.getElementById('chatMessages');

    document.querySelector('#footer .fa-home').addEventListener('click', () => showPage('homePage'));
    document.querySelector('#footer .fa-qrcode').addEventListener('click', () => showPage('qrPage'));
    document.querySelector('#footer .fa-comments').addEventListener('click', () => showPage('chatPage'));
    document.querySelector('#footer .fa-vr-cardboard').addEventListener('click', () => showPage('arPage'));

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    if (typeof jsQR === 'undefined') {
        console.error('jsQR library not loaded. Please check your internet connection and try again.');
        outputData.innerText = 'Error: QR scanning library not loaded.';
    }
});

// Initialize the app
showPage('homePage');