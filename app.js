import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail 
} from "firebase/auth";
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    update, 
    remove, 
    push, 
    onValue 
} from "firebase/database";

// CONFIGURAÇÃO DO SEU FIREBASE (Mantido suas credenciais originais)
const firebaseConfig = {
  apiKey: "AIzaSyATr3AFcjJtamWRKZEBBcsA8vi-_ckCeEs",
  authDomain: "games2-c9b04.firebaseapp.com",
  projectId: "games2-c9b04",
  storageBucket: "games2-c9b04.firebasestorage.app",
  messagingSenderId: "417046305603",
  appId: "1:417046305603:web:52e921b1f10f9ed4b76df6"
};

// Inicialização dos Serviços
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

// Variáveis de Controle Globais
let currentUser = null;
let isAdmin = false;
let activeBlobUrl = null; 
let currentSaveDataBuffer = null; // Armazena temporariamente o buffer interceptado do emulador

const ADMIN_EMAIL = "admin@admin.com";

// Captura de Elementos da UI - Navbar e Telas
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userInfo = document.getElementById('user-info');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const btnClientArea = document.getElementById('btn-client-area');
const btnAdminArea = document.getElementById('btn-admin-area');
const adminPanel = document.getElementById('admin-panel');
const clientPanel = document.getElementById('client-panel');
const gridCatalogGames = document.getElementById('grid-catalog-games');
const gridFavorites = document.getElementById('grid-favorites');

// ==========================================
// 1. GERENCIAMENTO DE ESTADO DE AUTENTICAÇÃO
// ==========================================

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        isAdmin = (user.email === ADMIN_EMAIL);

        // Ajustes da Navbar
        btnLogin.classList.add('hidden');
        userInfo.classList.remove('hidden');
        userAvatar.src = user.photoURL || 'https://www.w3schools.com/howto/img_avatar.png';
        
        // Puxa o nome do Realtime Database se houver cadastro customizado
        const userSnap = await get(ref(db, `users/${user.uid}`));
        if (userSnap.exists() && userSnap.val().nome) {
            userName.textContent = userSnap.val().nome;
            document.getElementById('client-firstname').value = userSnap.val().nome;
            document.getElementById('client-lastname').value = userSnap.val().sobrenome || '';
        } else {
            userName.textContent = user.displayName ? user.displayName.split(' ')[0] : "Jogador";
        }

        // Exibição de Menus Condicionais
        btnClientArea.classList.remove('hidden');
        if (isAdmin) {
            btnAdminArea.classList.remove('hidden');
        } else {
            btnAdminArea.classList.add('hidden');
            adminPanel.classList.add('hidden');
        }

        // Carregar listas dependentes do usuário
        loadUserFavorites();
        loadUserSaves();
    } else {
        currentUser = null;
        isAdmin = false;
        btnLogin.classList.remove('hidden');
        userInfo.classList.add('hidden');
        btnClientArea.classList.add('hidden');
        btnAdminArea.classList.add('hidden');
        adminPanel.classList.add('hidden');
        clientPanel.classList.add('hidden');
        gridFavorites.innerHTML = '';
    }
});

// listeners de navegação dos painéis
btnClientArea.addEventListener('click', (e) => {
    e.preventDefault();
    clientPanel.classList.toggle('hidden');
    adminPanel.classList.add('hidden');
});

btnAdminArea.addEventListener('click', (e) => {
    e.preventDefault();
    adminPanel.classList.toggle('hidden');
    clientPanel.classList.add('hidden');
});

// Abertura do Modal de Login Inicial ao clicar em Entrar
btnLogin.addEventListener('click', () => {
    window.toggleModal('modal-login', true);
});

btnLogout.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.reload();
    });
});

// ==========================================
// 2. LOGICAS DOS MODAIS DE AUTENTICAÇÃO
// ==========================================

// Login com E-mail e Senha tradicional
document.getElementById('form-auth-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.toggleModal('modal-login', false);
    } catch (err) {
        alert("Erro no login: " + err.message);
    }
});

