// home.js - simplified
// Random URL
function getRandomUrl() {
  const randomUrls = [
    "https://google.com",
    "https://wikipedia.org",
    "https://dictionary.com",
  ];
  return randomUrls[randRange(0, randomUrls.length)];
}

function randRange(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}
