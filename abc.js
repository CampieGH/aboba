// @ts-check

export class abcMessage {
    type; // Тип сообщения, чтобы случайно не показывать, так назовём, сообщения-приглашения...
    id;
    author;
    content;
    sent; // Отправлено ли это сообщение или принятно. Удобно если захочется сделать отправленные сообщения с другой стороны приходящим.
    chat; // что-то из abcChat, источник этого сообщения.
    encrypted = false;
    timestamp;
    edited = false;

    constructor() {
        if (this.constructor === abcMessage) throw new Error("Cannot instantiate Base Class");
    }
    serialise() {
        throw new Error("serialise not implemented")
        // Хотя здесь есть serialise, не стоит хранить и передавать
        // незашифрованные сообщени. Мы тут ради шифрования всё это затеяли вообще-то
        // (Хотя на самом деле нет лол)
    }
    async edit() {
        // редактим сообщение
        throw new Error("edit not implemented")
    }
}
// Это тот самый класс, который можно хранить и передавать. decrypt обязань возвращать что-то из abcMessage типов
export class abcEncMessage extends abcMessage {
    encKeyDigest;
    encrypted = true;
    iv;

    constructor() {
        super()
        if (this.constructor === abcEncMessage) throw new Error("Cannot instantiate Base Class");
    }
    async decrypt() {
        // самое интересное, не будет требовать ничего для расшифровки.
        // Ключ расшифровки есть в this.chat.psk, а encKeyDigest проверяется, и должен всегда совпадать
        // кроме сообщений-приглашений, у которых для проверки encKeyDigest используется публичный ключ
        // пользователя, а для расшифровки - приватный. Как-то так.
        throw new Error("decrypt not implemented")
    }
}

export class abcUser {
    // id был убран из User, так как это не его часть.
    privateKey;
    profile;
    // После пары минут обдумывания, User вообще должен быть локальным классом для удобства работы с ним
    // А вот Profile имеет всю публичную информацию


    constructor() {
        if (this.constructor === abcUser) throw new Error("Cannot instantiate Base Class");
    }
    serialise() {
        throw new Error("serialise not implemented")
    }
}

export class abcProfile {
    id;
    nick;
    avatar;
    color;
    status_;
    publicKey;

    constructor() {
        if (this.constructor === abcProfile) throw new Error("Cannot instantiate Base Class");
    }
    serialise() {
        throw new Error("serialise not implemented")
    }
}

// Чат будет иметь свой один симмеричный ключ. Им будут шифроваться все сообщения, кроме тех,
// что необходимы для "приглашения" нового участника в чат (отправка этого самого ключа ему)
export class abcChat {
    id;
    psk;
    messages;
    members; // Думаю, список профилей для чатов не помешает...

    constructor() {
        if (this.constructor === abcMessage) throw new Error("Cannot instantiate Base Class");
    }
    serialise() {
        throw new Error("serialise not implemented")
    }
    generateInviteMessage() {
        // Требует профиль в качестве аргумента. Возвращает что-то из abcEncMessage, подготовленного для отправки.
        throw new Error("generateInviteMessage not implemented")
    }
    encryptMessage() {
        // Требует abcMessage, возвращает abcEncMessage, логично...
        throw new Error("encryptMessage not implemented")
    }
    setupFetch() {
        // Докидываем мощно фетчем сообщений (Возможно, в другом потоке даже...).
        // наверное должен генерировать эвенты при получении новых сообщений..
        throw new Error("setupFetch not implemented")
    }
    fetchMessages() {
        // Просто проверяем сообщения. Полезно для синхронизации в фоне.
        throw new Error("fetchMessages not implemented")
    }
}