// Login com o Google (Modal interno)
document.getElementById('btn-google-login-auth').addEventListener('submit', (e) => e.preventDefault());
document.getElementById('btn-google-login-auth').addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        // Cria nó básico caso o usuário do Google entre pela primeira vez
        const user = result.user;
        const userSnap = await get(ref(db, `users/${user.uid}`));
        if (!userSnap.exists()) {
            await set(ref(db, `users/${user.uid}`), {
                nome: user.displayName ? user.displayName.split(' ')[0] : 'Usuário',
                sobrenome: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : 'Google',
                email: user.email,
                cidade: 'Não informada',
                estado: 'N/A'
            });
        }
        window.toggleModal('modal-login', false);
    } catch (err) {
        console.error(err);
    }
});

// Registro de Nova Conta + Gravação de Metadados customizados
document.getElementById('form-auth-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('reg-firstname').value;
    const sobrenome = document.getElementById('reg-lastname').value;
    const cidade = document.getElementById('reg-city').value;
    const estado = document.getElementById('reg-state').value;
    const email = document.getElementById('reg-email').value;
    const senha = document.getElementById('reg-password').value;

    try {
        const res = await createUserWithEmailAndPassword(auth, email, senha);
        // Cria os dados adicionais no Firebase Realtime Database
        await set(ref(db, `users/${res.user.uid}`), {
            nome, sobrenome, cidade, estado, email
        });
        alert("Conta criada com sucesso! Seja bem-vindo.");
        window.toggleModal('modal-register', false);
    } catch (err) {
        alert("Erro ao cadastrar: " + err.message);
    }
});

// Redefinição de Senha por Modal
document.getElementById('form-auth-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    try {
        await sendPasswordResetEmail(auth, email);
        alert("E-mail de redefinição enviado! Verifique sua caixa de entrada.");
        window.toggleModal('modal-reset-password', false);
    } catch (err) {
        alert("Erro: " + err.message);
    }
});

// ==========================================
// 3. OPERAÇÕES DO PAINEL ADMIN (CRUD JOGOS)
// ==========================================

// Submissão do Formulário (Salvar / Editar Jogo)
document.getElementById('form-game').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    const gameId = document.getElementById('admin-game-id').value;
    const gameData = {
        title: document.getElementById('admin-game-title').value,
        category: document.getElementById('admin-game-category').value.toLowerCase().trim(),
        subcategory: document.getElementById('admin-game-subcategory').value || 'Geral',
        desc: document.getElementById('admin-game-desc').value || '',
        thumb: document.getElementById('admin-game-thumb').value,
        url: document.getElementById('admin-game-url').value
    };

    try {
        if (gameId) {
            // Edição
            await update(ref(db, `games/${gameId}`), gameData);
            alert("Jogo atualizado com sucesso!");
        } else {
            // Inserção
            const newGameRef = push(ref(db, 'games'));
            await set(newGameRef, gameData);
            alert("Jogo adicionado ao Firebase!");
        }
        document.getElementById('form-game').reset();
        document.getElementById('admin-game-id').value = '';
        document.getElementById('btn-cancel-edit').classList.add('hidden');
    } catch (err) {
        alert("Erro ao salvar jogo: " + err.message);
    }
});

document.getElementById('btn-cancel-edit').addEventListener('click', () => {
    document.getElementById('form-game').reset();
    document.getElementById('admin-game-id').value = '';
    document.getElementById('btn-cancel-edit').classList.add('hidden');
});

