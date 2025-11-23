// data.js
let panelData = {
    "DB-01": {
        dbNumber: "DB-01",
        voltage: "415V",
        mainBreaker: "125A",
        cableSize: "16mm²",
        earthStatus: "OK",
        location: "Ground Floor - Lobby",
        purpose: "Lighting"
    }
};

// Save to localStorage
function saveData() {
    localStorage.setItem("panelData", JSON.stringify(panelData));
}

// Load from localStorage
function loadData() {
    let stored = localStorage.getItem("panelData");
    if (stored) panelData = JSON.parse(stored);
}

loadData();
