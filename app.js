import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { getDatabase, ref, set, get, onValue, update, remove } from "firebase/database";

// CONFIGURAÇÃO DO CONSOLE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyATr3AFcjJtamWRKZEBBcsA8vi-_ckCeEs",
  authDomain: "games2-c9b04.firebaseapp.com",
  projectId: "games2-c9b04",
  storageBucket: "games2-c9b04.firebasestorage.app",
  messagingSenderId: "417046305603",
  appId: "1:417046305603:web:52e921b1f10f9ed4b76df6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let currentUId = null;
let activeBlobUrl = null; 
let cachedGames = {};

// Captura de Elementos Gerais da Interface
const btnOpenAuth = document.getElementById('btn-open-auth');
const btnLogout = document.getElementById('btn-logout');
const userInfo = document.getElementById('user-info');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const btnAdminPanel = document.getElementById('btn-admin-panel');
const playerDashboard = document.getElementById('player-dashboard-section');

// Elementos dos Modais
const modalAuth = document.getElementById('modal-auth');
const modalForgot = document.getElementById('modal-forgot');
const modalAdmin = document.getElementById('modal-admin');

// Controle de Telas Internas dos Modais
const authLoginSec = document.getElementById('auth-login-section');
const authRegisterSec = document.getElementById('auth-register-section');

// Ouvinte de Estado da Sessão (Auth)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        currentUId = user.uid;
        
        if (btnOpenAuth) btnOpenAuth.classList.add('hidden');
        if (userInfo) userInfo.classList.remove('hidden');
        if (userAvatar) userAvatar.src = user.photoURL || "https://win98icon.org/styles/asset/windows98/v1/user_computer-0.png";
        
        // Fluxo de verificação de banimento / exclusão executada pelo admin
        const snapshot = await get(ref(database, `usuarios/${currentUId}/perfil`));
        if (snapshot.exists() && snapshot.val().banido === true) {
            alert("Esta conta foi desativada e removida pelo administrador.");
            signOut(auth);
            return;
        }

        if (user.email === "admin@admin.com") {
            if (userName) userName.textContent = "Diretor Admin";
            if (btnAdminPanel) btnAdminPanel.classList.remove('hidden');
            if (playerDashboard) playerDashboard.classList.add('hidden');
        } else {
            if (userName) userName.textContent = user.displayName ? user.displayName.split(' ')[0] : "Jogador";
            if (btnAdminPanel) btnAdminPanel.classList.add('hidden');
            if (playerDashboard) playerDashboard.classList.remove('hidden');
            
            // Cria o nó básico no banco caso o login via Google seja de um usuário inédito
            if (!snapshot.exists()) {
                await set(ref(database, `usuarios/${currentUId}/perfil`), {
                    nome: user.displayName ? user.displayName.split(' ')[0] : "Jogador",
                    sobrenome: "Google",
                    cidade: "Não Informada",
                    email: user.email,
                    role: "user",
                    solicitou_exclusao: false
                });
            }
            // Alimenta e monitora os painéis do jogador
            loadProfileDataToFields();
            setupPlayerDashboardObservers();
        }
    } else {
        currentUser = null;
        currentUId = null;
        if (btnOpenAuth) btnOpenAuth.classList.remove('hidden');
        if (userInfo) userInfo.classList.remove('hidden');
        if (userInfo) userInfo.classList.add('hidden');
        if (btnAdminPanel) btnAdminPanel.classList.add('hidden');
        if (playerDashboard) playerDashboard.classList.add('hidden');
    }
});

// Carrega os dados reais do usuário logado nos inputs do formulário de perfil (NOVO)
async function loadProfileDataToFields() {
    if (!currentUId) return;
    const snapshot = await get(ref(database, `usuarios/${currentUId}/perfil`));
    if (snapshot.exists()) {
        const p = snapshot.val();
        if(document.getElementById('edit-nome')) document.getElementById('edit-nome').value = p.nome || "";
        if(document.getElementById('edit-sobrenome')) document.getElementById('edit-sobrenome').value = p.sobrenome || "";
        if(document.getElementById('edit-cidade')) document.getElementById('edit-cidade').value = p.cidade || "";
        if(document.getElementById('edit-email')) document.getElementById('edit-email').value = p.email || "";
    }
}

