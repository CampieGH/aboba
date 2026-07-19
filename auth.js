import { initializeApp } from "https://www.gstatic.com/firebasejs/10.3.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.3.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { googleLoginBtn, loginMsg, logoutBtn } from "./globals.js";

// @ts-check
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

googleLoginBtn.onclick = async () => {
    loginMsg.textContent = "";
    try {
        await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
        loginMsg.textContent = "Ошибка входа: " + e.message;
    }
};

logoutBtn.onclick = async () => {
    loginMsg.textContent = "";
    try {
        await signOut(auth);
    } catch (e) {
        loginMsg.textContent = "Ошибка выхода: " + e.message;
    }
};
