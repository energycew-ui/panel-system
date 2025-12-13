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
  appId: "1:1070113583184:web:8d39b13d7391340d226155"
};

// ===============================
//  SAFE INITIALIZATION (FIX #1)
// ===============================
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Main Database reference
const db = firebase.database();


// =====================
//   DB PANEL FUNCTIONS
// =====================
function savePanelToFirebase(dbId, data, callback) {
  db.ref("panels/" + dbId).set(data)
    .then(() => callback && callback())
    .catch(err => alert("Error saving DB: " + err.message));
}

function loadPanelFromFirebase(dbId, callback) {
  db.ref("panels/" + dbId).once("value")
    .then(s => callback(s.val()));
}


// ============================
//     TRANSFORMERS
// ============================
function saveTransformer(trId, data, callback) {
  db.ref("transformers/" + trId).set(data)
    .then(() => callback && callback())
    .catch(err => alert("Error saving transformer: " + err.message));
}

function loadTransformer(trId, callback) {
  db.ref("transformers/" + trId).once("value")
    .then(s => callback(s.val()));
}


// ============================
//   TRANSFORMER INSPECTION
// ============================
function saveTransformerInspection(trId, data, callback) {
  const ref = db.ref("transformerInspections/" + trId).push();

  ref.set(data)
    .then(() => callback && callback(ref.key))
    .catch(err => alert("Error saving transformer report: " + err.message));
}


// ============================
//       LUX REPORTS (FIXED)
// ============================
function saveLuxReport(data, callback) {

  // FIX #2: push() gives key immediately (no delay)
  const ref = db.ref("luxReports").push();

  // FIX #3: write & respond fast
  ref.set(data)
    .then(() => {
      callback && callback(ref.key);
    })
    .catch(err => {
      alert("Error saving LUX report: " + err.message);
    });
}