// Salva alterações do perfil do usuário comum (NOVO)
if (document.getElementById('btn-save-profile')) {
    document.getElementById('btn-save-profile').addEventListener('click', async () => {
        if (!currentUId) return;
        const nome = document.getElementById('edit-nome').value.trim();
        const sobrenome = document.getElementById('edit-sobrenome').value.trim();
        const cidade = document.getElementById('edit-cidade').value.trim();

        if (!nome || !sobrenome || !cidade) { alert("Os campos Nome, Sobrenome e Cidade não podem ficar vazios!"); return; }

        try {
            await update(ref(database, `usuarios/${currentUId}/perfil`), { nome, sobrenome, cidade });
            alert("Informações de perfil atualizadas com sucesso!");
            if (userName) userName.textContent = nome;
        } catch (err) { alert("Falha ao salvar modificações: " + err.message); }
    });
}

// Abertura / Fechamento de Janelas Modais
if (btnOpenAuth) btnOpenAuth.addEventListener('click', () => { modalAuth.classList.remove('hidden'); authLoginSec.classList.remove('hidden'); authRegisterSec.classList.add('hidden'); });
if (document.getElementById('close-auth-modal')) document.getElementById('close-auth-modal').addEventListener('click', () => modalAuth.classList.add('hidden'));
if (document.getElementById('link-forgot-password')) document.getElementById('link-forgot-password').addEventListener('click', (e) => { e.preventDefault(); modalAuth.classList.add('hidden'); modalForgot.classList.remove('hidden'); });
if (document.getElementById('close-forgot-modal')) document.getElementById('close-forgot-modal').addEventListener('click', () => modalForgot.classList.add('hidden'));
if (document.getElementById('link-to-register')) document.getElementById('link-to-register').addEventListener('click', (e) => { e.preventDefault(); authLoginSec.classList.add('hidden'); authRegisterSec.classList.remove('hidden'); });
if (document.getElementById('link-to-login')) document.getElementById('link-to-login').addEventListener('click', (e) => { e.preventDefault(); authRegisterSec.classList.add('hidden'); authLoginSec.classList.remove('hidden'); });
if (btnAdminPanel) btnAdminPanel.addEventListener('click', () => { modalAdmin.classList.remove('hidden'); loadAdminUsersTable(); });
if (document.getElementById('close-admin-modal')) document.getElementById('close-admin-modal').addEventListener('click', () => modalAdmin.classList.add('hidden'));

// Fluxos de Execução da Autenticação
if (document.getElementById('btn-login-google')) {
    document.getElementById('btn-login-google').addEventListener('click', async () => {
        try { await signInWithPopup(auth, provider); modalAuth.classList.add('hidden'); } 
        catch (err) { alert("Erro ao autenticar com Google: " + err.message); }
    });
}

if (document.getElementById('btn-execute-register')) {
    document.getElementById('btn-execute-register').addEventListener('click', async () => {
        const nome = document.getElementById('reg-nome').value.trim();
        const sobrenome = document.getElementById('reg-sobrenome').value.trim();
        const cidade = document.getElementById('reg-cidade').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const senha = document.getElementById('reg-senha').value.trim();

        if(!nome || !sobrenome || !cidade || !email || !senha) { alert("Preencha todos os campos do cadastro!"); return; }

        try {
            const credential = await createUserWithEmailAndPassword(auth, email, senha);
            await set(ref(database, `usuarios/${credential.user.uid}/perfil`), {
                nome, sobrenome, cidade, email, role: "user", solicitou_exclusao: false
            });
            alert("Conta criada com sucesso!");
            modalAuth.classList.add('hidden');
        } catch (err) { alert("Erro ao criar conta: " + err.message); }
    });
}

if (document.getElementById('btn-execute-login')) {
    document.getElementById('btn-execute-login').addEventListener('click', async () => {
        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-senha').value.trim();
        
        try { await signInWithEmailAndPassword(auth, email, senha); modalAuth.classList.add('hidden'); } 
        catch (err) { alert("Credenciais Inválidas: " + err.message); }
    });
}

if (btnLogout) btnLogout.addEventListener('click', () => signOut(auth));

// Envio do link de recuperação de senha
if (document.getElementById('btn-execute-recovery')) {
    document.getElementById('btn-execute-recovery').addEventListener('click', async () => {
        const email = document.getElementById('forgot-email').value.trim();
        if (!email) { alert("Por favor, digite seu e-mail."); return; }
        try {
            await sendPasswordResetEmail(auth, email);
            alert("Link de redefinição enviado com sucesso para o e-mail informado!");
            modalForgot.classList.add('hidden');
        } catch (err) { alert("Erro ao enviar link de recuperação: " + err.message); }
    });
}

