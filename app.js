import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail
} from "firebase/auth";
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    push,
    child, 
    update, 
    remove, 
    onValue 
} from "firebase/database";

// CONFIGURAÇÃO DO CONSOLE FIREBASE (MANTIDA ORIGINAL)
const firebaseConfig = {
  apiKey: "AIzaSyATr3AFcjJtamWRKZEBBcsA8vi-_ckCeEs",
  authDomain: "games2-c9b04.firebaseapp.com",
  projectId: "games2-c9b04",
  storageBucket: "games2-c9b04.firebasestorage.app",
  messagingSenderId: "417046305603",
  appId: "1:417046305603:web:52e921b1f10f9ed4b76df6"
};

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Estado Local da Aplicação
let currentUser = null;
let activeBlobUrl = null;
let currentPlayingGameId = null;
let currentPlayingGameTitle = "";

// ELEMENTOS DA INTERFACE (UI)
const btnNavAuth = document.getElementById('btn-nav-auth');
const btnLogout = document.getElementById('btn-logout');
const userInfo = document.getElementById('user-info');
const userName = document.getElementById('user-name');
const userBadge = document.getElementById('user-badge');

const authScreen = document.getElementById('auth-screen');
const catalogScreen = document.getElementById('catalog-screen');
const emulatorScreen = document.getElementById('emulator-screen');
const adminPanel = document.getElementById('admin-panel');
const dynamicCatalog = document.getElementById('dynamic-catalog');

// Elementos de Abas / Formulários de Autenticação
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const btnCancelAuth = document.getElementById('btn-cancel-auth');

// Modal Esqueci Senha
const modalForgot = document.getElementById('modal-forgot');
const linkForgot = document.getElementById('link-forgot');
const btnCloseForgot = document.getElementById('btn-close-forgot');
const formForgot = document.getElementById('form-forgot');

// SELETORES ADICIONADOS: Elementos do Novo Modal de Slots
const modalSavesManager = document.getElementById('modal-saves-manager');
const btnOpenSavesMenu = document.getElementById('btn-open-saves-menu');
const btnCloseSavesMenu = document.getElementById('btn-close-saves-menu');
const btnCaptureNewSave = document.getElementById('btn-capture-new-save');
const cloudSavesList = document.getElementById('cloud-saves-list');

// Formulário Administrativo de Jogos
const formAdminGame = document.getElementById('form-admin-game');
const adminGameId = document.getElementById('admin-game-id');
const adminCategory = document.getElementById('admin-category');
const adminSubcategory = document.getElementById('admin-subcategory');
const adminSystemCore = document.getElementById('admin-system-core');
const adminGameTitle = document.getElementById('admin-game-title');
const adminGameCover = document.getElementById('admin-game-cover');
const adminGameUrl = document.getElementById('admin-game-url');
const btnSaveGame = document.getElementById('btn-save-game');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const btnExportJson = document.getElementById('btn-export-json');
const btnImportJson = document.getElementById('btn-import-json');
const adminUsersList = document.getElementById('admin-users-list');

// Whitelist de Provedores de E-mail Permitidos
const EMAIL_WHITELIST = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'outlook.com.br'];

// ==========================================
// 1. MONITORAMENTO DO ESTADO DE AUTENTICAÇÃO
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        btnNavAuth.classList.add('hidden');
        userInfo.classList.remove('hidden');
        
        const snapshot = await get(ref(db, `users/${user.uid}/profile`));
        let displayNick = user.email.split('@')[0];
        if (snapshot.exists()) {
            displayNick = snapshot.val().name;
        }
        userName.textContent = displayNick;

        if (user.email === 'admin@admin.com') {
            userBadge.textContent = 'Admin';
            userBadge.classList.add('admin');
            adminPanel.classList.remove('hidden');
            startAdminMonitoring();
        } else {
            userBadge.textContent = 'User';
            userBadge.classList.remove('admin');
            adminPanel.classList.add('hidden');
        }
    } else {
        currentUser = null;
        btnNavAuth.classList.remove('hidden');
        userInfo.classList.add('hidden');
        adminPanel.classList.add('hidden');
        if (currentPlayingGameId) updatePlayingStatus("Nenhum");
    }
});

