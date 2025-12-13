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
//  SAFE FIREBASE INITIALIZATION
//  (THIS WAS THE REAL FIX NEEDED)
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
  db.ref("panels/" + dbId).set(data, function (error) {
    if (error) alert("Error saving DB: " + error);
    else if (callback) callback();
  });
}

function loadPanelFromFirebase(dbId, callback) {
  db.ref("panels/" + dbId).once("value", snap => {
    callback(snap.val());
  });
}


// ============================
//     TRANSFORMERS
// ============================
function saveTransformer(trId, data, callback) {
  db.ref("transformers/" + trId).set(data, function (error) {
    if (error) alert("Error saving transformer: " + error);
    else if (callback) callback();
  });
}

function loadTransformer(trId, callback) {
  db.ref("transformers/" + trId).once("value", snap => {
    callback(snap.val());
  });
}


// ============================
//   TRANSFORMER INSPECTION
// ============================
function saveTransformerInspection(trId, data, callback) {
  const key = db.ref().push().key;
  db.ref("transformerInspections/" + trId + "/" + key)
    .set(data, function (error) {
      if (error) alert("Error saving transformer report");
      else if (callback) callback(key);
    });
}


// ============================
//       LUX REPORTS (FAST + SAFE)
// ============================
function saveLuxReport(data, callback) {

  // push() gives key immediately (no UI delay)
  const ref = db.ref("luxReports").push();

  ref.set(data, function (error) {
    if (error) {
      alert("Error saving LUX report");
    } else {
      // immediate callback = fast UI feedback
      if (callback) callback(ref.key);
    }
  });
}