// Solicitação de exclusão de conta pelo usuário
if (document.getElementById('btn-request-delete-account')) {
    document.getElementById('btn-request-delete-account').addEventListener('click', async () => {
        if (confirm("Deseja enviar uma solicitação de exclusão para o administrador? Seus dados serão limpos.")) {
            await update(ref(database, `usuarios/${currentUId}/perfil`), { solicitou_exclusao: true });
            alert("Solicitação enviada! O administrador revisará e limpará sua conta em breve.");
        }
    });
}

// Monitoramento em tempo real do Catálogo de Jogos do Banco
onValue(ref(database, 'jogos'), (snapshot) => {
    const grid = document.getElementById('live-catalog-grid');
    if (!grid) return;
    grid.innerHTML = "";
    cachedGames = snapshot.val() || {};

    if (Object.keys(cachedGames).length === 0) {
        grid.innerHTML = `<p style="color:var(--text-gray); padding: 20px;">Nenhum jogo publicado pelo administrador ainda.</p>`;
        return;
    }

    for (let gameId in cachedGames) {
        const jogo = cachedGames[gameId];
        const card = document.createElement('div');
        card.className = "game-card";
        card.innerHTML = `
            <div class="badge-system">${jogo.plataforma.toUpperCase()}</div>
            <button class="btn-fav-card" data-id="${gameId}">❤</button>
            <div class="cover-wrapper" onclick="launchGame('${jogo.plataforma}', '${jogo.url_rom}', '${jogo.titulo}')">
                <img src="${jogo.url_capa}" alt="${jogo.titulo}">
            </div>
            <div class="game-info" onclick="launchGame('${jogo.plataforma}', '${jogo.url_rom}', '${jogo.titulo}')">
                <h3>${jogo.titulo}</h3>
                <p>${jogo.categoria} / ${jogo.subcategoria}</p>
            </div>
        `;
        grid.appendChild(card);
    }
    updateFavoriteButtonsVisuals();
});

// Mecânica Dinâmica de Favoritos
document.addEventListener('click', async (e) => {
    if (e.target && e.target.classList.contains('btn-fav-card')) {
        e.stopPropagation();
        if (!currentUId) { alert("Você precisa estar logado para favoritar jogos!"); return; }
        const gameId = e.target.getAttribute('data-id');
        const favRef = ref(database, `usuarios/${currentUId}/favoritos/${gameId}`);
        
        const snapshot = await get(favRef);
        if (snapshot.exists()) { await remove(favRef); } 
        else { await set(favRef, true); }
    }
});