// ==========================================
// 2. FLUXOS DE AUTENTICAÇÃO
// ==========================================
tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
});

tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
});

btnNavAuth.addEventListener('click', () => {
    authScreen.classList.remove('hidden');
    catalogScreen.classList.add('hidden');
});
btnCancelAuth.addEventListener('click', () => {
    authScreen.classList.add('hidden');
    catalogScreen.classList.remove('hidden');
});
document.querySelectorAll('.CloseAuthBtn').forEach(btn => {
    btn.addEventListener('click', () => {
        authScreen.classList.add('hidden');
        catalogScreen.classList.remove('hidden');
    });
});

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        authScreen.classList.add('hidden');
        catalogScreen.classList.remove('hidden');
        formLogin.reset();
    } catch (error) {
        alert("Erro ao efetuar login: " + error.message);
    }
});

formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const lastname = document.getElementById('reg-lastname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!EMAIL_WHITELIST.includes(emailDomain) && email !== 'admin@admin.com') {
        alert("Domínio de e-mail não autorizado! Use Gmail, Hotmail, Outlook ou Yahoo.");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await set(ref(db, `users/${user.uid}/profile`), {
            name: name,
            lastname: lastname,
            email: email,
            registeredAt: new Date().toISOString()
        });
        alert("Conta criada com sucesso!");
        authScreen.classList.add('hidden');
        catalogScreen.classList.remove('hidden');
        formRegister.reset();
    } catch (error) {
        alert("Erro no cadastro: " + error.message);
    }
});

btnLogout.addEventListener('click', () => {
    signOut(auth).then(() => { window.location.reload(); });
});

linkForgot.addEventListener('click', (e) => {
    e.preventDefault();
    modalForgot.classList.remove('hidden');
});
btnCloseForgot.addEventListener('click', () => modalForgot.classList.add('hidden'));

formForgot.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    try {
        await sendPasswordResetEmail(auth, email);
        alert("E-mail de redefinição enviado!");
        modalForgot.classList.add('hidden');
        formForgot.reset();
    } catch (error) {
        alert("Erro ao enviar redefinição: " + error.message);
    }
});

// ==========================================
// 3. RENDERIZAÇÃO DINÂMICA DO CATÁLOGO
// ==========================================
const gamesRef = ref(db, 'games');
onValue(gamesRef, (snapshot) => {
    dynamicCatalog.innerHTML = "";
    if (!snapshot.exists()) {
        dynamicCatalog.innerHTML = '<p>Nenhum jogo cadastrado no banco de dados.</p>';
        return;
    }

    const data = snapshot.val();
    const structuredCatalog = {};

    for (let id in data) {
        const item = data[id];
        if (!structuredCatalog[item.category]) structuredCatalog[item.category] = {};
        if (!structuredCatalog[item.category][item.subcategory]) structuredCatalog[item.category][item.subcategory] = [];
        structuredCatalog[item.category][item.subcategory].push({ id, ...item });
    }

    for (let category in structuredCatalog) {
        const categoryBlock = document.createElement('section');
        categoryBlock.className = 'category-block';
        categoryBlock.innerHTML = `<h2>${category}</h2>`;

        for (let subcategory in structuredCatalog[category]) {
            const subBlock = document.createElement('div');
            subBlock.className = 'subcategory-block';
            subBlock.innerHTML = `<h3>${subcategory}</h3>`;

            const grid = document.createElement('div');
            grid.className = 'grid-games';

            structuredCatalog[category][subcategory].forEach(game => {
                const card = document.createElement('div');
                card.className = 'game-card';
                card.innerHTML = `
                    <div class="badge-system">${game.system.toUpperCase()}</div>
                    <div class="cover-wrapper">
                        <img src="${game.coverUrl}" alt="${game.title}" data-id="${game.id}">
                    </div>
                    <div class="game-info">
                        <h3>${game.title}</h3>
                        <p>${subcategory}</p>
                    </div>
                `;

                card.addEventListener('click', () => {
                    launchGame(game.system, game.romUrl, game.title, game.id);
                });

                card.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    return false;
                });

                grid.appendChild(card);
            });
            subBlock.appendChild(grid);
            categoryBlock.appendChild(subBlock);
        }
        dynamicCatalog.appendChild(categoryBlock);
    }
});

