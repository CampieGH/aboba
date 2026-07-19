const regServiceWorker = async () => {
    if ("serviceWorker" in navigator) {
        try {
            const registration = await navigator.serviceWorker.register("/serviceWorker.js")
            if (registration.installing) {
                console.log("ServiceWorker is being installed")
            } else if (registration.waiting) {
                console.log("New ServiceWorker installed, waiting for activation")
            } else if (registration.active) {
                console.log("ServiceWorker was activated.")
            }
        }
        catch (e) {
            console.error(`ServiceWorker registration failed with {e}`)
        }
    }
}
regServiceWorker();

import "./splash.js"
import { db, auth } from "./auth.js";
import { hideSplash } from "./splash.js";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    doc,
    getDoc,
    setDoc,
    getDocs,
} from "https://www.gstatic.com/firebasejs/10.3.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.3.0/firebase-auth.js";
import { formatDate, formatTime } from "./util.js";
import { updateCharCount } from "./input.js";
import { setCurrentUser, setGroups, setSelectedGroup, setCurrentDM, setUnsubscribe, setDMChats, addGroup, addProfileCache, groups, currentUser, selectedGroup, currentDM, unsubscribe, addDMchat, dmChats, drafts, profilesCache } from "./globals.js";
import "./storage.js";
import "./input.js";

// @ts-check

const loginForm = document.getElementById("loginForm");
const chatLayout = document.getElementById("chatLayout");
const groupList = document.getElementById("groupList");
const groupNameDisplay = document.getElementById("groupNameDisplay");
const messagesDiv = document.getElementById("messages");
const chatInputForm = document.getElementById("chatInput");
const messageInput = document.getElementById("messageInput");
const profileBtn = document.getElementById("profileBtn");
const profilePanel = document.getElementById("profilePanel");
const profileForm = document.getElementById("profileForm");
const profileNick = document.getElementById("profileNick");
const profileNickError = document.getElementById("profileNickError")
const profileAvatar = document.getElementById("profileAvatar");
const profileColor = document.getElementById("profileColor");
const profileStatus = document.getElementById("profileStatus");
const statusCounter = document.getElementById("statusCounter");

const userProfileModal = document.getElementById("userProfileModal");
const closeUserModalBtn = document.getElementById("closeUserModal");
const userModalAvatar = document.getElementById("userModalAvatar");
const userModalNick = document.getElementById("userModalNick");
const userModalStatus = document.getElementById("userModalStatus");
const userModalMsgBtn = document.getElementById("userModalMsgBtn");

const joinModal = document.getElementById("joinGroupModal");
const closeJoinModal = document.getElementById("closeJoinModal");
const openJoinModalBtn = document.getElementById("openJoinModalBtn");
const joinGroupForm = document.getElementById("joinGroupForm");
const joinGroupName = document.getElementById("joinGroupName");
const joinGroupCode = document.getElementById("joinGroupCode");
const joinGroupPassword = document.getElementById("joinGroupPassword");
const joinGroupError = document.getElementById("joinGroupError");


function updateChatInputVisibility() { // Видимость строки ввода сообщения
    const chatInput = document.getElementById("chatInput");
    if (selectedGroup || currentDM) {
        chatInput.classList.remove("hidden");
    } else {
        chatInput.classList.add("hidden");
    }
}



// Ты должен вызвать hideSplash(), когда всё загрузится (авторизация, данные и т.п.)


// Открытие и закрытие модалки добавления группы
openJoinModalBtn.onclick = () => {
    joinModal.style.display = "flex";
    joinModal.setAttribute("aria-hidden", "false");
    joinGroupError.style.display = "none";
    joinGroupName.value = joinGroupCode.value = joinGroupPassword.value = "";
    joinGroupName.focus();
};
closeJoinModal.onclick = () => {
    joinModal.style.display = "none";
    joinModal.setAttribute("aria-hidden", "true");
};
joinModal.onclick = (e) => {
    if (e.target === joinModal) closeJoinModal.onclick();
};
joinModal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeJoinModal.onclick();
});

