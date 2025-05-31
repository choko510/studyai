// i.js
window.addEventListener("load", () => {
  navigator.serviceWorker.register("../sw.js?v=2025-04-15", {
    scope: "/a/",
  });
});

let xl;

try {
  xl = window.top.location.pathname === "/d";
} catch {
  try {
    xl = window.parent.location.pathname === "/d";
  } catch {
    xl = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  processUrl("https://loilonote.app/login");

});

function processUrl(value) {
  let url = value.trim();
  const engine = localStorage.getItem("engine");
  const searchUrl = engine ? engine : "https://www.google.com/search?q=";

  if (!isUrl(url)) {
    url = searchUrl + url;
  } else if (!(url.startsWith("https://") || url.startsWith("http://"))) {
    url = `https://${url}`;
  }

  const dy = localStorage.getItem("dy");

  if (dy === "true") {
    window.location.href = `/a/q/${__uv$config.encodeUrl(url)}`;
  } else {
    window.location.href = `/a/${__uv$config.encodeUrl(url)}`;
  }
}

function go(value) {
  processUrl(value);
}

function blank(value) {
  processUrl(value);
}

function dy(value) {
  processUrl(value);
}

function isUrl(val = "") {
  if (
    /^http(s?):\/\//.test(val) ||
    (val.includes(".") && val.substr(0, 1) !== " ")
  ) {
    return true;
  }
  return false;
}
