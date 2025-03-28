function normalizeUrl(inputUrl) {
    try {
        if (!inputUrl.startsWith("https://") && !inputUrl.startsWith("http://")) {
            inputUrl = "https://" + inputUrl;
        }
      const url = new URL(inputUrl)
      let hostname = url.hostname.replace(/^www\./, '');
      let pathname = url.pathname.replace(/\/+$/, '');
      let normalized = `${hostname}${pathname}`;
      if (url.search) normalized += url.search;
      if (url.hash) normalized += url.hash;
  
      return normalized;
    } catch (e) {
      console.error('Invalid URL:', inputUrl);
      return null;
    }
  }
  

var meta = document.createElement("meta");
meta.name = "theme-color";
meta.content = sessionStorage.getItem("theme-color") || "royalblue";
document.head.appendChild(meta);
// Get the meta theme-color content
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const themeColor = themeColorMeta ? themeColorMeta.getAttribute('content') : '#4285f4';

// Apply it to a CSS variable
document.documentElement.style.setProperty('--theme-color', themeColor);

var button = document.getElementById("signin_button") || null;

document.addEventListener("DOMContentLoaded", function () {
document.getElementById('signin-form').addEventListener('submit', function(e) {
    e.preventDefault();
    // disable form input
    var input = document.getElementById('api-key');
    input.disabled = true;
    // disable button
    var button = document.getElementById('signin_button');
    button.disabled = true;
    // change button text
    button.textContent = "Loading ...";
    // console.log("Setting API key.");
    chrome.runtime.sendMessage({ action: "setApiKey", key: document
        .getElementById('api-key')
        .value }, function(response) {

            if (response.success) {
                chrome.runtime.reload();
            } else {
                // console.error("Failed to set API key.");
                // enable form input
                input.disabled = false;
                // enable button
                button.disabled = false;
                // change button text
                button.textContent = "Sign in";
            }
        });
});
});

function addLinksToList (response, linkList, same_site=false, second_degree=false) {
    var linksForPage = response.links;
    var subscribedTo = response.subscribedTo;
    var added_link = false;
    for (var i = 0; i < linksForPage.length; i++) {
        if (same_site) {
            var linksForPage = linksForPage.filter(link => {
                return new URL("https://" + link.link).hostname === new URL(pageUrl).hostname;
            });
        } else if (second_degree) {
            var linksForPage = linksForPage.filter(link => {
                return new URL("https://" + link.link).hostname !== new URL(pageUrl).hostname && subscribedTo.includes(new URL("https://" + link.link).hostname);
            });
        } else {
            var linksForPage = linksForPage.filter(link => {
                return new URL("https://" + link.link).hostname !== new URL(pageUrl).hostname;
            });
        }
        if (linksForPage.length === 0) {
            return;
        }
        var link = document.createElement("li");
        var a = document.createElement("a");
        a.setAttribute("href", "https://" + linksForPage[i].link);
        a.setAttribute("target", "_blank");

        // trim trailing slash
        var url = normalizeUrl(linksForPage[i].link);
        var normalised_url = normalizeUrl(pageUrl);
        console.log(response.bidirectional_links[linksForPage[i].link]);
        if (response.bidirectional_links[normalised_url] && response.bidirectional_links[normalised_url].includes(linksForPage[i].link) && response.bidirectional_links[linksForPage[i].link] && response.bidirectional_links[linksForPage[i].link].includes(normalised_url)) {
            a.style.color = "green";
            console.log("bidirectional link", linksForPage[i].link);
        }
        // anchor shouldn't show https://
        if (linksForPage[i].title) {
            a.textContent = linksForPage[i].title;
        } else {
            a.textContent = url.replace(/^www\./, '');
            a.textContent = a.textContent.replace(/^https?:\/\//, '');
            // if its same site, remove domain
            if (same_site) {
                a.textContent = a.textContent.replace(new URL(pageUrl).hostname, '');
            }
        }

        link.appendChild(a);
        // if title, add domain name below
        if (linksForPage[i].title) {
            var domain = document.createElement("p");
            var domainName = new URL("https://" + linksForPage[i].link);
            domain.textContent = domainName.hostname;
            domain.className = "domain";
            link.appendChild(domain);
        }

        linkList.appendChild(link);
        added_link = true;
    }

    return added_link;
}

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    pageUrl = tab.url;
    chrome.runtime.sendMessage({ action: "getLinks", url: pageUrl }, function (response) {
        var linkContainer = document.getElementById("link-container");
        var noLinkContainer = document.getElementById("no-link-container");

        if (!response || response.failed) {
            var signin = document.getElementById("signin");
            signin.style.display = "block";
            console.error("Failed to get links.", response);
            return;
        }

        var linksForPage = response.links;

        if (linksForPage && linksForPage.length > 0) {
            linkContainer.style.display = "block";
            noLinkContainer.style.display = "none";

            var linkList = document.getElementById("links");
            var added_other_site_link = addLinksToList(response, linkList, same_site=false);

            if (added_other_site_link) {
                // add h3 above same site links
                var sameSiteLinks = document.createElement("h3");
                sameSiteLinks.textContent = "Links from sites you follow:";
                linkList.before(sameSiteLinks);
            }

            var secondDegreeLinks = document.getElementById("second-degree-links");
            var added_second_degree = addLinksToList(response, secondDegreeLinks, same_site=false, second_degree=true);

            if (added_second_degree) {
                // add h3 above same site links
                var sameSiteLinks = document.createElement("h3");
                sameSiteLinks.textContent = "Links from other sites:";
                linkList.before(sameSiteLinks);
            }

            var sameSiteLinkList = document.getElementById("same-site-links");
            var added_same_site_link = addLinksToList(response, sameSiteLinkList, same_site=true);

            // add h3
            if (added_same_site_link) {
                var otherSiteLinks = document.createElement("h3");
                otherSiteLinks.textContent = "Links to this page on this site:";
                sameSiteLinkList.before(otherSiteLinks);
            }
        } else {
            linkContainer.style.display = "none";
            noLinkContainer.style.display = "block";
        }
    });
});