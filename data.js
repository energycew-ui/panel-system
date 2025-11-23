// data.js
// Firebase Configuration (YOUR REAL CONFIG)

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

// Realtime Database reference
const db = firebase.database();

// Save panel data globally in Firebase
function savePanelToFirebase(dbId, data, callback) {
    db.ref("panels/" + dbId).set(data, function(error) {
        if (error) {
            alert("Error saving to Firebase: " + error);
        } else {
            if (callback) callback();
        }
    });
}

// Load panel data by ID
function loadPanelFromFirebase(dbId, callback) {
    db.ref("panels/" + dbId).once("value").then(function(snapshot) {
        callback(snapshot.val());
    });
}

// Load all panels
function loadAllPanels(callback) {
    db.ref("panels").once("value").then(function(snapshot) {
        callback(snapshot.val());
    });
}