// Отправка формы добавления группы
joinGroupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    joinGroupError.style.display = "none";

    const name = joinGroupName.value.trim();
    const code = joinGroupCode.value.trim();
    const pass = joinGroupPassword.value.trim();

    if (!currentUser || !name) return;

    try {
        const snap = await getDoc(doc(db, "groups", name));
        if (snap.exists()) {
            const g = snap.data();

            if (g.type === "invite" && g.inviteCode !== code)
                return showErr("Неверный код.");
            if (g.type === "private" && g.password !== pass)
                return showErr("Неверный пароль.");

            const allowed = g.allowed || [];
            if (!allowed.includes(currentUser.uid)) {
                allowed.push(currentUser.uid);
                await setDoc(doc(db, "groups", name), { allowed }, { merge: true });
            }

            if (!groups.some((gr) => gr.id === name))
                addGroup({ id: name, name: g.name });

            setSelectedGroup(name);
            setCurrentDM(null);
            localStorage.setItem("selectedGroup", selectedGroup);
            localStorage.removeItem("currentDM");
            //            localStorage.setItem("selectedGroup", "");  // Это настолько гениальный мув, что я его оставлю тут)
            await renderSidebar();
            await startChat();
            updateChatInputVisibility();
            closeJoinModal.onclick();
            return;

        }

        const q = query(collection(db, "profiles"), where("nick", "==", name));
        const res = await getDocs(q);
        if (res.empty) return showErr("Ни группа, ни пользователь с таким ником не найдены");

        const userDoc = res.docs[0];
        const otherUid = userDoc.id;
        if (otherUid === currentUser.uid) return showErr("Это ваш ник");

        const chatId = getDMChatId(currentUser.uid, otherUid);
        setCurrentDM({ chatId: chatId, otherUid: otherUid });
        setSelectedGroup(null);
        localStorage.setItem("selectedGroup", "");
        localStorage.setItem("currentDM", JSON.stringify(currentDM));
        await loadDMChats();
        await renderSidebar();
        await startChat();
        closeJoinModal.onclick();

        addSystemMessage("ЛС создан!");
        updateChatInputVisibility();   // ← добавили
    } catch (err) {
        showErr("Ошибка: " + err.message);
    }

    function showErr(msg) {
        joinGroupError.textContent = msg;
        joinGroupError.style.display = "block";
    }
});

// Отслеживаем изменение авторизации
onAuthStateChanged(auth, async (user) => {
    setCurrentUser(user);
    if (user) {

        openJoinModalBtn.style.display = "block";

        loginForm.style.display = "none";
        chatLayout.style.display = "flex";
        profileBtn.style.display = "flex";
        openJoinModalBtn.style.display = "block";
        await loadUserProfile(user.uid);

        const currentNick = profileNick.value.trim().toLowerCase();
        if (!currentNick || currentNick === "безымянный") {
            profilePanel.style.display = "block";
            profileBtn.setAttribute("aria-expanded", "true");
            profilePanel.focus();
            addSystemMessage("Пожалуйста, выбери уникальный ник для профиля");
            // return; //??? Зачем?
        }

        await loadUserGroups();
        await loadDMChats();

        const savedGroup = localStorage.getItem("selectedGroup");
        let savedDM = null;
        try {
            savedDM = JSON.parse(localStorage.getItem("currentDM"));
        } catch {
            localStorage.removeItem("currentDM");
        }
        const availableDM = dmChats.find(
            (dm) => dm.chatId === savedDM?.chatId && dm.otherUid === savedDM?.otherUid
        );
        if (!availableDM) localStorage.removeItem("currentDM");

        if (availableDM) {
            setCurrentDM(availableDM);
            setSelectedGroup(null);
        } else if (savedGroup && groups.some(g => g.id === savedGroup)) {
            setCurrentDM(null);
            setSelectedGroup(savedGroup);
        } else {
            setCurrentDM(null);
            setSelectedGroup(groups.length ? groups[0].id : null);
        }

        await renderSidebar();
        await startChat();

        hideSplash();
    } else {

        openJoinModalBtn.style.display = "none";

        hideSplash();
        if (unsubscribe) {
            unsubscribe();
            setUnsubscribe(null);
        }
        loginForm.style.display = "flex";
        chatLayout.style.display = "none";
        profileBtn.style.display = "none";
        profilePanel.style.display = "none";
        profileBtn.setAttribute("aria-expanded", "false");
        setGroups([]);
        setSelectedGroup(null);
        setCurrentDM(null);
        setDMChats([]);
        groupList.innerHTML = "";
        clearMessages();
        localStorage.removeItem("selectedGroup");
        localStorage.removeItem("currentDM");
    }
    updateChatInputVisibility();
});

