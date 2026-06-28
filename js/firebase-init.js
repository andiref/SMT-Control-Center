        // ─── FIREBASE INIT ────────────────────────────────────────────────
        firebase.initializeApp({
            apiKey: "AIzaSyCULkpiLSXT79nrWWFl5IVJANhUEA8WJWU",
            authDomain: "smt-dashboard-cd090.firebaseapp.com",
            databaseURL: "https://smt-dashboard-cd090-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "smt-dashboard-cd090",
            storageBucket: "smt-dashboard-cd090.firebasestorage.app",
            messagingSenderId: "468538505165",
            appId: "1:468538505165:web:a491ecbcf5fd75b1a1f684"
        });
        var db = firebase.database();
        // Enable offline persistence for stability
        try {
            firebase.database().enablePersistence({ synchronizeTabs: true })
                .catch(function(err) {
                    console.log('Persistence failed:', err.code);
                });
        } catch(e) {
            console.log('Persistence not supported');
        }

