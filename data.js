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

    if (err) {
      alert("Error saving inspection");
      return;
    }

    // -------- UPDATE PANEL WITH INSPECTION DATES --------

    const now = new Date();
    const next = new Date();
    next.setDate(now.getDate() + 15); // 15-day inspection cycle

    db.ref("panels/" + dbId).update({
      lastInspection: now.toISOString(),
      nextInspectionDue: next.toISOString()
    }).then(() => {
        console.log("Panel dates updated successfully");
    });

    if (callback) callback(key);

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
  db.ref("transformers/" + trId).update(data, err => {
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

  // Save inspection first
  db.ref("transformerInspections/" + trId + "/" + key).set(data)
  .then(() => {

      const now = new Date();
      const next = new Date();
      next.setDate(now.getDate() + 60);

      // 🔥 Force update transformer root
      return db.ref("transformers/" + trId).update({
          lastInspection: now.toISOString(),
          nextInspectionDue: next.toISOString()
      });

  })
  .then(() => {

      console.log("Transformer inspection + dates updated successfully");

      if (callback) callback(key);

  })
  .catch(err => {
      console.error("Error:", err);
      alert("Error saving transformer inspection");
  });
}

function loadTransformerInspection(trId, callback) {
  db.ref("transformerInspections/" + trId).once("value").then(snap => {
    callback(snap.val());
  });
}

// ============================
//       LUX REPORTS (FLAT)
// ============================

function saveLuxReport(data, callback) {

  const key = db.ref().push().key;

  const now = new Date();
  const next = new Date();
  next.setDate(now.getDate() + 30);   // 30 DAY LUX CYCLE

  db.ref("luxReports/" + key).set({
      ...data,
      timestamp: now.toISOString(),
      nextInspectionDue: next.toISOString()
  })
  .then(() => {
      console.log("LUX report saved successfully");
      if (callback) callback(key);
  })
  .catch(err => {
      console.error("Error saving LUX report:", err);
      alert("Error saving LUX report");
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