// Обновляем счётчик символов статуса
profileStatus.addEventListener("input", () => {
    statusCounter.textContent = 80 - profileStatus.value.length;
});

profileNick.addEventListener("input", () => {
    profileNickError.style.display = "none";
});

// Открыть/закрыть панель профиля
profileBtn.onclick = () => {
    const open = profilePanel.style.display === "block";
    profilePanel.style.display = open ? "none" : "block";
    profileBtn.setAttribute("aria-expanded", String(!open));
    if (!open) profilePanel.focus();
};

// Сохраняем профиль
profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    profileNickError.style.display = "none";

    const newNick = profileNick.value.trim();

    if (!newNick) {
        profileNickError.textContent = "Ник не может быть пустым.";
        profileNickError.style.display = "block";
        return;
    }

    if (newNick.length > 30) {
        profileNickError.textContent = "Ник слишком длинный (макс. 30 символов).";
        profileNickError.style.display = "block";
        return;
    }

    const currentNick = profilesCache[currentUser.uid]?.nick || "";
    if (newNick !== currentNick) {
        const q = query(collection(db, "profiles"), where("nick", "==", newNick));
        const res = await getDocs(q);
        if (!res.empty) { // тут было это: && res.docs.some(doc => doc.id !== currentUser.uid), но зачем?
            profileNickError.textContent = "Ник уже занят. Попробуйте другой.";
            profileNickError.style.display = "block";
            return;
        }
    }

    await setDoc(doc(db, "profiles", currentUser.uid), {
        nick: newNick,
        avatar: profileAvatar.value.trim() || "https://i.imgur.com/4AiXzf8.png",
        color: profileColor.value,
        status: profileStatus.value.trim()
    }, { merge: true });

    profilePanel.style.display = "none";
    profileBtn.setAttribute("aria-expanded", "false");
    addProfileCache(currentUser.uid, {
        nick: profileNick.value.trim(),
        avatar: profileAvatar.value.trim(),
        color: profileColor.value,
        status: profileStatus.value.trim(),
    });
    addSystemMessage("Профиль сохранён");

    // Обновляем профиль в UI без перезагрузки
    await loadUserProfile();
    await renderSidebar();
    await startChat();
});

// Загружаем профиль пользователя
async function loadUserProfile() {
    let d = await loadProfile(currentUser.uid)
    profileNick.value = d.nick || "";
    profileAvatar.value = d.avatar || "";
    profileColor.value = d.color || "#cccccc";
    profileStatus.value = d.status || "";
    statusCounter.textContent = 80 - profileStatus.value.length;

}

async function loadDMChats() {

    const q = query(
        collection(db, "dmChats"),
        where("uids", "array-contains", currentUser.uid)
    );
    const snap = await getDocs(q);
    setDMChats([])

    snap.forEach((docSnap) => {
        const { uids } = docSnap.data();
        const otherUid = uids.find((u) => u !== currentUser.uid);
        if (otherUid) addDMchat({ chatId: docSnap.id, otherUid });
    });
}