// Escuta em Tempo Real do Catálogo de Jogos do Firebase e atualiza o Front-end
onValue(ref(db, 'games'), (snapshot) => {
    const data = snapshot.val();
    
    // 1. Limpa e reconstrói a tabela do Admin
    const tbodyGames = document.getElementById('admin-games-list');
    tbodyGames.innerHTML = '';
    
    // 2. Seleciona o container para injetar os cards dinâmicos no catálogo principal
    const dynamicCardsContainer = document.getElementById('grid-catalog-games');
    
    // Mantém os cards estáticos originais do HTML intactos na primeira carga
    // Vamos coletar os cards dinâmicos vindos do Firebase e adicioná-los acima
    const cardsDinamicosHTML = [];

    if (data) {
        Object.keys(data).forEach(key => {
            const game = data[key];
            
            // Renderiza linha na Tabela Admin
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px;">${game.title}</td>
                <td style="padding:10px;"><span class="badge-system" style="position:static;">${game.category.toUpperCase()}</span></td>
                <td style="padding:10px;">${game.subcategory}</td>
                <td style="padding:10px;">
                    <button class="btn-sm-action btn-edit-action" data-id="${key}">Editar</button>
                    <button class="btn-sm-action btn-delete-action" data-id="${key}">Excluir</button>
                </td>
            `;
            tbodyGames.appendChild(tr);

            // Monta o Card do Jogo para o Catálogo Geral
            cardsDinamicosHTML.push(`
                <div class="game-card" data-id="${key}">
                    <div class="badge-system">${game.category.toUpperCase()}</div>
                    <button class="btn-favorite-card" data-id="${key}" style="position:absolute; top:12px; right:12px; background:rgba(0,0,0,0.6); border:1px solid var(--neon-purple); color:#fff; border-radius:50%; width:30px; height:30px; cursor:pointer; z-index:5;">⭐</button>
                    <div class="cover-wrapper" onclick="launchGame('${game.category}', '${game.url}', '${game.title}')">
                        <img src="${game.thumb}" alt="${game.title}">
                    </div>
                    <div class="game-info" onclick="launchGame('${game.category}', '${game.url}', '${game.title}')">
                        <h3>${game.title}</h3>
                        <p>${game.subcategory}</p>
                    </div>
                </div>
            `);
        });

        // Delegação de eventos para botões de ação do Admin (Editar/Excluir)
        tbodyGames.querySelectorAll('.btn-edit-action').forEach(btn => {
            btn.addEventListener('click', () => populateFormForEdit(btn.getAttribute('data-id'), data[btn.getAttribute('data-id')]));
        });
        tbodyGames.querySelectorAll('.btn-delete-action').forEach(btn => {
            btn.addEventListener('click', () => deleteGame(btn.getAttribute('data-id')));
        });
    }

    // Gerenciamento e Injeção dos Cards do Firebase no GRID sem apagar os estáticos fixos do seu HTML
    // Remove os dinâmicos antigos se houver e insere os novos atualizados no início do Grid
    const antigosDinamicos = dynamicCardsContainer.querySelectorAll('.game-card[data-id]');
    antigosDinamicos.forEach(card => card.remove());
    dynamicCardsContainer.insertAdjacentHTML('afterbegin', cardsDinamicosHTML.join(''));

    // Configura evento de clique nos botões de favoritar de todos os novos cards injetados
    dynamicCardsContainer.querySelectorAll('.btn-favorite-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavoriteGame(btn.getAttribute('data-id'));
        });
    });
});

function populateFormForEdit(id, game) {
    document.getElementById('admin-game-id').value = id;
    document.getElementById('admin-game-title').value = game.title;
    document.getElementById('admin-game-category').value = game.category;
    document.getElementById('admin-game-subcategory').value = game.subcategory;
    document.getElementById('admin-game-desc').value = game.desc;
    document.getElementById('admin-game-thumb').value = game.thumb;
    document.getElementById('admin-game-url').value = game.url;
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
    adminPanel.scrollIntoView({ behavior: 'smooth' });
}

async function deleteGame(id) {
    if (confirm("Tem certeza que deseja remover este jogo permanentemente do Firebase?")) {
        await remove(ref(db, `games/${id}`));
        alert("Jogo excluído.");
    }
}

// Escuta em tempo real lista de usuários cadastrados para o Admin visualizar
onValue(ref(db, 'users'), (snapshot) => {
    if (!isAdmin) return;
    const users = snapshot.val();
    const tbodyUsers = document.getElementById('admin-users-list');
    tbodyUsers.innerHTML = '';
    if (users) {
        Object.keys(users).forEach(uid => {
            const u = users[uid];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px;">${u.nome} ${u.sobrenome || ''}</td>
                <td style="padding:10px;">${u.email}</td>
                <td style="padding:10px;">${u.cidade || 'N/A'} - ${u.estado || 'N/A'}</td>
            `;
            tbodyUsers.appendChild(tr);
        });
    }
});

// IMPORTAR E EXPORTAR JSON (Categorias / Subcategorias / Completo)
document.getElementById('btn-export-json').addEventListener('click', async () => {
    const snap = await get(ref(db, 'games'));
    if (!snap.exists()) return alert("Nenhum jogo cadastrado para exportar.");
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snap.val(), null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "catalogo_jogos_firebase.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
});

document.getElementById('btn-import-json').addEventListener('click', () => {
    document.getElementById('input-import-json').click();
});