function updateFavoriteButtonsVisuals() {
    if (!currentUId) return;
    get(ref(database, `usuarios/${currentUId}/favoritos`)).then((snapshot) => {
        const favs = snapshot.val() || {};
        document.querySelectorAll('.btn-fav-card').forEach(btn => {
            const id = btn.getAttribute('data-id');
            if (favs[id]) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    });
}

// Gerenciamento e Observação da Dashboard do Usuário
function setupPlayerDashboardObservers() {
    // Escuta favoritos do usuário logado
    onValue(ref(database, `usuarios/${currentUId}/favoritos`), (snapshot) => {
        const favGrid = document.getElementById('player-favorites-grid');
        if (!favGrid) return;
        favGrid.innerHTML = "";
        const favs = snapshot.val() || {};

        let count = 0;
        for (let gameId in favs) {
            if (cachedGames[gameId]) {
                count++;
                const jogo = cachedGames[gameId];
                const item = document.createElement('div');
                item.className = "game-card";
                item.style.transform = "none";
                item.innerHTML = `
                    <div class="cover-wrapper" style="height:110px;" onclick="launchGame('${jogo.plataforma}', '${jogo.url_rom}', '${jogo.titulo}')">
                        <img src="${jogo.url_capa}">
                    </div>
                    <div class="game-info" style="padding:10px;">
                        <h4 style="font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${jogo.titulo}</h4>
                    </div>
                `;
                favGrid.appendChild(item);
            }
        }
        if (count === 0) favGrid.innerHTML = `<p style="color:var(--text-gray); font-size:0.85rem;">Nenhum jogo favoritado.</p>`;
        updateFavoriteButtonsVisuals();
    });

    // Escuta saves em tempo real
    onValue(ref(database, `usuarios/${currentUId}/saves`), (snapshot) => {
        const tableBody = document.getElementById('player-saves-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = "";
        const saves = snapshot.val() || {};

        if (Object.keys(saves).length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--text-gray);">Nenhum save em nuvem.</td></tr>`;
            return;
        }

        for (let saveKey in saves) {
            const save = saves[saveKey];
            const dataString = new Date(save.atualizado_em).toLocaleString('pt-BR');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600; color:var(--neon-cyan);">${save.nome_arquivo}</td>
                <td>${dataString}</td>
                <td><button class="btn-sm" onclick="deleteSaveState('${saveKey}')">Deletar</button></td>
            `;
            tableBody.appendChild(tr);
        }
    });
}

window.deleteSaveState = async function(saveKey) {
    if (confirm("Tem certeza que deseja apagar permanentemente esse save de memória em nuvem?")) {
        await remove(ref(database, `usuarios/${currentUId}/saves/${saveKey}`));
        alert("Arquivo de save deletado!");
    }
};

// --- ÁREA DO ADMINISTRADOR CONTROLE TOTAL ---
if (document.getElementById('tab-add-game')) {
    document.getElementById('tab-add-game').addEventListener('click', () => {
        document.getElementById('admin-game-section').classList.remove('hidden');
        document.getElementById('admin-user-section').classList.add('hidden');
        document.getElementById('tab-add-game').style.background = "var(--neon-purple)";
        document.getElementById('tab-manage-users').style.background = "transparent";
    });
}
if (document.getElementById('tab-manage-users')) {
    document.getElementById('tab-manage-users').addEventListener('click', () => {
        document.getElementById('admin-user-section').classList.remove('hidden');
        document.getElementById('admin-game-section').classList.add('hidden');
        document.getElementById('tab-manage-users').style.background = "var(--neon-purple)";
        document.getElementById('tab-add-game').style.background = "transparent";
        loadAdminUsersTable();
    });
}

if (document.getElementById('btn-save-new-game')) {
    document.getElementById('btn-save-new-game').addEventListener('click', async () => {
        const titulo = document.getElementById('g-title').value.trim();
        const plataforma = document.getElementById('g-platform').value;
        const categoria = document.getElementById('g-category').value.trim();
        const subcategoria = document.getElementById('g-subcategory').value.trim();
        const url_capa = document.getElementById('g-cover').value.trim();
        const url_rom = document.getElementById('g-rom').value.trim();
        const descricao = document.getElementById('g-desc').value.trim();

        if(!titulo || !categoria || !subcategoria || !url_capa || !url_rom) { alert("Preencha os campos obrigatórios do jogo!"); return; }

        const newGameId = "game_" + Date.now();
        await set(ref(database, `jogos/${newGameId}`), {
            titulo, plataforma, categoria, subcategoria, url_capa, url_rom, descricao
        });

        alert("Novo jogo publicado com sucesso no catálogo!");
        modalAdmin.classList.add('hidden');
        document.getElementById('g-title').value = "";
        document.getElementById('g-cover').value = "";
        document.getElementById('g-rom').value = "";
        document.getElementById('g-desc').value = "";
    });
}

async function loadAdminUsersTable() {
    const tableBody = document.getElementById('admin-users-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = "";

    const snapshot = await get(ref(database, 'usuarios'));
    const usuarios = snapshot.val() || {};

    for (let uid in usuarios) {
        const p = usuarios[uid].perfil;
        if (!p || p.email === "admin@admin.com") continue;

        const statusExclusao = p.solicitou_exclusao ? `<span style="color:#ff4757; font-weight:bold;">⚠️ SOLICITADA</span>` : "Nenhuma";
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.nome} ${p.sobrenome}</td>
            <td>${p.email}</td>
            <td>${p.cidade}</td>
            <td>${statusExclusao}</td>
            <td><button class="btn-sm" onclick="executePurgeUserByAdmin('${uid}')" style="background:#ff4757; color:white;">Expulsar e Limpar</button></td>
        `;
        tableBody.appendChild(tr);
    }
}

window.executePurgeUserByAdmin = async function(userUid) {
    if (confirm("Atenção Admin: Esta ação irá apagar o nó do banco de dados imediatamente e banirá as conexões futuras deste ID. Confirmar purga?")) {
        // Marca o usuário como banido e deleta o conteúdo estrutural
        await update(ref(database, `usuarios/${userUid}/perfil`), { banido: true, solicitou_exclusao: false });
        await remove(ref(database, `usuarios/${userUid}/favoritos`));
        await remove(ref(database, `usuarios/${userUid}/saves`));
        alert("Nó do usuário eliminado com sucesso da memória real!");
        loadAdminUsersTable();
    }
};

// --- MOTOR DE EMBED SYNC DO EMULADOR COM BASE64 ---
window.launchGame = function(system, romUrl, gameTitle) {
    if (document.getElementById('catalog-screen')) document.getElementById('catalog-screen').classList.add('hidden');
    const emuScreen = document.getElementById('emulator-screen');
    if (emuScreen) emuScreen.classList.remove('hidden');
    if (document.getElementById('playing-title')) document.getElementById('playing-title').textContent = `Jogando: ${gameTitle}`;

    const wrapper = document.getElementById('player-wrapper-target');
    if (wrapper) wrapper.innerHTML = `<div id="emulator-player"><div id="game-canvas"></div></div>`;

    window.EJS_player = '#game-canvas';
    window.EJS_core = system; 
    window.EJS_gameUrl = romUrl; 
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/latest/data/'; 
    
    window.EJS_startOnLoaded = true; 
    window.EJS_AdUrl = ''; 
    window.EJS_myserver = 'true';
    window.EJS_disableLoadState = false; 
    window.EJS_forceLoadOnStart = true; 

    const sanitizedSaveKey = `${system}_${gameTitle.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const fileSaveName = `${gameTitle.replace(/[^a-zA-Z0-9]/g, "_")}.sav`;

    // RESTAURAÇÃO DE SAVE VIA REALTIME DATABASE (BASE64)
    window.EJS_onLogin = async function() {
        if (!currentUId) return;
        try {
            const snapshot = await get(ref(database, `usuarios/${currentUId}/saves/${sanitizedSaveKey}`));
            if (snapshot.exists()) {
                const base64Data = snapshot.val().dados_base64;
                const binaryString = atob(base64Data);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
                
                if (typeof window.EJS_LoadState === 'function') {
                    window.EJS_LoadState(bytes);
                    console.log("Save binário restaurado com sucesso do Realtime Database!");
                }
            }
        } catch (err) { console.error("Erro ao ler save do database:", err); }
    };

    // GRAVAÇÃO AUTOMÁTICA EM BASE64 NO BANCO
    window.EJS_onSaveState = async function(data) {
        if (!currentUId) { alert("Entre na sua conta para arquivar seus saves de progresso na nuvem!"); return; }
        
        let binary = "";
        const bytes = new Uint8Array(data);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
        const base64String = btoa(binary);

        try {
            await set(ref(database, `usuarios/${currentUId}/saves/${sanitizedSaveKey}`), {
                nome_arquivo: fileSaveName,
                dados_base64: base64String,
                updated_at: Date.now(), // mantido compatibilidade de timestamp interna
                atualizado_em: Date.now()
            });
            alert("Progresso arquivado com sucesso no seu nó do Realtime Database! 💾🔥");
        } catch (err) { alert("Erro ao gravar save no banco: " + err.message); }
    };

    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/latest/data/loader.js';
    script.async = true;
    document.body.appendChild(script);
};

// Processamento de Arquivos Locais
window.uploadAndPlay = function() {
    const fileInput = document.getElementById('rom-upload');
    let system = document.getElementById('system-select') ? document.getElementById('system-select').value : 'nes';
    
    if (!fileInput || fileInput.files.length === 0) { alert("Selecione um arquivo de ROM primeiro!"); return; }

    const file = fileInput.files[0];
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'smd' || extension === 'gen' || extension === 'md') system = 'segaMD'; 
    else if (extension === 'sms') system = 'mastersystem'; 

    if (activeBlobUrl) { URL.revokeObjectURL(activeBlobUrl); }
    activeBlobUrl = URL.createObjectURL(file);
    window.launchGame(system, activeBlobUrl, file.name);
};

if (document.getElementById('rom-upload')) {
    document.getElementById('rom-upload').addEventListener('change', (e) => {
        const display = document.getElementById('file-name-display');
        if (display) display.textContent = e.target.files.length > 0 ? e.target.files[0].name : "Nenhum arquivo selecionado";
    });
}

window.closeEmulator = function() {
    sessionStorage.setItem('emu_purge_active', 'true');
    window.location.reload();
};

window.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('emu_purge_active') === 'true') {
        sessionStorage.removeItem('emu_purge_active');
        if (document.getElementById('emulator-screen')) document.getElementById('emulator-screen').classList.add('hidden');
        if (document.getElementById('catalog-screen')) document.getElementById('catalog-screen').classList.remove('hidden');
    }
});