// Рендерим сайдбар
async function renderSidebar() {
    groupList.innerHTML = "";

    if (dmChats.length) {
        const dmHeader = document.createElement("div");
        dmHeader.className = "sidebar-divider";
        dmHeader.textContent = "💬";
        groupList.appendChild(dmHeader);

        for (const dm of dmChats) {
            const prof = await loadProfile(dm.otherUid);
            const item = document.createElement("div");
            item.className =
                "group-item" +
                (currentDM?.chatId === dm.chatId ? " active" : "");
            item.tabIndex = 0;

            const avatar = document.createElement("div");
            avatar.className = "avatar";
            avatar.style.backgroundImage = `url(${prof.avatar || "https://i.imgur.com/4AiXzf8.png"})`;
            const nick = document.createElement("span");
            nick.textContent = prof.nick || "Безымянный";
            nick.style.color = prof.color || "#ccc";
            nick.className = "nick";

            item.append(avatar, nick);

            item.onclick = async () => {
                setSelectedGroup(null);
                setCurrentDM({ chatId: dm.chatId, otherUid: dm.otherUid });
                localStorage.setItem("selectedGroup", "");
                localStorage.setItem("currentDM", JSON.stringify(currentDM));

                // Создаём чат-документ, если его ещё нет
                await setDoc(
                    doc(db, "dmChats", dm.chatId),
                    { uids: [currentUser.uid, dm.otherUid] },
                    { merge: true }
                );

                await renderSidebar();
                await startChat();

                updateChatInputVisibility();
            };


            item.onkeydown = (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    item.onclick();
                }
            };

            groupList.appendChild(item);
        }
    }

    if (groups.length) {
        const groupHeader = document.createElement("div");
        groupHeader.className = "sidebar-divider";
        groupHeader.textContent = "👥";
        groupList.appendChild(groupHeader);

        groups.forEach((g) => {
            const div = document.createElement("div");
            div.className =
                "group-item" + (g.id === selectedGroup ? " active" : "");
            div.textContent = g.name;
            div.tabIndex = 0;

            div.onclick = async () => {
                if (g.id !== selectedGroup) {
                    setSelectedGroup(g.id);
                    setCurrentDM(null);
                    localStorage.setItem("selectedGroup", selectedGroup);
                    localStorage.removeItem("currentDM");
                    //                    localStorage.setItem("selectedGroup", ""); // да что же это за гениальный ИИ такой...
                    await renderSidebar();
                    await startChat();

                    updateChatInputVisibility();
                }
            };

            div.onkeydown = (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    div.onclick();
                }
            };

            groupList.appendChild(div);
        });
    }

    if (currentUser) {
        if (!groupList.contains(openJoinModalBtn)) {
            groupList.appendChild(openJoinModalBtn);
        }
        openJoinModalBtn.style.display = "flex";  // или "inline-block", зависит от стиля
        openJoinModalBtn.disabled = false;
    } else {
        openJoinModalBtn.style.display = "none";
        openJoinModalBtn.disabled = true;
    }

    if (selectedGroup) {
        groupNameDisplay.textContent =
            groups.find((g) => g.id === selectedGroup)?.name || "—";
    } else if (currentDM) {
        const prof = await loadProfile(currentDM.otherUid);
        groupNameDisplay.textContent = "" + (prof.nick || "Безымянный"); //ЛС с
    } else {
        groupNameDisplay.textContent = "—";
    }
}

