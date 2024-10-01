// Global variables
let chatHistory = [];
let video, canvasElement, outputData, messageInput, sendButton, chatMessages;

let pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';

let pdfDoc = null;
let pageIndex = 0;
let pageNumbers = [];
let pageRendering = false;
let pageNumPending = null;
let scale = 2.5;
let canvas = document.getElementById('pdfCanvas');
let ctx = canvas.getContext('2d');

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

function renderPage(index) {
    pageRendering = true;
    let num = pageNumbers[index];
    pdfDoc.getPage(num).then(function(page) {
        let viewport = page.getViewport({scale: scale});
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        let renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        let renderTask = page.render(renderContext);

        renderTask.promise.then(function() {
            pageRendering = false;
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });

    updatePageInfo();
}

function updatePageInfo() {
    const pageInfo = document.getElementById('pageInfo');
    if (pageNumbers.length > 1) {
        pageInfo.textContent = `Page ${pageNumbers[pageIndex]} of ${pdfDoc.numPages} (${pageIndex + 1}/${pageNumbers.length})`;
    } else {
        pageInfo.textContent = `Page ${pageNumbers[pageIndex]} of ${pdfDoc.numPages}`;
    }
}

function queueRenderPage(index) {
    if (pageRendering) {
        pageNumPending = index;
    } else {
        renderPage(index);
    }
}

function onPrevPage() {
    if (pageIndex <= 0) {
        return;
    }
    pageIndex--;
    queueRenderPage(pageIndex);
}

function onNextPage() {
    if (pageIndex >= pageNumbers.length - 1) {
        return;
    }
    pageIndex++;
    queueRenderPage(pageIndex);
}

function parsePageReferences(pages) {
    let pageSet = new Set();
    pages.split(',').forEach(part => {
        part = part.trim();
        if (part.includes('-')) {
            let [start, end] = part.split('-').map(num => parseInt(num));
            for (let i = start; i <= end; i++) {
                pageSet.add(i);
            }
        } else {
            pageSet.add(parseInt(part));
        }
    });
    return Array.from(pageSet).sort((a, b) => a - b);
}

function openPdfModal(event) {
    event.preventDefault();
    const pdfUrl = event.target.href;
    const pages = event.target.getAttribute('data-pages');
    const title = event.target.getAttribute('title');

    const modal = document.getElementById('pdfModal');
    const modalTitle = document.getElementById('pdfModalTitle');
    const pdfNavigation = document.querySelector('.pdf-navigation');
    
    modalTitle.textContent = title;
    modal.style.display = 'block';

    pageNumbers = parsePageReferences(pages);
    pageIndex = 0;

    // Show or hide navigation based on number of pages
    if (pageNumbers.length > 1) {
        pdfNavigation.style.display = 'flex';
    } else {
        pdfNavigation.style.display = 'none';
    }

    pdfjsLib.getDocument(pdfUrl).promise.then(function(pdfDoc_) {
        pdfDoc = pdfDoc_;
        renderPage(pageIndex);
    });
}

// Event listeners for navigation buttons
document.getElementById('prevPage').addEventListener('click', onPrevPage);
document.getElementById('nextPage').addEventListener('click', onNextPage);

// Close modal functionality
document.querySelector('.close').onclick = function() {
    document.getElementById('pdfModal').style.display = "none";
}

window.onclick = function(event) {
    let modal = document.getElementById('pdfModal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
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
    document.querySelector('#footer .fa-vr-cardboard').addEventListener('click', () => window.location.href = '/ar-studio');

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Add event listener for PDF links
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('pdf-link')) {
            openPdfModal(e);
        }
    });

    if (typeof jsQR === 'undefined') {
        console.error('jsQR library not loaded. Please check your internet connection and try again.');
        outputData.innerText = 'Error: QR scanning library not loaded.';
    }
});

// Initialize the app
showPage('homePage');