// ==========================================
// 4. MOTOR DO EMULADOR (EmulatorJS)
// ==========================================
window.launchGame = function(system, romUrl, gameTitle, gameId = "local_rom") {
    catalogScreen.classList.add('hidden');
    adminPanel.classList.add('hidden');
    emulatorScreen.classList.remove('hidden');
    document.getElementById('playing-title').textContent = `Jogando: ${gameTitle}`;
    
    currentPlayingGameId = gameId;
    currentPlayingGameTitle = gameTitle;
    updatePlayingStatus(gameTitle);

    const wrapper = document.getElementById('player-wrapper-target');
    wrapper.innerHTML = `<div id="emulator-player" style="width:100%; height:100%;"><div id="game-canvas"></div></div>`;

    window.EJS_player = '#game-canvas';
    window.EJS_core = system; 
    window.EJS_gameUrl = romUrl; 
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/latest/data/'; 
    
    window.EJS_startOnLoaded = true; 
    window.EJS_AdUrl = ''; 
    window.EJS_myserver = 'true';

    // Desativa escutas e rotinas nativas automatizadas para dar lugar ao controle de slots manuais
    window.EJS_disableLoadState = true; 
    window.EJS_forceLoadOnStart = false; 
    window.EJS_cacheInIndexDB = false;   
    window.EJS_b64SaveStates = false; 

    window.EJS_onLogin = function() { console.log("Core carregado."); };
    window.EJS_onSaveState = function(data) { console.log("Gatilho automático ignorado."); };

    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/latest/data/loader.js';
    document.getElementById('emulator-player').appendChild(script);
};

// ==========================================
// LÓGICA COMPLETA DO GERENCIADOR DE SLOTS MANUAIS
// ==========================================

// Gatilho: Abrir menu e renderizar os slots salvos na nuvem para o respectivo ID do jogo
btnOpenSavesMenu.addEventListener('click', () => {
    if (!currentUser) {
        alert("Você precisa fazer login para acessar e sincronizar seus slots de salvamento!");
        return;
    }
    if (currentPlayingGameId === "local_rom") {
        alert("O gerenciador em nuvem não suporta ROMs executadas localmente.");
        return;
    }

    modalSavesManager.classList.remove('hidden');
    loadCloudSavesList();
});

// Fechar menu de slots
btnCloseSavesMenu.addEventListener('click', () => {
    modalSavesManager.classList.add('hidden');
});

// Monitoramento e montagem dinâmica dos slots associados ao jogo atual
function loadCloudSavesList() {
    const savesRef = ref(db, `users/${currentUser.uid}/saves/${currentPlayingGameId}`);
    onValue(savesRef, (snapshot) => {
        cloudSavesList.innerHTML = "";
        
        if (!snapshot.exists()) {
            cloudSavesList.innerHTML = '<p style="text-align:center; font-size:12px; color:#8d8d99; padding:15px 0;">Nenhum save encontrado para este jogo.</p>';
            return;
        }

        const data = snapshot.val();
        let slotIndex = 1;

        for (let saveKey in data) {
            const saveItem = data[saveKey];
            const dateFormatted = new Date(saveItem.updatedAt).toLocaleString('pt-BR');

            const itemRow = document.createElement('div');
            itemRow.className = 'save-slot-item';
            itemRow.innerHTML = `
                <div class="slot-meta">
                    <span class="slot-title">Progresso Salvo #${slotIndex}</span>
                    <span class="slot-date">${dateFormatted}</span>
                </div>
                <div class="slot-actions">
                    <button class="btn-slot-load" data-key="${saveKey}">Carregar</button>
                    <button class="btn-slot-delete" data-key="${saveKey}">Excluir</button>
                </div>
            `;

            // Ação: Puxa o Base64, reconverte para Uint8Array e injeta de volta à memória ram ativa
            itemRow.querySelector('.btn-slot-load').addEventListener('click', (e) => {
                const key = e.target.getAttribute('data-key');
                const base64Data = data[key].state;

                try {
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    
                    window.EJS_LoadState(bytes);
                    modalSavesManager.classList.add('hidden');
                    alert("Estado restaurado com sucesso!");
                } catch (err) {
                    alert("Erro ao restaurar dados na RAM: " + err.message);
                }
            });

            // Ação: Exclusão lógica e física do slot individual direto do Firebase
            itemRow.querySelector('.btn-slot-delete').addEventListener('click', (e) => {
                const key = e.target.getAttribute('data-key');
                if (confirm("Deseja deletar permanentemente este slot de salvamento?")) {
                    remove(ref(db, `users/${currentUser.uid}/saves/${currentPlayingGameId}/${key}`));
                }
            });

            cloudSavesList.appendChild(itemRow);
            slotIndex++;
        }
    });
}

