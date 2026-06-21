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
    child, 
    update, 
    remove, 
    onValue 
} from "firebase/database";

// CONFIGURAÇÃO DO CONSOLE FIREBASE
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
        
        // Pega os dados extras do usuário no Realtime Database (Nome/Sobrenome)
        const snapshot = await get(ref(db, `users/${user.uid}/profile`));
        let displayNick = user.email.split('@')[0];
        if (snapshot.exists()) {
            displayNick = snapshot.val().name;
        }
        userName.textContent = displayNick;

        // Validação estrita se é o Administrador
        if (user.email === 'admin@admin.com') {
            userBadge.textContent = 'Admin';
            userBadge.classList.add('admin');
            adminPanel.classList.remove('hidden');
            startAdminMonitoring(); // Inicia leitura da lista de usuários
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
        // Se deslogar no meio do jogo, cancela o monitoramento ativo
        if (currentPlayingGameId) updatePlayingStatus("Nenhum");
    }
});

// ==========================================
// 2. FLUXOS DE AUTENTICAÇÃO CUSTOMIZADA
// ==========================================

// Alternar Abas (Login / Cadastro)
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

// Abrir e fechar tela de Autenticação
btnNavAuth.addEventListener('click', () => {
    authScreen.classList.remove('hidden');
    catalogScreen.classList.add('hidden');
});
btnCancelAuth.addEventListener('click', () => {
    authScreen.classList.add('hidden');
    catalogScreen.classList.remove('hidden');
});

// Submissão do Formulário de Login
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

// Submissão do Formulário de Cadastro (Com Whitelist Estrita)
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

        // Salva os metadados do Perfil no nó do usuário dentro do Realtime Database
        await set(ref(db, `users/${user.uid}/profile`), {
            name: name,
            lastname: lastname,
            email: email,
            registeredAt: new Date().toISOString()
        });

        alert("Conta criada com sucesso! Seja bem-vindo.");
        authScreen.classList.add('hidden');
        catalogScreen.classList.remove('hidden');
        formRegister.reset();
    } catch (error) {
        alert("Erro no cadastro: " + error.message);
    }
});

// Logout do Sistema
btnLogout.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.reload();
    });
});

// Modal de Redefinição de Senha (Esqueci Senha)
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
        alert("E-mail de redefinição enviado! Verifique sua caixa de entrada ou spam.");
        modalForgot.classList.add('hidden');
        formForgot.reset();
    } catch (error) {
        alert("Erro ao enviar redefinição: " + error.message);
    }
});


