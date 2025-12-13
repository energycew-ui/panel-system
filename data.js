// ===============================
//  Firebase Configuration (REAL)
// ===============================
const firebaseConfig = {
  apiKey: "AIzaSyCpwcWdIGG21HNSO4LC9jXxCzCFXvE0fGY",
  authDomain: "panel-system-842d9.firebaseapp.com",
  databaseURL: "https://panel-system-842d9-default-rtdb.firebaseio.com",
  projectId: "panel-system-842d9",
  storageBucket: "panel-system-842d9.firebasestorage.app",
  messagingSenderId: "1070113583184",
  appId: "1:1070113583184:web:8d39b13d7391340d226155",
  measurementId: "G-Q9TEYT2M0P"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Main Database reference
const db = firebase.database();


// =====================
//   DB PANEL FUNCTIONS
// =====================
function savePanelToFirebase(dbId, data, callback) {
  db.ref("panels/" + dbId).set(data, function (error) {
    if (error) alert("Error saving DB: " + error);
    else if (callback) callback();
  });
}

function loadPanelFromFirebase(dbId, callback) {
  db.ref("panels/" + dbId).once("value").then(snap => {
    callback(snap.val());
  });
}

function loadAllPanels(callback) {
  db.ref("panels").once("value").then(snap => {
    callback(snap.val());
  });
}


// ============================
//   DB INSPECTION FUNCTIONS
// ============================
function saveInspection(dbId, data, callback) {
  const key = db.ref().push().key;
  db.ref("inspections/" + dbId + "/" + key).set(data, err => {
    if (err) alert("Error saving inspection");
    else if (callback) callback(key);
  });
}

function saveFault(dbId, data, callback) {
  const key = db.ref().push().key;
  db.ref("faults/" + dbId + "/" + key).set(data, err => {
    if (err) alert("Error saving fault");
    else if (callback) callback(key);
  });
}


// ============================
//     TRANSFORMER ENTRY
// ============================
function saveTransformer(trId, data, callback) {
  db.ref("transformers/" + trId).set(data, err => {
    if (err) alert("Error saving transformer: " + err);
    else if (callback) callback();
  });
}

function loadTransformer(trId, callback) {
  db.ref("transformers/" + trId).once("value").then(snap => {
    callback(snap.val());
  });
}

function loadAllTransformers(callback) {
  db.ref("transformers").once("value").then(snap => {
    callback(snap.val());
  });
}


// ======================================
//   TRANSFORMER INSPECTION REPORTS
// ======================================
function saveTransformerInspection(trId, data, callback) {
  const key = db.ref().push().key;
  db.ref("transformerInspections/" + trId + "/" + key).set(data, err => {
    if (err) alert("Error saving transformer report");
    else if (callback) callback(key);
  });
}

function loadTransformerInspection(trId, callback) {
  db.ref("transformerInspections/" + trId).once("value").then(snap => {
    callback(snap.val());
  });
}


// ============================
//       LUX REPORTS
// ============================
function saveLuxReport(data, callback) {
  const key = db.ref().push().key;
  db.ref("luxReports/" + key).set(data, err => {
    if (err) alert("Error saving LUX report");
    else if (callback) callback(key);
  });
}

function loadAllLuxReports(callback) {
  db.ref("luxReports").once("value").then(snap => {
    callback(snap.val());
  });
}


// ============================
//   LUX CONFIG (ADMIN)
// ============================

// Save Lux Meter master configuration
function saveLuxConfig(data, callback) {
  db.ref("luxConfig").set(data, err => {
    if (err) alert("Error saving LUX config");
    else if (callback) callback();
  });
}

// Load Lux Meter master configuration
function loadLuxConfig(callback) {
  db.ref("luxConfig").once("value").then(snap => {
    callback(snap.val());
  });
}
