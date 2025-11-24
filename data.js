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

// Save DB panel data
function savePanelToFirebase(dbId, data, callback) {
  db.ref("panels/" + dbId).set(data, function (error) {
    if (error) alert("Error saving DB: " + error);
    else if (callback) callback();
  });
}

// Load a DB panel
function loadPanelFromFirebase(dbId, callback) {
  db.ref("panels/" + dbId).once("value").then(snap => {
    callback(snap.val());
  });
}

// Load all DBs
function loadAllPanels(callback) {
  db.ref("panels").once("value").then(snap => {
    callback(snap.val());
  });
}


// ============================
//   DB INSPECTION FUNCTIONS
// ============================

// Save DB inspection report
function saveInspection(dbId, data, callback) {
  const key = db.ref().push().key;
  db.ref("inspections/" + dbId + "/" + key).set(data, err => {
    if (err) alert("Error saving inspection");
    else if (callback) callback(key);
  });
}

// Save DB fault report
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

// Save transformer metadata
function saveTransformer(trId, data, callback) {
  db.ref("transformers/" + trId).set(data, err => {
    if (err) alert("Error saving transformer: " + err);
    else if (callback) callback();
  });
}

// Load a transformer
function loadTransformer(trId, callback) {
  db.ref("transformers/" + trId).once("value").then(snap => {
    callback(snap.val());
  });
}

// Load all transformers
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
//       DELETE FUNCTIONS
// ============================

function deleteTransformer(trId, callback) {
  db.ref("transformers/" + trId).remove().then(() => {
    if (callback) callback();
  });
}

function deleteTransformerInspection(trId, key, callback) {
  db.ref("transformerInspections/" + trId + "/" + key).remove().then(() => {
    if (callback) callback();
  });
}

function deleteLuxReport(key, callback) {
  db.ref("luxReports/" + key).remove().then(() => {
    if (callback) callback();
  });
}

