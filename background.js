function normalizeUrl(inputUrl) {
    try {
      const url = new URL(inputUrl);
  
      // Remove 'www.' from hostname
      let hostname = url.hostname.replace(/^www\./, '');
  
      // Remove trailing slashes from pathname
      let pathname = url.pathname.replace(/\/+$/, '');
  
      // Reconstruct the normalized URL without protocol
      let normalized = `${hostname}${pathname}`;
  
      // Include query and hash if present
      if (url.search) normalized += url.search;
      if (url.hash) normalized += url.hash;
  
      return normalized;
    } catch (e) {
      console.error('Invalid URL:', inputUrl);
      return null;
    }
  }  

var ENDPOINT_URL = "https://artemis.jamesg.blog";

var CACHE_PREFIX = "";

if (ENDPOINT_URL.includes("localhost")) {
    CACHE_PREFIX = "staging-";
}

console.log("Cache prefix:", CACHE_PREFIX);

var date = new Date();
var today = date.toISOString().split("T")[0];

var failed = false;
function getCache() {
    console.log("No cache found for today. Fetching links from Artemis.");

    return new Promise((resolve, reject) => {
        chrome.storage.local.get("api-key", (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error("Error fetching API key from storage."));
                return;
            }

            const apiKey = result["api-key"];
            if (!apiKey) {
                reject(new Error("API key not found in storage."));
                return;
            }

            fetch(ENDPOINT_URL + "/link-graph.json", {
                method: "GET",
                headers: new Headers({
                    "Authorization": apiKey
                }),
            })
            .then(response => {
                if (response.status === 401) {
                    console.error("Unauthorized: Invalid API key.");
                    throw new Error("Unauthorized");
                }
                return response.json();
            })
            .then(data => {
                // delete all other cache
                chrome.storage.local.get(null, function(items) {
                    for (var key in items) {
                        if (key.startsWith(CACHE_PREFIX) && key !== `${CACHE_PREFIX}link-graph-${today}` && key !== "api-key") {
                            chrome.storage.local.remove(key);
                        }
                    }
                });
                console.log("Fetched links from Artemis.");
                chrome.storage.local.set({ [`${CACHE_PREFIX}link-graph-${today}`]: JSON.stringify(data) }, () => {
                    resolve(data); // Resolve the Promise with the fetched data
                });
            })
            .catch(err => {
                console.error("Failed to fetch links from Artemis.");
                console.error(err);
                reject(err); // Reject the Promise in case of error
            });
        });
    });
}


    // function process() {
    console.log("Configuring link graph... for today:", today);

    chrome.storage.local.get(`${CACHE_PREFIX}link-graph-${today}`, (result) => {
        var cache = result[`${CACHE_PREFIX}link-graph-${today}`] ? JSON.parse(result[`${CACHE_PREFIX}link-graph-${today}`]) : null;

        if (!cache) {
            getCache().then((data) => {
                cache = data;
                updateTab();
            })
            .catch(err => {
                failed = true;
                console.error("Failed to fetch links from Artemis.");
                console.error(err);
                chrome.action.setBadgeText({ text: "!" });
            });
        }
        

        function updateTab (activeInfo) {
            var tabId = (typeof activeInfo === "number") ? activeInfo : activeInfo.tabId;

            // console.log("Updating tab:", tabId);
            chrome.action.setBadgeText({ text: "" });
            chrome.action.setIcon({"path": "mascot.png"});
            if (!tabId) return;
            chrome.tabs.get(tabId, function (tab) {
                chrome.action.setBadgeText({ text: "" });
                if (!cache) return; // Ensure cache is available

                var subscriptions = cache["subscriptions"];

                var tabDomain = new URL(tab.url).hostname;
                var tabPath = new URL(tab.url).pathname;

                tabPath = tabPath.replace(/\/$/, '');
                tabPath = tabPath || "/";

                var linksForPage = cache["links"]?.[tabDomain]?.[tabPath] || [];

                if (linksForPage.length > 0) {
                    chrome.action.setBadgeText({ text: linksForPage.length.toString() });
                    chrome.action.setBadgeBackgroundColor({ color: "#" + cache["preferences"]["theme_color"] || "royalblue" });
                }

                if (subscriptions.includes(tabDomain)) {
                    chrome.action.setIcon({"path": "link_found.png"});
                }
            });
        }

        chrome.tabs.onActivated.addListener(updateTab);
        chrome.tabs.onUpdated.addListener(updateTab);
        chrome.tabs.onCreated.addListener(updateTab);
        chrome.tabs.onReplaced.addListener(updateTab);

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            updateTab({ tabId: tabs[0].id });
        });

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "getLinks") {
                if (!cache) {
                    sendResponse({ failed: true });
                    return;
                }
                var url = normalizeUrl(request.url);
                var tabDomain = new URL(request.url).hostname;
                var tabPath = new URL(request.url).pathname;
                // trim / from path
                tabPath = tabPath.replace(/\/$/, '');
                // if no path, set to /
                tabPath = tabPath || "/";
                // remove www from domain
                tabDomain = tabDomain.replace(/^www\./, '');

                sendResponse({ 
                    links: cache["links"]?.[tabDomain]?.[tabPath] || [],
                    failed: failed, 
                    bidirectional_links: cache["bidirectional_links"] || [] ,
                    subscribedTo: cache["subscribed_to"] || []
                });
            } else if (request.action === "setApiKey") {
                chrome.storage.local.set({ "api-key": request.key });
                getCache().then(() => {
                    sendResponse({ success: true });
                });
            }
            return true; 
        });
    });