// ==========================================
// 3. RENDERIZAÇÃO DINÂMICA DO CATÁLOGO DE JOGOS
// ==========================================
const gamesRef = ref(db, 'games');
onValue(gamesRef, (snapshot) => {
    dynamicCatalog.innerHTML = "";
    if (!snapshot.exists()) {
        dynamicCatalog.innerHTML = '<div class="section-title"><h2>🛸 Catálogo</h2><p>Nenhum jogo cadastrado no banco de dados.</p></div>';
        return;
    }

    const data = snapshot.val();
    
    // Organização Estruturada: Categoria -> Subcategoria -> Jogos
    const structuredCatalog = {};

    for (let id in data) {
        const item = data[id];
        if (!structuredCatalog[item.category]) structuredCatalog[item.category] = {};
        if (!structuredCatalog[item.category][item.subcategory]) structuredCatalog[item.category][item.subcategory] = [];
        
        // Inclui o ID do nó no objeto para operações futuras
        structuredCatalog[item.category][item.subcategory].push({ id, ...item });
    }

    // Varre o objeto estruturado construindo o HTML assincronamente
    for (let category in structuredCatalog) {
        const categoryBlock = document.createElement('section');
        categoryBlock.className = 'category-block';
        categoryBlock.innerHTML = `<h2>🛸 ${category}</h2><p>Explore esta coleção clássica</p>`;

        for (let subcategory in structuredCatalog[category]) {
            const subBlock = document.createElement('div');
            subBlock.className = 'subcategory-block';
            subBlock.innerHTML = `<h3>🕹️ ${subcategory}</h3>`;

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

                // Evento de Inicialização do jogo
                card.addEventListener('click', () => {
                    launchGame(game.system, game.romUrl, game.title, game.id);
                });

                // 🔥 PROTEÇÃO CIRÚRGICA 100%: Trava completa de clique direito no card
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
// 4. SISTEMA E MOTOR INTEGRADO DO EMULADOR (EmulatorJS)
// ==========================================
window.launchGame = function(system, romUrl, gameTitle, gameId = "local_rom") {
    catalogScreen.classList.add('hidden');
    adminPanel.classList.add('hidden');
    emulatorScreen.classList.remove('hidden');
    document.getElementById('playing-title').textContent = `Jogando: ${gameTitle}`;
    
    currentPlayingGameId = gameId;
    updatePlayingStatus(gameTitle);

    const wrapper = document.getElementById('player-wrapper-target');
    wrapper.innerHTML = `<div id="emulator-player"><div id="game-canvas"></div></div>`;

    window.EJS_player = '#game-canvas';
    window.EJS_core = system; 
    window.EJS_gameUrl = romUrl; 
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/latest/data/'; 
    
    window.EJS_startOnLoaded = true; 
    window.EJS_AdUrl = ''; 
    window.EJS_myserver = 'true';

    window.EJS_disableLoadState = true; 
    window.EJS_forceLoadOnStart = true; 

    // CHANCE DE RECUPERAR SAVE STATE VIA REALTIME DATABASE (BASE64)
    window.EJS_onLogin = async function() {
        if (!currentUser || gameId === "local_rom") return;

        try {
            const saveSnapshot = await get(ref(db, `users/${currentUser.uid}/saves/${gameId}`));
            if (saveSnapshot.exists()) {
                const base64Data = saveSnapshot.val().state;
                // Transforma a String Base64 guardada de volta em ArrayBuffer binário para a RAM
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                window.EJS_LoadState(bytes);
                console.log("Progresso do Firebase Realtime Database injetado com sucesso na RAM!");
            }
        } catch (err) {
            console.error("Falha ao recuperar save do Realtime Database:", err);
        }
    };

    // OPERAÇÃO DE GRAVAÇÃO DO SAVE STATE COM PROTEÇÃO CONTRA CONFLITOS DE RENDERING/WEBGL
    window.EJS_onSaveState = async function(data) {
        if (!currentUser) {
            alert("Aviso: Faça login para salvar suas conquistas e fases nesta plataforma!");
            return;
        }
        if (gameId === "local_rom") {
            alert("Saves automáticos não estão ativos para mídias carregadas localmente.");
            return;
        }

        try {
            // Tratamento preventivo: se o emulador falhar na renderização e enviar dados inválidos
            if (!data || data.byteLength === 0) {
                console.warn("Aviso: O emulador enviou um buffer de save vazio ou corrompido devido às restrições do WebGL do navegador.");
                return;
            }

            // Transforma o ArrayBuffer de dados físicos da RAM em String Base64 para aceitar no JSON
            let binary = '';
            const bytes = new Uint8Array(data);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64State = btoa(binary);

            await set(ref(db, `users/${currentUser.uid}/saves/${gameId}`), {
                state: base64State,
                updatedAt: new Date().toISOString(),
                gameTitle: gameTitle
            });
            console.log("Estado de fase gravado com sucesso no nó do Realtime Database!");
        } catch (err) {
            console.error("Erro ao persistir save state no Realtime Database:", err);
        }
    };

    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/latest/data/loader.js';
    document.getElementById('emulator-player').appendChild(script);
};

// Atualizador de Atividade de Jogo (Monitoramento do Admin)
async function updatePlayingStatus(gameName) {
    if (!currentUser) return;
    try {
        await update(ref(db, `users/${currentUser.uid}/profile`), {
            currentlyPlaying: gameName
        });
    } catch (e) { console.error(e); }
}

// Operação de Fechamento Máximo (Purga de Threads)
window.closeEmulator = function() {
    updatePlayingStatus("Nenhum").then(() => {
        sessionStorage.setItem('emu_purge_active', 'true');
        window.location.reload();
    });
};

// Resgate de estado pós purga
window.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('emu_purge_active') === 'true') {
        sessionStorage.removeItem('emu_purge_active');
        emulatorScreen.classList.add('hidden');
        catalogScreen.classList.remove('hidden');
    }
});

// Processamento de Upload e Leitura de ROMs Locais para a RAM
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

// Utilitário estético para exibir nome do arquivo selecionado localmente
document.getElementById('rom-upload')?.addEventListener('change', (e) => {
    const fileName = e.target.files[0]?.name || "Nenhum arquivo selecionado";
    document.getElementById('file-name-display').textContent = fileName;
});


// ==========================================
// 5. MÓDULO EXCLUSIVO DO ADMIN (CRUD / BACKUP)
// ==========================================

// Inserção ou Atualização de Mídias via Formulário Admin
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
        alert(adminGameId.value ? "Jogo editado com sucesso!" : "Mídia incluída no banco de dados!");
        resetAdminForm();
    } catch (err) {
        alert("Erro na operação administrativa: " + err.message);
    }
});

// Cancelar Edição do Formulário
btnCancelEdit.addEventListener('click', resetAdminForm);

