// settings.js - simplified
document.addEventListener("DOMContentLoaded", () => {
  // Proxy selection
  function pChange(selectedValue) {
    if (selectedValue === "uv") {
      localStorage.setItem("uv", "true");
      localStorage.setItem("dy", "false");
    } else if (selectedValue === "dy") {
      localStorage.setItem("uv", "false");
      localStorage.setItem("dy", "true");
    }
  }

  const pChangeElement = document.getElementById("pChange");

  if (pChangeElement) {
    pChangeElement.addEventListener("change", function () {
      const selectedOption = this.value;
      pChange(selectedOption);
    });

    const storedP = localStorage.getItem("uv");
    if (storedP === "true") {
      pChangeElement.value = "uv";
    } else if (
      localStorage.getItem("dy") === "true" ||
      localStorage.getItem("dy") === "auto"
    ) {
      pChangeElement.value = "dy";
    } else {
      pChangeElement.value = "uv";
    }
  }
});

// Search Engine
function EngineChange(dropdown) {
  const selectedEngine = dropdown.value;

  const engineUrls = {
    Google: "https://www.google.com/search?q=",
    Bing: "https://www.bing.com/search?q=",
    DuckDuckGo: "https://duckduckgo.com/?q=",
    Qwant: "https://www.qwant.com/?q=",
    Startpage: "https://www.startpage.com/search?q=",
    SearchEncrypt: "https://www.searchencrypt.com/search/?q=",
    Ecosia: "https://www.ecosia.org/search?q=",
  };

  localStorage.setItem("engine", engineUrls[selectedEngine]);
  localStorage.setItem("enginename", selectedEngine);

  dropdown.value = selectedEngine;
}

function SaveEngine() {
  const customEngine = document.getElementById("engine-form").value;
  if (customEngine.trim() !== "") {
    localStorage.setItem("engine", customEngine);
    localStorage.setItem("enginename", "Custom");
  } else {
    alert("Please enter a custom search engine value.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const selectedEngineName = localStorage.getItem("enginename");
  const dropdown = document.getElementById("engine");
  if (selectedEngineName && dropdown) {
    dropdown.value = selectedEngineName;
  }
});