// Добавляем системное сообщение (типа "Профиль сохранён")
function addSystemMessage(txt) {
    const div = document.createElement("div");
    div.className = "msg server";
    div.textContent = txt;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Очищаем чат
function clearMessages() {
    messagesDiv.innerHTML = "";
}

// Загружаем профиль по uid с кешированием
async function loadProfile(uid) {
    if (!uid) return {};
    if (profilesCache[uid]) return profilesCache[uid];
    try {
        const snap = await getDoc(doc(db, "profiles", uid));
        const data = snap.exists() ? snap.data() : {};
        addProfileCache(uid, data);
        return data;
    } catch (e) {
        console.warn("Ошибка загрузки профиля", e);
        return {};
    }
}

// Запускаем подписку на сообщения выбранной группы
async function startChat() {
    if (unsubscribe) {
        unsubscribe();
        setUnsubscribe(null);
    }
    clearMessages();
    renderDraft();

    if (!currentUser) return;

    if (currentDM) {
        await setDoc(
            doc(db, "dmChats", currentDM.chatId),
            { uids: [currentUser.uid, currentDM.otherUid] },
            { merge: true }
        );

        const q = query(
            collection(db, "dmChats", currentDM.chatId, "messages"),
            orderBy("createdAt", "asc")
        );
        setUnsubscribe(onSnapshot(q, async (snap) => {

            clearMessages();
            for (const docSnap of snap.docs) {
                const d = docSnap.data();
                const prof = await loadProfile(d.uid || "");

                const msgDiv = document.createElement("div");
                msgDiv.className = "msg";

                const avatar = document.createElement("div");
                avatar.className = "avatar clickable";
                avatar.style.backgroundImage = `url(${prof.avatar || "https://i.imgur.com/4AiXzf8.png"})`;
                avatar.onclick = () => openUserModal(d.uid);
                avatar.tabIndex = 0;

                const cont = document.createElement("div");
                cont.className = "content";

                const head = document.createElement("div");
                head.className = "msg-header";

                const nick = document.createElement("span");
                nick.textContent = prof.nick || "Безымянный";
                nick.style.color = prof.color || "#ccc";

                const time = document.createElement("span");
                time.textContent = formatTime(d.createdAt?.toDate?.() || new Date());
                time.title = d.createdAt?.toDate?.()?.toLocaleString() || "";

                head.append(nick, time);
                cont.append(head, document.createTextNode(d.text || ""));
                msgDiv.append(avatar, cont);
                messagesDiv.appendChild(msgDiv);
            }
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }));
    } else if (selectedGroup) {
        const q = query(
            collection(db, "groups", selectedGroup, "messages"),
            orderBy("createdAt", "asc")
        );
        let lastDate = "";

        setUnsubscribe(onSnapshot(q, async (snap) => {
            clearMessages();
            lastDate = "";
            for (const docSnap of snap.docs) {
                const d = docSnap.data();
                if (!d.createdAt) continue;

                const createdAt = d.createdAt.toDate();
                const dateStr = formatDate(createdAt);

                if (dateStr !== lastDate) {
                    lastDate = dateStr;
                    const div = document.createElement("div");
                    div.className = "date-divider";
                    div.textContent = dateStr;
                    messagesDiv.appendChild(div);
                }

                const msgDiv = document.createElement("div");
                msgDiv.className = "msg";

                const avatar = document.createElement("div");
                avatar.className = "avatar clickable";
                const prof = await loadProfile(d.uid || "");
                avatar.style.backgroundImage = `url(${prof.avatar || "https://i.imgur.com/4AiXzf8.png"})`;
                avatar.title = prof.nick || "Безымянный";
                avatar.onclick = () => openUserModal(d.uid);
                avatar.tabIndex = 0;

                const cont = document.createElement("div");
                cont.className = "content";

                const head = document.createElement("div");
                head.className = "msg-header";

                const nick = document.createElement("span");
                nick.textContent = prof.nick || "Безымянный";
                nick.style.color = prof.color || "#ccc";

                const time = document.createElement("span");
                time.textContent = formatTime(createdAt);
                time.title = createdAt.toLocaleString();

                head.append(nick, time);

                if (d.edited) {
                    const ed = document.createElement("span");
                    ed.className = "msg-edited";
                    ed.textContent = "(ред.)";
                    head.appendChild(ed);
                }

                const body = document.createElement("div");
                body.textContent = d.text || "";

                cont.append(head, body);
                msgDiv.append(avatar, cont);
                messagesDiv.appendChild(msgDiv);
            }
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }));
    }
}

// ЕСЛИ хочешь открыть ЛС-чат
async function openDMChat(chatId, otherUid) {
    setSelectedGroup(null);
    setCurrentDM({ chatId: chatId, otherUid: otherUid });
    localStorage.setItem("selectedGroup", "");
    localStorage.setItem("currentDM", JSON.stringify(currentDM));

    // Создаём/обновляем чат-документ заранее, чтобы Firestore разрешил чтение
    await setDoc(
        doc(db, "dmChats", chatId),
        { uids: [currentUser.uid, otherUid] },
        { merge: true }
    );

    await loadDMChats();
    await renderSidebar();
    await startChat();
    updateChatInputVisibility();
}

// Отправка сообщений (Enter — отправка, Shift+Enter — перенос)
chatInputForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser || (!selectedGroup && !currentDM)) return;
    const text = messageInput.value.trim();
    if (!text) return;
    messageInput.value = "";
    updateCharCount();

    const data = {
        text,
        uid: currentUser.uid,
        createdAt: serverTimestamp(),
        edited: false,
        type: selectedGroup ? "user" : "dm",
    };

    try {
        if (selectedGroup) {
            await addDoc(
                collection(db, "groups", selectedGroup, "messages"),
                data
            );
            drafts[selectedGroup] = "";
        } else if (currentDM?.chatId) {
            // Создаём/обновляем метадату чата (массив участников)
            await setDoc(
                doc(db, "dmChats", currentDM.chatId),
                { uids: [currentUser.uid, currentDM.otherUid] },
                { merge: true }
            );

            await addDoc(
                collection(db, "dmChats", currentDM.chatId, "messages"),
                data
            );
            drafts[currentDM.chatId] = "";
        }

    } catch (err) {
        alert("Ошибка отправки: " + err.message);
        messageInput.value = text
    }
});

