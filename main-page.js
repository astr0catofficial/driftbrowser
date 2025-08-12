const urlInput = document.getElementById('urlInput');
const backButton = document.getElementById('backButton');
const forwardButton = document.getElementById('forwardButton');
const refreshButton = document.getElementById('refreshButton');
const homeButton = document.getElementById('homeButton');
const devToolsButton = document.getElementById('devToolsButton');
const browserFrame = document.getElementById('browserFrame');
const homepage = document.getElementById('homepage');
const homepageSearchInput = document.getElementById('homepageSearchInput');
const mainContentArea = document.getElementById('mainContentArea');
const settingsModal = document.getElementById('settingsModal');
const closeModalButton = document.getElementById('closeModal');
const saveSettingsButton = document.getElementById('saveSettings');
const loadingOverlay = document.getElementById('loadingOverlay');
const suggestionIconsContainer = document.querySelector('.suggestion-icons-container');
const darkModeToggle = document.getElementById('darkModeToggle');
const enableAnimationsToggle = document.getElementById('enableAnimationsToggle');

function decodeBase64(encodedString) {
    try {
        return atob(encodedString);
    } catch (e) {
        console.error("Base64 decoding failed:", e);
        return null;
    }
}

async function proxyLoad(url, frame, loadingOverlay) {
    if (loadingOverlay) loadingOverlay.classList.add('active');

    let actualTargetUrl = url;
    const verdantProxyPrefix = window.location.origin + '/route/';

    if (url.startsWith(verdantProxyPrefix)) {
        const encodedPart = url.substring(verdantProxyPrefix.length);
        const decodedUrl = decodeBase64(encodedPart);
        if (decodedUrl) {
            actualTargetUrl = decodedUrl;
            console.log(`Detected Verdant proxy URL. Decoded to: ${actualTargetUrl}`);
        } else {
            console.warn(`Could not decode Verdant proxy URL. Falling back to original input: ${url}`);
            actualTargetUrl = url;
        }
    } else {
        actualTargetUrl = actualTargetUrl.replace(/^(https?:\/\/)?/, '');
    }

    const urlToFetch = actualTargetUrl.includes('.')
        ? `https://${actualTargetUrl}`
        : `https://html.duckduckgo.com/html?q=${encodeURIComponent(actualTargetUrl)}`;

    const proxyChain = [
        "https://corsproxy.io/?",
        "https://api.allorigins.win/raw?url=",
        "https://proxy.cors.sh/",
        "https://yacdn.com/proxy/",
        "https://api.codetabs.com/v1/proxy/?quest=",
        "https://cors.eu.org/",
        "https://cors.io/?",
        "https://api.proxied.host/",
        "https://crossorigin.me/",
        "https://web.archive.org/web/",
        "https://thingproxy.freeboard.io/fetch/",
        "https://toothpaste.bekekes390.workers.dev/?url=",
    ];

    let response = null;
    let lastError = "Unknown error, no proxy successfully fetched the content.";

    for (let i = 0; i < proxyChain.length; i++) {
        const currentProxyBase = proxyChain[i];
        let currentProxyUrl = currentProxyBase + encodeURIComponent(urlToFetch);

        console.log(`Attempting to fetch with proxy ${i + 1}: ${currentProxyUrl}`);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);

            response = await fetch(currentProxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                console.log(`Successfully fetched using proxy ${i + 1}.`);
                break;
            } else {
                lastError = `Proxy ${i + 1} failed with status ${response.status} ${response.statusText}.`;
                console.warn(lastError);
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                lastError = `Proxy ${i + 1} request timed out.`;
            } else {
                lastError = `Proxy ${i + 1} threw an error: ${e.message}.`;
            }
            console.error(lastError);
        }
    }

    if (!response || !response.ok) {
        throw new Error(`Failed to load content. All proxy attempts failed. Last detailed error: ${lastError}`);
    }

    try {
        const html = await response.text();
        const baseUrl = new URL(urlToFetch).origin;

        const processed = html
            .replace(/<head>/i, `<head><base href="${baseUrl}/">`)
            .replace(/<body([^>]*)>/i, `<body$1 style="margin:0;">`);

        const blob = new Blob([processed], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);

        console.log('Blob URL ready:', blobUrl);

        frame.src = blobUrl;

        frame.onload = () => {
            console.log('Frame loaded!');
            if (loadingOverlay) loadingOverlay.classList.remove('active');

            try {
                const iframeDoc = frame.contentDocument;
                if (iframeDoc && iframeDoc.body) {
                    iframeDoc.body.addEventListener('click', (e) => {
                        let targetElement = e.target;
                        let urlToRedirect = '';
                        let isHandled = false;

                        while (targetElement && targetElement !== iframeDoc.body) {
                            if (targetElement.tagName === 'A' && targetElement.href) {
                                urlToRedirect = targetElement.href;
                                isHandled = true;
                                break;
                            }
                            if (targetElement.onclick || targetElement.hasAttribute('data-href') || targetElement.hasAttribute('data-url')) {
                                urlToRedirect = targetElement.getAttribute('data-href') || targetElement.getAttribute('data-url') || '';
                                if (!urlToRedirect && targetElement.onclick) {
                                    const onclickString = targetElement.onclick.toString();
                                    const match = /(?:location\.href|window\.location|location\.assign|window\.open)\s*=\s*['"]([^'"]+)['"]/.exec(onclickString);
                                    if (match && match[1]) {
                                        urlToRedirect = match[1];
                                    }
                                }
                                if (urlToRedirect) {
                                    isHandled = true;
                                    break;
                                }
                            }
                            targetElement = targetElement.parentElement;
                        }

                        if (isHandled && urlToRedirect) {
                            e.preventDefault();
                            e.stopPropagation();

                            try {
                                const absoluteUrl = new URL(urlToRedirect, new URL(frame.srcdoc ? frame.src : frame.src).origin).href;
                                console.log(`Intercepted navigation to: ${absoluteUrl}`);
                                proxyLoad(absoluteUrl, frame, loadingOverlay);
                            } catch (urlError) {
                                console.warn("Invalid URL for interception, attempting fallback:", urlToRedirect, urlError);
                                proxyLoad(urlToRedirect, frame, loadingOverlay);
                            }
                        }
                    }, true);
                }
            } catch (e) {
                console.warn('Frame access error (expected for cross-origin iframes when intercepting links):', e);
                console.warn('Internal navigation on some sites might not work automatically due to security restrictions.');
            }
        };

    } catch (error) {
        console.error('Browser Error (during HTML processing/blob creation):', error);
        frame.srcdoc = `
            <div style="color:white;text-align:center;font-size:20px;font-family:sans-serif;padding:50px;background-color:#333;">
                Error: Failed to load content.<br><br>
                This might be due to a proxy issue, or the target website being inaccessible.
                Please try a different URL or try again later.
                <br><br>
                Tip: For complex sites, internal links might not work automatically. Try copying the full URL and pasting it into the bar above.
            </div>
        `;
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

function showHomepage() {
    homepage.classList.remove('hidden');
    browserFrame.classList.add('hidden');
    urlInput.value = "";
}

function showBrowserFrame() {
    homepage.classList.add('hidden');
    browserFrame.classList.remove('hidden');
}

function navigateToUrl(url) {
    if (!url.trim()) {
        showHomepage();
        return;
    }
    proxyLoad(url, browserFrame, loadingOverlay);
    urlInput.value = url;
    showBrowserFrame();
}

function applyTheme(isDarkMode) {
    if (isDarkMode) {
        document.body.classList.remove('light-mode');
    } else {
        document.body.classList.add('light-mode');
    }
    localStorage.setItem('darkMode', isDarkMode);
}

urlInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        navigateToUrl(urlInput.value);
    }
});

homepageSearchInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        const query = homepageSearchInput.value;
        if (query.trim()) {
            navigateToUrl(query);
        }
    }
});

backButton.addEventListener('click', function() {
    if (browserFrame.classList.contains('hidden') || browserFrame.contentWindow.history.length <= 1) {
        showHomepage();
    } else {
        browserFrame.contentWindow.history.back();
    }
});

forwardButton.addEventListener('click', function() {
    if (!browserFrame.classList.contains('hidden')) {
        browserFrame.contentWindow.history.forward();
    }
});

refreshButton.addEventListener('click', function() {
    if (!browserFrame.classList.contains('hidden')) {
        browserFrame.contentWindow.location.reload();
    } else {
        showHomepage();
    }
});

homeButton.addEventListener('click', function() {
    showHomepage();
});

devToolsButton.addEventListener('click', function() {
    settingsModal.classList.remove('hidden');
});

closeModalButton.addEventListener('click', function() {
    settingsModal.classList.add('hidden');
});

saveSettingsButton.addEventListener('click', function() {
    alert("Settings saved! (This is a placeholder action)");
    settingsModal.classList.add('hidden');
});

suggestionIconsContainer.addEventListener('click', function(event) {
    const wrapper = event.target.closest('.suggestion-icon-wrapper');
    if (wrapper) {
        const url = wrapper.dataset.url;
        if (url) {
            navigateToUrl(url);
        }
    }
});

darkModeToggle.addEventListener('change', function() {
    applyTheme(this.checked);
});

enableAnimationsToggle.addEventListener('change', function() {
    if (this.checked) {
        console.log("Animations Enabled (placeholder)");
    } else {
        console.log("Animations Disabled (placeholder)");
    }
});

window.onload = function() {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
        const isDarkMode = savedDarkMode === 'true';
        darkModeToggle.checked = isDarkMode;
        applyTheme(isDarkMode);
    } else {
        darkModeToggle.checked = true;
        applyTheme(true);
    }
    showHomepage();
};