document.getElementById('input-import-json').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const json = JSON.parse(event.target.result);
            if (typeof json === 'object') {
                // Se for um dicionário estruturado por chaves originais ou array
                const updates = {};
                Object.keys(json).forEach(k => {
                    const gameId = k.startsWith('-') ? k : push(ref(db, 'games')).key; 
                    updates[`games/${gameId}`] = json[k];
                });
                await update(ref(db), updates);
                alert("JSON Importado com sucesso e mesclado no Firebase!");
            }
        } catch (err) {
            alert("Erro na leitura do arquivo JSON estrutural: " + err.message);
        }
    };
    reader.readAsText(file);
});

// ==========================================
// 4. ÁREA DO CLIENTE (PERFIL, FAVORITOS & CLOUD SAVES)
// ==========================================

// Edição de Perfil (Nome e Sobrenome)
document.getElementById('form-profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const nome = document.getElementById('client-firstname').value;
    const sobrenome = document.getElementById('client-lastname').value;

    try {
        await update(ref(db, `users/${currentUser.uid}`), { nome, sobrenome });
        userName.textContent = nome;
        alert("Perfil atualizado com sucesso!");
    } catch (err) {
        alert("Erro ao salvar: " + err.message);
    }
});

// Sistema para Adicionar / Remover dos Favoritos
async function toggleFavoriteGame(gameId) {
    if (!currentUser) return alert("Você precisa estar logado para favoritar jogos!");
    const favRef = ref(db, `users/${currentUser.uid}/favorites/${gameId}`);
    const snap = await get(favRef);
    if (snap.exists()) {
        await remove(favRef);
    } else {
        await set(favRef, true);
    }
    loadUserFavorites();
}

async function loadUserFavorites() {
    if (!currentUser) return;
    const favsSnap = await get(ref(db, `users/${currentUser.uid}/favorites`));
    const gamesSnap = await get(ref(db, 'games'));
    
    gridFavorites.innerHTML = '';
    if (favsSnap.exists() && gamesSnap.exists()) {
        const favs = favsSnap.val();
        const games = gamesSnap.val();
        
        Object.keys(favs).forEach(gameId => {
            if (games[gameId]) {
                const game = games[gameId];
                gridFavorites.innerHTML += `
                    <div class="game-card">
                        <div class="badge-system">${game.category.toUpperCase()}</div>
                        <div class="cover-wrapper" onclick="launchGame('${game.category}', '${game.url}', '${game.title}')">
                            <img src="${game.thumb}" alt="${game.title}">
                        </div>
                        <div class="game-info">
                            <h3>${game.title}</h3>
                            <button class="btn-sm" onclick="window.removeFavoriteDirect('${gameId}')" style="margin-top:10px; border-color:#ff4757; color:#ff4757; width:100%;">Remover Favorito</button>
                        </div>
                    </div>
                `;
            }
        });
    }
}
window.removeFavoriteDirect = async (id) => { if(currentUser) { await remove(ref(db, `users/${currentUser.uid}/favorites/${id}`)); loadUserFavorites(); } };

// Carregamento dos Saves na Nuvem para gerenciamento na Área do Jogador
function loadUserSaves() {
    if (!currentUser) return;
    onValue(ref(db, `users/${currentUser.uid}/saves`), (snapshot) => {
        const list = document.getElementById('client-saves-list');
        list.innerHTML = '';
        const saves = snapshot.val();
        if (saves) {
            Object.keys(saves).forEach(key => {
                const item = saves[key];
                const li = document.createElement('li');
                li.innerHTML = `
                    <div>
                        <span>🎮 <b>${item.gameTitle}</b></span>
                        <small>Identificador: ${item.saveName} | Em: ${item.date}</small>
                    </div>
                    <button class="btn-sm" style="border-color:#ff4757; color:#ff4757;" data-id="${key}">Excluir</button>
                `;
                li.querySelector('button').addEventListener('click', async () => {
                    if (confirm("Excluir este save state permanente?")) {
                        await remove(ref(db, `users/${currentUser.uid}/saves/${key}`));
                    }
                });
                list.appendChild(li);
            });
        } else {
            list.innerHTML = `<p style="font-size:13px; color:var(--text-gray);">Nenhum save state armazenado nesta conta.</p>`;
        }
    });
}