// Получаем айди для ЛС
function getDMChatId(uid1, uid2) {
    return [uid1, uid2].sort().join("_"); // стабильный порядок
}

// Автоматический ресайз textarea по содержимому
function autoResizeTextarea() {
    messageInput.style.height = "auto";
    messageInput.style.height = messageInput.scrollHeight + "px";
}

// Рендерим черновик и обновляем интерфейс
function renderDraft() {
    if (selectedGroup) {
        messageInput.value = drafts[selectedGroup] || "";
    } else if (currentDM?.chatId) {
        messageInput.value = drafts[currentDM.chatId] || "";
    } else {
        messageInput.value = "";
    }
    autoResizeTextarea();
    updateCharCount();
}

updateCharCount();

// Загружаем группы пользователя из Firestore
async function loadUserGroups() {
    setGroups([]);
    const groupsRef = collection(db, "groups");
    const q = query(groupsRef);
    const snap = await getDocs(q);

    snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.allowed && data.allowed.includes(currentUser.uid)) {
            addGroup({ id: docSnap.id, name: data.name || docSnap.id });
        }
    });
}

// Модалка пользователя: открытие с заполнением данных
async function openUserModal(uid) {
    if (!uid) return;
    const prof = await loadProfile(uid);
    if (!prof) return;

    userModalAvatar.style.backgroundImage = `url(${prof.avatar || "https://i.imgur.com/4AiXzf8.png"})`;
    userModalNick.textContent = prof.nick || "Безымянный";
    userModalNick.style.color = prof.color || "#cccccc";
    userModalStatus.textContent = prof.status || "Нет статуса";

    userModalMsgBtn.textContent = "Написать";
    userModalMsgBtn.disabled = false;

    userProfileModal.style.display = "flex";
    userProfileModal.setAttribute("aria-hidden", "false");

    userModalMsgBtn.dataset.uid = uid;
}

closeUserModalBtn.onclick = () => {
    userProfileModal.style.display = "none";
    userProfileModal.setAttribute("aria-hidden", "true");
};

userProfileModal.onclick = (e) => {
    if (e.target === userProfileModal) closeUserModalBtn.onclick();
};

userProfileModal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeUserModalBtn.onclick();
});

userModalMsgBtn.onclick = async () => {
    const uid = userModalMsgBtn.dataset.uid;
    if (!uid || uid === currentUser.uid) return;

    const chatId = getDMChatId(currentUser.uid, uid);
    userProfileModal.style.display = "none";
    addSystemMessage("ЛС создан! Можете написать сообщение.");

    await openDMChat(chatId, uid);
    // Сброс ввода и обновление кнопки
    messageInput.value = "";
    updateCharCount();
};