function resetAdminForm() {
    formAdminGame.reset();
    adminGameId.value = "";
    btnSaveGame.textContent = "Salvar Mídia 💾";
    btnCancelEdit.classList.add('hidden');
}

// Injeção Global de Gatilhos de Edição e Exclusão no Catálogo Administrativo
function startAdminMonitoring() {
    // Escuta ativa de usuários e o que eles estão jogando
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
                <td><span style="color:var(--text-gray);">${profile.email}</span></td>
                <td><span style="color:var(--neon-cyan);">${profile.currentlyPlaying || 'Nenhum'}</span></td>
                <td>
                    <button class="btn-sm btn-delete-user" data-uid="${uid}" data-email="${profile.email}">
                        Deletar Conta
                    </button>
                </td>
            `;
            adminUsersList.appendChild(tr);
        }

        // Evento de deleção de conta do usuário sob solicitação
        document.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const uid = e.target.getAttribute('data-uid');
                const email = e.target.getAttribute('data-email');
                
                if (confirm(`ATENÇÃO: Deseja apagar permanentemente todos os saves e o nó do usuário [ ${email} ] do banco? Não afetará o Auth diretamente.`)) {
                    remove(ref(db, `users/${uid}`)).then(() => {
                        alert(`Dados limpos do Realtime Database com sucesso!\nCopie o e-mail: ${email} e remova-o manualmente no painel de Authentication do Firebase.`);
                    }).catch(err => alert("Erro ao deletar: " + err.message));
                }
            });
        });
    });

    // Adiciona botões de gerência administrativa nos cards quando renderizados (Apenas se for Admin logado)
    const adminGamesWatcher = ref(db, 'games');
    onValue(adminGamesWatcher, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val();

        // Aguarda a renderização do catálogo regular e anexa botões de controle adicionais apenas na visão do admin
        setTimeout(() => {
            document.querySelectorAll('.game-card').forEach(card => {
                const img = card.querySelector('img');
                if (!img) return;
                const id = img.getAttribute('data-id');
                if (!id || id === 'local_rom') return;

                // Evita duplicidade de painel interno de botões
                if (card.querySelector('.admin-card-actions')) return;

                const actionDiv = document.createElement('div');
                actionDiv.className = 'admin-card-actions';
                actionDiv.style = "padding:10px; display:flex; gap:10px; background: rgba(0,0,0,0.5);";
                actionDiv.innerHTML = `
                    <button class="btn-sm btn-edit-game" style="border-color:var(--neon-cyan); color:var(--neon-cyan);" data-id="${id}">Editar</button>
                    <button class="btn-sm btn-del-game" style="border-color:#ff4757; color:#ff4757;" data-id="${id}">Apagar</button>
                `;

                // Intercepta cliques de edição
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

                    btnSaveGame.textContent = "Atualizar Mídia 🔄";
                    btnCancelEdit.classList.remove('hidden');
                    window.scrollTo({ top: adminPanel.offsetTop - 20, behavior: 'smooth' });
                });

                // Intercepta cliques de exclusão de mídia
                actionDiv.querySelector('.btn-del-game').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const gId = e.target.getAttribute('data-id');
                    if (confirm(`Deseja apagar o jogo "${data[gId].title}" do catálogo?`)) {
                        remove(ref(db, `games/${gId}`)).then(() => alert("Jogo removido!"));
                    }
                });

                card.appendChild(actionDiv);
            });
        }, 600);
    });
}

// Exportação de Backup Total em JSON
btnExportJson.addEventListener('click', async () => {
    try {
        const snapshot = await get(ref(db, 'games'));
        if (!snapshot.exists()) {
            alert("O catálogo está vazio. Nada para exportar.");
            return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot.val(), null, 4));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `backup_jogos_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    } catch (e) { alert("Erro ao exportar backup: " + e.message); }
});

// Importação em Lote de Backup JSON
btnImportJson.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const importedGames = JSON.parse(event.target.result);
            if (typeof importedGames !== 'object') throw new Error("Formato JSON Inválido.");

            if (confirm("Isto irá mesclar as mídias importadas com seu catálogo atual no Firebase. Prosseguir?")) {
                await update(ref(db, 'games'), importedGames);
                alert("Catálogo importado e atualizado com sucesso!");
                e.target.value = ""; // Reseta o input file
            }
        } catch (err) {
            alert("Falha ao processar arquivo JSON: " + err.message);
        }
    };
    reader.readAsText(file);
});

// 🔥 TRAVA GLOBAL DE PREVENÇÃO EXTRA DO MOUSE
document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.game-card')) {
        e.preventDefault();
        return false;
    }
});