// ==========================================
// 5. INTEGRAÇÃO DOS CLOUD SAVES COM EMULATORJS
// ==========================================

window.launchGame = function(system, romUrl, gameTitle) {
    document.getElementById('catalog-screen').classList.add('hidden');
    const emuScreen = document.getElementById('emulator-screen');
    emuScreen.classList.remove('hidden');
    document.getElementById('playing-title').textContent = `Jogando: ${gameTitle}`;

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

    // CAPTURA E DOWNLOAD AUTOMÁTICO DO SAVE SE ESTIVER LOGADO
    window.EJS_onLogin = async function() {
        if (!currentUser) return;
        try {
            // Busca o último save cadastrado para o respectivo título no Realtime Database
            const savesSnap = await get(ref(db, `users/${currentUser.uid}/saves`));
            if (savesSnap.exists()) {
                const saves = savesSnap.val();
                // Encontra o mais recente para este título de jogo
                const match = Object.keys(saves)
                    .map(k => saves[k])
                    .filter(s => s.gameTitle === gameTitle)
                    .pop();

                if (match && match.base64Data) {
                    // Transforma a string Base64 de volta para Array de Bytes (Uint8Array)
                    const binaryString = atob(match.base64Data);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    window.EJS_LoadState(bytes);
                    console.log("Estado de progresso Cloud restaurado!");
                }
            }
        } catch (err) {
            console.error("Falha ao injetar save state:", err);
        }
    };

    // CAPTURA INTERNA DE SALVAMENTO: ABRE O SEU MODAL INTERNO DO SITE
    window.EJS_onSaveState = function(data) {
        if (!currentUser) {
            alert("Acesse sua conta para salvar seu progresso diretamente no Firebase!");
            return;
        }
        // Armazena temporariamente na variável de escopo global para o formulário ler
        currentSaveDataBuffer = data;
        // Abre o modal de entrada de descrição do save
        window.toggleModal('modal-save-state', true);
    };

    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/latest/data/loader.js';
    document.getElementById('emulator-player').appendChild(script);
};

// Listener do formulário interno do Modal para concluir o upload em Base64
document.getElementById('form-save-state').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || !currentSaveDataBuffer) return;

    const saveName = document.getElementById('save-state-name').value;
    const gameTitle = document.getElementById('playing-title').textContent.replace('Jogando: ', '');

    // Conversão segura do Uint8Array para String Base64
    let binary = '';
    const bytes = new Uint8Array(currentSaveDataBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64String = btoa(binary);

    const savePayload = {
        gameTitle: gameTitle,
        saveName: saveName,
        base64Data: base64String,
        date: new Date().toLocaleString('pt-BR')
    };

    try {
        const userSavesRef = ref(db, `users/${currentUser.uid}/saves`);
        const newSavePush = push(userSavesRef);
        await set(newSavePush, savePayload);

        alert("Progresso salvo com sucesso em sua conta Firebase Cloud! ☁️🎮");
        window.toggleModal('modal-save-state', false);
        document.getElementById('form-save-state').reset();
        currentSaveDataBuffer = null;
    } catch (err) {
        alert("Erro no upload do State: " + err.message);
    }
});

// ==========================================
// 6. LOGICAS DO INPUT DE UPLOAD E LIMPEZA
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    // Atualiza o display do nome do arquivo quando escolhido localmente
    const fileInput = document.getElementById('rom-upload');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const fileName = e.target.files[0] ? e.target.files[0].name : "Nenhum arquivo selecionado";
            document.getElementById('file-name-display').textContent = fileName;
        });
    }

    if (sessionStorage.getItem('emu_purge_active') === 'true') {
        sessionStorage.removeItem('emu_purge_active');
        document.getElementById('emulator-screen').classList.add('hidden');
        document.getElementById('catalog-screen').classList.remove('hidden');
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

    if (extension === 'smd' || extension === 'gen' || extension === 'md') {
        system = 'segaMD'; 
    } else if (extension === 'sms') {
        system = 'mastersystem'; 
    }

    if (activeBlobUrl) { URL.revokeObjectURL(activeBlobUrl); }
    activeBlobUrl = URL.createObjectURL(file);
    launchGame(system, activeBlobUrl, file.name);
};

window.closeEmulator = function() {
    sessionStorage.setItem('emu_purge_active', 'true');
    window.location.reload();
};