// Gatilho: Intercepta o canvas e empurra o frame binário comprimido em Base64 para o Realtime Database
btnCaptureNewSave.addEventListener('click', () => {
    if (!window.EJS_emulatorHandler || !window.EJS_emulatorHandler.components || !window.EJS_emulatorHandler.components.EJS_GetState) {
        if (typeof window.EJS_GetState !== "function") {
            alert("O motor do emulador ainda está instanciando os buffers de tela. Aguarde o jogo iniciar a gameplay.");
            return;
        }
    }

    const getStateFunc = window.EJS_GetState || window.EJS_emulatorHandler.components.EJS_GetState;

    getStateFunc((data) => {
        if (!data) {
            alert("Não foi possível processar o despejo de memória do emulador neste frame.");
            return;
        }

        try {
            let base64State = "";

            if (typeof data === "string") {
                base64State = data;
            } else {
                let binary = '';
                const bytes = new Uint8Array(data);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                base64State = btoa(binary);
            }

            const newSaveRef = push(ref(db, `users/${currentUser.uid}/saves/${currentPlayingGameId}`));
            
            set(newSaveRef, {
                state: base64State,
                updatedAt: new Date().toISOString(),
                gameTitle: currentPlayingGameTitle
            }).then(() => {
                alert("Progresso registrado com sucesso na nuvem!");
            });

        } catch (err) {
            alert("Erro de conversão de dados binários: " + err.message);
        }
    });
});

// ==========================================
// 5. ROTINAS DO SISTEMA COMPLEMENTARES
// ==========================================
async function updatePlayingStatus(gameName) {
    if (!currentUser) return;
    try {
        await update(ref(db, `users/${currentUser.uid}/profile`), {
            currentlyPlaying: gameName
        });
    } catch (e) { console.error(e); }
}

window.closeEmulator = function() {
    updatePlayingStatus("Nenhum").then(() => {
        sessionStorage.setItem('emu_purge_active', 'true');
        window.location.reload();
    });
};

window.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('emu_purge_active') === 'true') {
        sessionStorage.removeItem('emu_purge_active');
        emulatorScreen.classList.add('hidden');
        catalogScreen.classList.remove('hidden');
    }
});

window.uploadAndPlay = function() {
    const fileInput = document.getElementById('rom-upload');
    let system = document.getElementById('system-select').value;
    
    if (fileInput.files.length === 0) {
        alert("Por favor, selecione um arquivo de ROM primeiro!");
        return;
    }

    const file = fileInput.files[0];
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'smd' || extension === 'gen' || extension === 'md') system = 'segaMD'; 
    else if (extension === 'sms') system = 'mastersystem'; 

    if (activeBlobUrl) { URL.revokeObjectURL(activeBlobUrl); }
    activeBlobUrl = URL.createObjectURL(file);
    launchGame(system, activeBlobUrl, file.name, "local_rom");
};

document.getElementById('rom-upload')?.addEventListener('change', (e) => {
    const fileName = e.target.files[0]?.name || "Nenhum arquivo selecionado";
    document.getElementById('file-name-display').textContent = fileName;
});

// ==========================================
// 6. SEÇÃO ADMINISTRATIVA (CRUD / MONITORAMENTO)
// ==========================================
formAdminGame.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || currentUser.email !== 'admin@admin.com') return;

    const id = adminGameId.value ? adminGameId.value : 'game_' + Date.now();
    const gameData = {
        category: adminCategory.value.trim(),
        subcategory: adminSubcategory.value.trim(),
        system: adminSystemCore.value,
        title: adminGameTitle.value.trim(),
        coverUrl: adminGameCover.value.trim(),
        romUrl: adminGameUrl.value.trim()
    };

    try {
        await set(ref(db, `games/${id}`), gameData);
        alert(adminGameId.value ? "Jogo editado com sucesso!" : "Jogo cadastrado com sucesso!");
        resetAdminForm();
    } catch (err) {
        alert("Erro na operação: " + err.message);
    }
});

btnCancelEdit.addEventListener('click', resetAdminForm);

function resetAdminForm() {
    formAdminGame.reset();
    adminGameId.value = "";
    btnSaveGame.textContent = "Salvar Jogo";
    btnCancelEdit.classList.add('hidden');
}

function startAdminMonitoring() {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        adminUsersList.innerHTML = "";
        if (!snapshot.exists()) return;

        const usersData = snapshot.val();
        for (let uid in usersData) {
            const profile = usersData[uid].profile;
            if (!profile || profile.email === 'admin@admin.com') continue;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${profile.name} ${profile.lastname}</strong></td>
                <td>${profile.email}</td>
                <td><span style="color:#00b4d8;">${profile.currentlyPlaying || 'Nenhum'}</span></td>
                <td>
                    <button class="btn-sm btn-delete-user" style="background-color:#ff4757;" data-uid="${uid}">
                        Deletar Conta
                    </button>
                </td>
            `;
            adminUsersList.appendChild(tr);
        }

        document.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const uid = e.target.getAttribute('data-uid');
                if (confirm("Deseja apagar as informações e saves deste usuário do Realtime Database?")) {
                    remove(ref(db, `users/${uid}`)).then(() => alert("Usuário removido do nó."));
                }
            });
        });
    });

    const adminGamesWatcher = ref(db, 'games');
    onValue(adminGamesWatcher, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val();

        setTimeout(() => {
            document.querySelectorAll('.game-card').forEach(card => {
                const img = card.querySelector('img');
                if (!img) return;
                const id = img.getAttribute('data-id');
                if (!id || id === 'local_rom') return;

                if (card.querySelector('.admin-card-actions')) return;

                const actionDiv = document.createElement('div');
                actionDiv.className = 'admin-card-actions';
                actionDiv.innerHTML = `
                    <button class="btn-sm btn-edit-game" data-id="${id}">Editar</button>
                    <button class="btn-sm btn-del-game" style="background-color:#ff4757;" data-id="${id}">Apagar</button>
                `;

                actionDiv.querySelector('.btn-edit-game').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const gId = e.target.getAttribute('data-id');
                    const gData = data[gId];
                    
                    adminGameId.value = gId;
                    adminCategory.value = gData.category;
                    adminSubcategory.value = gData.subcategory;
                    adminSystemCore.value = gData.system;
                    adminGameTitle.value = gData.title;
                    adminGameCover.value = gData.coverUrl;
                    adminGameUrl.value = gData.romUrl;

                    btnSaveGame.textContent = "Atualizar Jogo";
                    btnCancelEdit.classList.remove('hidden');
                });

                actionDiv.querySelector('.btn-del-game').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const gId = e.target.getAttribute('data-id');
                    if (confirm(`Deseja remover "${data[gId].title}" do catálogo?`)) {
                        remove(ref(db, `games/${gId}`)).then(() => alert("Jogo removido!"));
                    }
                });

                card.appendChild(actionDiv);
            });
        }, 600);
    });
}

btnExportJson.addEventListener('click', async () => {
    try {
        const snapshot = await get(ref(db, 'games'));
        if (!snapshot.exists()) {
            alert("O catálogo está vazio.");
            return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot.val(), null, 4));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `backup_jogos.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    } catch (e) { alert("Erro ao exportar backup: " + e.message); }
});

btnImportJson.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const importedGames = JSON.parse(event.target.result);
            if (confirm("Mesclar mídias importadas com as existentes?")) {
                await update(ref(db, 'games'), importedGames);
                alert("Catálogo importado com sucesso!");
                e.target.value = "";
            }
        } catch (err) {
            alert("Falha ao ler JSON: " + err.message);
        }
    };
    reader.readAsText(file);
});

document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.game-card')) {
        e.preventDefault();
        return false;
    }
});
