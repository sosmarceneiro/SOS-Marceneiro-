let registeredUsers = JSON.parse(localStorage.getItem('sos_registered_users') || '[]');
let currentUser = JSON.parse(localStorage.getItem('sos_logged_user_session') || 'null');
let adminPixKey = localStorage.getItem('sos_admin_pix_key') || 'pix@sosmarceneiro.com.br';
let carpentersData = JSON.parse(localStorage.getItem('sos_carpenters_aracatuba') || '[]');
let internalOrdersData = JSON.parse(localStorage.getItem('sos_internal_orders') || '[]');

let planPrices = JSON.parse(localStorage.getItem('sos_plan_prices') || JSON.stringify({
    mensal: '15',
    trimestral: '40',
    semestral: '75',
    anual: '100'
}));

let appBranding = JSON.parse(localStorage.getItem('sos_app_branding') || JSON.stringify({
    name: 'SOS MARCENEIRO',
    subtitle: 'PLATAFORMA NACIONAL',
    logoType: 'image',
    logoValue: 'sos_marceneiro_apenas_esquerda.jpg'
}));

let currentLoggedInCarpenter = null;
let activeOrderIdForReply = null;
let isRegisterMode = false;
let currentRepairOrder = { category: '', quantity: 1, state: '', city: '', neighborhood: '', observation: '', mediaDataUrl: null, mediaType: null };
let tempCarpenterForRenewal = null;

window.onload = function() {
    checkAndExpireSubscriptions();
    initStatesSelects();
    updateAuthDisplay();
    updateAdminPixDisplay();
    applyAppBranding();
    renderPlanPricesOnForm();
    checkOfflineStatus();
    checkAdminAutoLogin();
};

// VERIFICAÇÃO AUTOMÁTICA DE EXPIRAÇÃO DE ASSINATURA AO ABRIR O APP
function checkAndExpireSubscriptions() {
    carpentersData = JSON.parse(localStorage.getItem('sos_carpenters_aracatuba') || '[]');
    const now = new Date().getTime();
    let updated = false;

    carpentersData.forEach(c => {
        if (c.pago && c.expirationTimestamp) {
            if (now > c.expirationTimestamp) {
                c.pago = false; // Corta automaticamente
                c.expired = true;
                updated = true;
            }
        }
    });

    if (updated) {
        localStorage.setItem('sos_carpenters_aracatuba', JSON.stringify(carpentersData));
    }
}

function renderPlanPricesOnForm() {
    const m = document.getElementById('price-display-mensal');
    const t = document.getElementById('price-display-trimestral');
    const s = document.getElementById('price-display-semestral');
    const a = document.getElementById('price-display-anual');
    if (m) m.textContent = `R$ ${planPrices.mensal},00`;
    if (t) t.textContent = `R$ ${planPrices.trimestral},00`;
    if (s) s.textContent = `R$ ${planPrices.semestral},00`;
    if (a) a.textContent = `R$ ${planPrices.anual},00`;

    const rm = document.getElementById('renew-price-mensal');
    const rt = document.getElementById('renew-price-trimestral');
    const rs = document.getElementById('renew-price-semestral');
    const ra = document.getElementById('renew-price-anual');
    if (rm) rm.textContent = `R$ ${planPrices.mensal},00`;
    if (rt) rt.textContent = `R$ ${planPrices.trimestral},00`;
    if (rs) rs.textContent = `R$ ${planPrices.semestral},00`;
    if (ra) ra.textContent = `R$ ${planPrices.anual},00`;
}

async function initStatesSelects() {
    const filterSelect = document.getElementById('filter-state');
    const partnerSelect = document.getElementById('partner-state');
    try {
        const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
        const estados = await response.json();
        [filterSelect, partnerSelect].forEach(sel => {
            if (sel) {
                sel.innerHTML = '<option value="">Selecione o Estado...</option>';
                estados.forEach(uf => {
                    const opt = document.createElement('option');
                    opt.value = uf.sigla;
                    opt.textContent = `${uf.nome} (${uf.sigla})`;
                    sel.appendChild(opt);
                });
            }
        });
    } catch (error) {
        console.error("Erro ao carregar estados do IBGE:", error);
    }
}

async function onStateFilterChange() {
    const uf = document.getElementById('filter-state').value;
    const citySelect = document.getElementById('filter-city');
    citySelect.innerHTML = '<option value="">Carregando cidades...</option>';
    citySelect.disabled = true;
    if (!uf) {
        citySelect.innerHTML = '<option value="">Selecione primeiro o estado...</option>';
        return;
    }
    try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
        const cidades = await response.json();
        citySelect.innerHTML = '<option value="">Selecione a cidade...</option>';
        cidades.forEach(cidade => {
            const opt = document.createElement('option');
            opt.value = cidade.nome;
            opt.textContent = cidade.nome;
            citySelect.appendChild(opt);
        });
        citySelect.disabled = false;
    } catch (error) {
        citySelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
    }
}

async function onPartnerStateChange() {
    const uf = document.getElementById('partner-state').value;
    const citySelect = document.getElementById('partner-city');
    citySelect.innerHTML = '<option value="">Carregando cidades...</option>';
    citySelect.disabled = true;
    if (!uf) {
        citySelect.innerHTML = '<option value="">Selecione primeiro o estado...</option>';
        return;
    }
    try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
        const cidades = await response.json();
        citySelect.innerHTML = '<option value="">Selecione a cidade...</option>';
        cidades.forEach(cidade => {
            const opt = document.createElement('option');
            opt.value = cidade.nome;
            opt.textContent = cidade.nome;
            citySelect.appendChild(opt);
        });
        citySelect.disabled = false;
    } catch (error) {
        citySelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
    }
}

function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(b => b.classList.remove('active'));
         
    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) targetScreen.classList.add('active');
    document.querySelectorAll(`[data-target="${screenId}"]`).forEach(b => b.classList.add('active'));
    window.scrollTo(0, 0);
    if (screenId === 'history') renderOrderHistory();
    if (screenId === 'partner') renderPlanPricesOnForm();
    if (screenId === 'admin') {
        const adminDashboard = document.getElementById('admin-dashboard');
        if (adminDashboard && !adminDashboard.classList.contains('hidden')) {
            renderAdminCarpentersList();
            loadAdminPlanInputs();
        }
    }
}

function updateAuthDisplay() {
    const container = document.getElementById('user-auth-display');
    if (!container) return;
    if (currentUser) {
        container.innerHTML = `
            <span style="color:var(--brand-dark); font-size:12px; font-weight:700; margin-right:8px;">👤 ${currentUser.email}</span>
            <button class="btn-auth-small btn-logout" onclick="logoutUser()">Sair</button>
        `;
    } else {
        container.innerHTML = `<button class="btn-auth-small" onclick="openAuthModal()">Entrar / Criar Conta</button>`;
    }
}

function openAuthModal() {
    isRegisterMode = false;
    document.getElementById('auth-title').textContent = "Acesse sua Conta";
    document.getElementById('auth-submit-btn').textContent = "Entrar";
    document.getElementById('auth-toggle-btn').textContent = "Criar Nova Conta";
    document.getElementById('auth-form').reset();
    document.getElementById('modal-auth').classList.remove('hidden');
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-title').textContent = isRegisterMode ? "Criar Nova Conta" : "Acesse sua Conta";
    document.getElementById('auth-submit-btn').textContent = isRegisterMode ? "Cadastrar" : "Entrar";
    document.getElementById('auth-toggle-btn').textContent = isRegisterMode ? "Já tenho conta" : "Criar Nova Conta";
}

function handleAuthSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value.trim().toLowerCase();
    const password = document.getElementById('auth-password').value.trim();
    if (password.length < 6) { alert("A senha deve ter no mínimo 6 caracteres."); return; }
    if (isRegisterMode) {
        if (registeredUsers.some(u => u.email === email)) { alert("E-mail já cadastrado!"); return; }
        const newUser = { email, password };
        registeredUsers.push(newUser);
        localStorage.setItem('sos_registered_users', JSON.stringify(registeredUsers));
        currentUser = newUser;
        localStorage.setItem('sos_logged_user_session', JSON.stringify(currentUser));
        alert("Conta criada com sucesso!");
    } else {
        const user = registeredUsers.find(u => u.email === email && u.password === password);
        if (!user) { alert("E-mail ou senha incorretos."); return; }
        currentUser = user;
        localStorage.setItem('sos_logged_user_session', JSON.stringify(currentUser));
        alert("Login efetuado com sucesso!");
    }
    updateAuthDisplay();
    closeModal('modal-auth');
}

function logoutUser() {
    localStorage.removeItem('sos_logged_user_session');
    currentUser = null;
    updateAuthDisplay();
    alert("Sessão encerrada.");
}

function selectProblemCategory(categoryName) {
    if (!currentUser) {
        alert("É necessário entrar na sua conta para pedir um orçamento.");
        openAuthModal();
        return;
    }
    const state = document.getElementById('filter-state').value;
    const city = document.getElementById('filter-city').value;
    if (!state || !city) {
        alert("Selecione primeiro o seu Estado e Cidade acima.");
        document.querySelector('.location-filter-box').scrollIntoView({ behavior: 'smooth' });
        return;
    }
    currentRepairOrder.category = categoryName;
    currentRepairOrder.state = state;
    currentRepairOrder.city = city;
    document.getElementById('selected-category-title').textContent = `Detalhes: ${categoryName} (${city} - ${state})`;
    document.getElementById('repair-details-section').classList.remove('hidden');
    document.getElementById('repair-details-section').scrollIntoView({ behavior: 'smooth' });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

async function handleMediaPreview(event) {
    const fileInput = event.target;
    const previewContainer = document.getElementById('media-preview-container');
    const fileNameSpan = document.getElementById('media-file-name');
    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        if (file.size > 3 * 1024 * 1024) {
            alert("A foto ou vídeo deve ter no máximo 3MB.");
            fileInput.value = '';
            return;
        }
        try {
            currentRepairOrder.mediaDataUrl = await readFileAsDataURL(file);
            currentRepairOrder.mediaType = file.type.startsWith('video') ? 'video' : 'image';
            fileNameSpan.textContent = `📎 Anexado: ${file.name}`;
            previewContainer.classList.remove('hidden');
        } catch (e) {
            alert("Erro ao carregar o arquivo.");
        }
    }
}

function removeAttachedMedia() {
    const fileInput = document.getElementById('repair-media-file');
    const previewContainer = document.getElementById('media-preview-container');
    fileInput.value = '';
    currentRepairOrder.mediaDataUrl = null;
    currentRepairOrder.mediaType = null;
    previewContainer.classList.add('hidden');
    alert("Foto/Vídeo removido com sucesso.");
}

async function proceedToAvailableCarpenters() {
    const neighborhoodInput = document.getElementById('user-neighborhood');
    const qtyInput = document.getElementById('repair-quantity');
    const obsInput = document.getElementById('repair-observation');
    const neighborhood = neighborhoodInput ? neighborhoodInput.value.trim() : '';
    if (!neighborhood) {
        alert("Por favor, informe o seu Bairro/Região.");
        return;
    }
    currentRepairOrder.neighborhood = neighborhood;
    currentRepairOrder.quantity = qtyInput ? qtyInput.value : 1;
    currentRepairOrder.observation = obsInput ? obsInput.value.trim() : '';
    renderApprovedCarpentersToSelect();
    document.getElementById('carpenters-list-section').classList.remove('hidden');
    document.getElementById('carpenters-list-section').scrollIntoView({ behavior: 'smooth' });
}

function renderApprovedCarpentersToSelect() {
    const grid = document.getElementById('carpenters-grid');
    const countBadge = document.getElementById('carpenters-count');
    const noState = document.getElementById('no-carpenters-state');
    carpentersData = JSON.parse(localStorage.getItem('sos_carpenters_aracatuba') || '[]');
    const approvedList = carpentersData.filter(c => c.pago === true && c.state === currentRepairOrder.state && c.city === currentRepairOrder.city);
    grid.innerHTML = '';
    countBadge.textContent = `${approvedList.length} oficinas`;
    if (approvedList.length === 0) {
        noState.classList.remove('hidden');
        return;
    } else {
        noState.classList.add('hidden');
    }
    approvedList.forEach(carpenter => {
        const card = document.createElement('div');
        card.className = 'carpenter-card';
        card.innerHTML = `
            <div class="carpenter-card-body">
                <h3 class="carpenter-name">${carpenter.name}</h3>
                <div class="carpenter-meta">📍 ${carpenter.city} - ${carpenter.state}</div>
                <p class="carpenter-services-tags"><strong>Serviços:</strong> ${carpenter.services}</p>
                <button class="btn btn-wood btn-sm" onclick="sendOrderInternal(${carpenter.id})">Enviar Pedido para Esta Oficina</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function sendOrderInternal(carpenterId) {
    const carpenter = carpentersData.find(c => c.id === carpenterId);
    if (!carpenter) return;
    const newOrder = {
        id: Date.now(),
        clientEmail: currentUser.email,
        carpenterId: carpenter.id,
        carpenterName: carpenter.name,
        carpenterPhone: carpenter.phone,
        category: currentRepairOrder.category,
        quantity: currentRepairOrder.quantity,
        state: currentRepairOrder.state,
        city: currentRepairOrder.city,
        neighborhood: currentRepairOrder.neighborhood,
        observation: currentRepairOrder.observation || 'Nenhuma',
        mediaDataUrl: currentRepairOrder.mediaDataUrl,
        mediaType: currentRepairOrder.mediaType,
        date: new Date().toLocaleDateString('pt-BR'),
        replyPrice: null,
        replyMessage: null,
        status: 'Pendente'
    };
    try {
        internalOrdersData.push(newOrder);
        localStorage.setItem('sos_internal_orders', JSON.stringify(internalOrdersData));
        alert("Pedido enviado com sucesso para a oficina!");
        navigateTo('history');
    } catch (e) {
        alert("O tamanho da mídia excedeu o limite de memória. Tente enviar sem imagem/vídeo.");
    }
}

// CADASTRO DE MARCENEIRO
function handlePartnerSubmit(event) {
    event.preventDefault();
    carpentersData = JSON.parse(localStorage.getItem('sos_carpenters_aracatuba') || '[]');
    const selectedPlanInput = document.querySelector('input[name="selected_plan"]:checked');
    const planName = selectedPlanInput ? selectedPlanInput.value : 'mensal';
    const planValue = planPrices[planName];
    
    const passwordInput = document.getElementById('partner-password') ? document.getElementById('partner-password').value.trim() : '';
    if (!passwordInput) {
        alert("Por favor, crie uma senha para acessar o seu painel.");
        return;
    }

    const newCarpenter = {
        id: Date.now(),
        name: document.getElementById('partner-name').value,
        state: document.getElementById('partner-state').value,
        city: document.getElementById('partner-city').value,
        phone: document.getElementById('partner-phone').value.replace(/\D/g, ''),
        password: passwordInput,
        services: document.getElementById('partner-services').value,
        rawPlanKey: planName,
        planSelected: `${planName.toUpperCase()} (R$ ${planValue},00)`,
        pixTitularName: document.getElementById('partner-pix-name').value,
        pago: false,
        expirationTimestamp: null
    };

    carpentersData.push(newCarpenter);
    localStorage.setItem('sos_carpenters_aracatuba', JSON.stringify(carpentersData));
    document.getElementById('form-partner-register').reset();
    alert("Cadastro enviado! A sua oficina ficará ativa assim que o Administrador aprovar.");
    navigateTo('home');
}

// LOGIN E VERIFICAÇÃO DE NOTIFICAÇÃO / EXPIRAÇÃO
function loginCarpenterPanel() {
    checkAndExpireSubscriptions();
    carpentersData = JSON.parse(localStorage.getItem('sos_carpenters_aracatuba') || '[]');
    const phoneInput = document.getElementById('carpenter-login-phone').value.trim().replace(/\D/g, '');
    const passwordInput = document.getElementById('carpenter-login-password') ? document.getElementById('carpenter-login-password').value.trim() : '';

    const workshop = carpentersData.find(c => c.phone === phoneInput && c.password === passwordInput);
    
    if (!workshop) {
        alert("WhatsApp ou senha incorretos.");
        return;
    }

    // Se o plano venceu ou ainda não foi aprovado
    if (!workshop.pago) {
        tempCarpenterForRenewal = workshop;
        alert("Sua assinatura expirou ou ainda não foi ativada. Escolha um plano para renovar.");
        document.getElementById('carpenter-login-box').classList.add('hidden');
        document.getElementById('carpenter-renew-box').classList.remove('hidden');
        return;
    }

    currentLoggedInCarpenter = workshop;
    document.getElementById('carpenter-login-box').classList.add('hidden');
    document.getElementById('carpenter-renew-box').classList.add('hidden');
    document.getElementById('carpenter-dashboard').classList.remove('hidden');
    document.getElementById('cp-workshop-name').textContent = workshop.name;
    document.getElementById('cp-workshop-location').textContent = `${workshop.city} - ${workshop.state}`;
    
    // VERIFICA SE FALTAM 7 DIAS OU MENOS PARA AVISAR O MARCENEIRO
    checkSubscriptionWarningNotice(workshop);

    renderCarpenterOrders();
}

function checkSubscriptionWarningNotice(workshop) {
    const alertBox = document.getElementById('carpenter-subscription-alert');
    if (!alertBox) return;

    if (workshop.expirationTimestamp) {
        const now = new Date().getTime();
        const diffMs = workshop.expirationTimestamp - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 7 && diffDays > 0) {
            alertBox.classList.remove('hidden');
            alertBox.innerHTML = `
                ⚠️ <strong>Atenção:</strong> Sua assinatura vence em <strong>${diffDays} dia(s)</strong>! 
                Renove com antecedência para não ter seu perfil suspenso.
            `;
        } else {
            alertBox.classList.add('hidden');
        }
    } else {
        alertBox.classList.add('hidden');
    }
}

function submitRenovationRequest() {
    const selectedPlanInput = document.querySelector('input[name="renew_plan"]:checked');
    const planName = selectedPlanInput ? selectedPlanInput.value : 'mensal';
    const planValue = planPrices[planName];
    const pixTitular = document.getElementById('renew-pix-name').value.trim();

    if (!pixTitular) {
        alert("Por favor, informe o nome do titular do Pix enviado.");
        return;
    }

    if (tempCarpenterForRenewal) {
        tempCarpenterForRenewal.rawPlanKey = planName;
        tempCarpenterForRenewal.planSelected = `${planName.toUpperCase()} (R$ ${planValue},00)`;
        tempCarpenterForRenewal.pixTitularName = pixTitular;
        
        localStorage.setItem('sos_carpenters_aracatuba', JSON.stringify(carpentersData));
        alert("Solicitação de renovação enviada! O Administrador irá validar o Pix e renovar o seu acesso.");
        cancelRenovationView();
    }
}

function cancelRenovationView() {
    tempCarpenterForRenewal = null;
    document.getElementById('carpenter-renew-box').classList.add('hidden');
    document.getElementById('carpenter-login-box').classList.remove('hidden');
}

function copyPixKeyRenew() {
    const input = document.getElementById('display-admin-pix-key-renew');
    input.select();
    navigator.clipboard.writeText(input.value);
    alert("Chave Pix copiada!");
}

function logoutCarpenterPanel() {
    currentLoggedInCarpenter = null;
    document.getElementById('carpenter-dashboard').classList.add('hidden');
    document.getElementById('carpenter-login-box').classList.remove('hidden');
    document.getElementById('carpenter-login-phone').value = '';
    if (document.getElementById('carpenter-login-password')) {
        document.getElementById('carpenter-login-password').value = '';
    }
}

function renderCarpenterOrders() {
    const container = document.getElementById('carpenter-orders-list');
    container.innerHTML = '';
    internalOrdersData = JSON.parse(localStorage.getItem('sos_internal_orders') || '[]');
    const myOrders = internalOrdersData.filter(o => o.carpenterId === currentLoggedInCarpenter.id);
    if (myOrders.length === 0) {
        container.innerHTML = '<p style="font-size:13px; color:var(--text-muted);">Nenhum pedido recebido no momento.</p>';
        return;
    }
    myOrders.forEach(order => {
        let mediaHtml = '';
        if (order.mediaDataUrl) {
            if (order.mediaType === 'video') {
                mediaHtml = `<div style="margin-top:10px;"><video src="${order.mediaDataUrl}" controls style="max-width:100%; max-height:200px; border-radius:6px;"></video></div>`;
            } else {
                mediaHtml = `<div style="margin-top:10px;"><img src="${order.mediaDataUrl}" style="max-width:100%; max-height:200px; border-radius:6px; object-fit:cover;"></div>`;
            }
        }
        let badgeClass = 'status-pending';
        if (order.status === 'Respondido') badgeClass = 'status-approved';
        if (order.status === 'Recusado') badgeClass = 'status-rejected';
        const div = document.createElement('div');
        div.className = 'order-item-card';
        div.innerHTML = `
            <div>
                <strong>Cliente:</strong> ${order.clientEmail}<br>
                <strong>Bairro/Região:</strong> ${order.neighborhood || 'Não informado'}<br>
                <strong>Serviço:</strong> ${order.category} (${order.quantity} un.)<br>
                <strong>Obs:</strong> ${order.observation}<br>
                ${mediaHtml}
                <small style="display:block; margin-top:6px;">Data: ${order.date}</small>
                <div style="margin-top:8px;">
                    <strong>Status:</strong> <span class="status-badge ${badgeClass}">${order.status}</span>
                </div>
                ${order.replyPrice ? `<div style="background:#FAF8F5; padding:8px; margin-top:8px; border-radius:6px; font-size:12px;"><strong>Sua Resposta:</strong> ${order.replyPrice} - ${order.replyMessage}</div>` : ''}
            </div>
            <div style="margin-top:12px; display:flex; gap:8px;">
                <button class="btn btn-wood btn-sm" onclick="openReplyModal(${order.id})">${order.replyPrice ? 'Editar Resposta' : 'Responder Orçamento'}</button>
                <button class="btn btn-danger btn-sm" onclick="rejectOrder(${order.id})">Recusar Pedido</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function rejectOrder(orderId) {
    if (confirm("Deseja recusar este pedido? O cliente será notificado.")) {
        internalOrdersData = JSON.parse(localStorage.getItem('sos_internal_orders') || '[]');
        const order = internalOrdersData.find(o => o.id === orderId);
        if (order) {
            order.status = 'Recusado';
            order.replyPrice = null;
            order.replyMessage = 'Indisponível no momento';
            localStorage.setItem('sos_internal_orders', JSON.stringify(internalOrdersData));
            renderCarpenterOrders();
            alert("Pedido recusado.");
        }
    }
}

function openReplyModal(orderId) {
    activeOrderIdForReply = orderId;
    const order = internalOrdersData.find(o => o.id === orderId);
    document.getElementById('reply-modal-client-info').textContent = `Cliente: ${order.clientEmail} | Bairro: ${order.neighborhood}`;
    document.getElementById('reply-price').value = order.replyPrice || '';
    document.getElementById('reply-message').value = order.replyMessage || '';
    document.getElementById('modal-reply-order').classList.remove('hidden');
}

function handleSendReply(event) {
    event.preventDefault();
    const price = document.getElementById('reply-price').value;
    const msg = document.getElementById('reply-message').value;
    const order = internalOrdersData.find(o => o.id === activeOrderIdForReply);
    if (order) {
        order.replyPrice = price;
        order.replyMessage = msg;
        order.status = 'Respondido';
        localStorage.setItem('sos_internal_orders', JSON.stringify(internalOrdersData));
        closeModal('modal-reply-order');
        renderCarpenterOrders();
        alert("Resposta enviada com sucesso ao cliente!");
    }
}

function openWhatsAppDirect(phone, carpenterName) {
    if (!phone) {
        alert("Número de WhatsApp não disponível.");
        return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const text = encodeURIComponent(`Olá ${carpenterName}, vi seu orçamento pelo SOS Marceneiro e gostaria de fechar o serviço!`);
    window.open(`https://wa.me/55${cleanPhone}?text=${text}`, '_blank');
}

function renderOrderHistory() {
    const container = document.getElementById('history-list-container');
    if (!container) return;
    if (!currentUser) {
        container.innerHTML = `<p style="font-size:13px; color:var(--text-muted);">Faça login para ver seus pedidos.</p>`;
        return;
    }
    internalOrdersData = JSON.parse(localStorage.getItem('sos_internal_orders') || '[]');
    const myOrders = internalOrdersData.filter(o => o.clientEmail === currentUser.email);
    container.innerHTML = '';
    if (myOrders.length === 0) {
        container.innerHTML = `<p style="font-size:13px; color:var(--text-muted);">Você ainda não enviou nenhum pedido pelo app.</p>`;
        return;
    }
    myOrders.forEach(item => {
        let mediaHtml = '';
        if (item.mediaDataUrl) {
            if (item.mediaType === 'video') {
                mediaHtml = `<div style="margin-top:8px;"><video src="${item.mediaDataUrl}" controls style="max-width:100%; max-height:150px; border-radius:6px;"></video></div>`;
            } else {
                mediaHtml = `<div style="margin-top:8px;"><img src="${item.mediaDataUrl}" style="max-width:100%; max-height:150px; border-radius:6px; object-fit:cover;"></div>`;
            }
        }
        let statusText = `<span class="status-badge status-pending">Pendente</span>`;
        let responseBox = '<p style="font-size:12px; color:#B9770E; margin-top:6px;">Aguardando o marceneiro responder...</p>';
        if (item.status === 'Respondido') {
            statusText = `<span class="status-badge status-approved">Respondido</span>`;
            responseBox = `
                <div style="background:#F0FDF4; border:1px solid #10B981; padding:12px; margin-top:10px; border-radius:8px;">
                    <strong>💬 Resposta do Marceneiro:</strong><br>
                    <strong>Valor:</strong> ${item.replyPrice}<br>
                    <strong>Detalhes:</strong> ${item.replyMessage}<br>
                    <div style="margin-top: 12px;">
                        <button class="btn btn-wood btn-sm" onclick="openWhatsAppDirect('${item.carpenterPhone}', '${item.carpenterName}')" style="background:#10B981; color:#fff; font-weight:700;">
                            📲 Ir direto para o WhatsApp
                        </button>
                    </div>
                </div>
            `;
        } else if (item.status === 'Recusado') {
            statusText = `<span class="status-badge status-rejected">Indisponível</span>`;
            responseBox = `
                <div style="background:#FEF2F2; border:1px solid #EF4444; padding:10px; margin-top:10px; border-radius:8px; color:#991B1B; font-size:12px;">
                    ❌ <strong>O profissional não está disponível para este serviço/região no momento.</strong>
                </div>
            `;
        }
        const div = document.createElement('div');
        div.className = 'order-item-card';
        div.innerHTML = `
            <div>
                <h4>Oficina: ${item.carpenterName}</h4>
                <p><strong>Serviço:</strong> ${item.category} (${item.quantity} un.) - Bairro: ${item.neighborhood || 'N/A'}</p>
                ${mediaHtml}
                <small style="display:block; margin-top:6px;">Enviado em: ${item.date}</small>
                <div style="margin-top:8px;">
                    <strong>Status:</strong> ${statusText}
                </div>
                ${responseBox}
            </div>
        `;
        container.appendChild(div);
    });
}

// LOGIN ADMIN
function loginAdmin() {
    const pass = document.getElementById('admin-password-input').value;
    if (pass === 'FellipeBeatriz02') {
        localStorage.setItem('sos_admin_logged_device', 'true');
        document.getElementById('admin-login-box').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        renderAdminCarpentersList();
        loadAdminPlanInputs();
        alert("Admin autenticado com sucesso!");
    } else {
        alert("Senha incorreta.");
    }
}

function checkAdminAutoLogin() {
    if (localStorage.getItem('sos_admin_logged_device') === 'true') {
        const loginBox = document.getElementById('admin-login-box');
        const dash = document.getElementById('admin-dashboard');
        if (loginBox && dash) {
            loginBox.classList.add('hidden');
            dash.classList.remove('hidden');
            renderAdminCarpentersList();
            loadAdminPlanInputs();
        }
    }
}

function loadAdminPlanInputs() {
    document.getElementById('admin-plan-mensal').value = planPrices.mensal;
    document.getElementById('admin-plan-trimestral').value = planPrices.trimestral;
    document.getElementById('admin-plan-semestral').value = planPrices.semestral;
    document.getElementById('admin-plan-anual').value = planPrices.anual;
}

function savePlanPrices() {
    planPrices.mensal = document.getElementById('admin-plan-mensal').value.trim() || '15';
    planPrices.trimestral = document.getElementById('admin-plan-trimestral').value.trim() || '40';
    planPrices.semestral = document.getElementById('admin-plan-semestral').value.trim() || '75';
    planPrices.anual = document.getElementById('admin-plan-anual').value.trim() || '100';
    localStorage.setItem('sos_plan_prices', JSON.stringify(planPrices));
    renderPlanPricesOnForm();
    alert("Valores dos planos atualizados com sucesso!");
}

function renderAdminCarpentersList() {
    const container = document.getElementById('admin-carpenters-list');
    if(!container) return;
    carpentersData = JSON.parse(localStorage.getItem('sos_carpenters_aracatuba') || '[]');
    container.innerHTML = '';
    if (carpentersData.length === 0) {
         container.innerHTML = '<p style="font-size:13px; color:#666;">Nenhum marceneiro cadastrado ainda.</p>';
         return;
     }

    const now = new Date().getTime();

    carpentersData.forEach(carpenter => {
        let expirationText = 'N/A';
        if (carpenter.expirationTimestamp) {
            expirationText = new Date(carpenter.expirationTimestamp).toLocaleDateString('pt-BR');
        }

        const div = document.createElement('div');
        div.className = 'admin-item-row';
        div.innerHTML = `
            <div>
                <strong>${carpenter.name}</strong> (${carpenter.city} - ${carpenter.state})<br>
                <small>📦 Plano: <strong>${carpenter.planSelected || 'Mensal'}</strong> | Pix: ${carpenter.pixTitularName} | Tel: ${carpenter.phone}</small><br>
                <small>⌛ Validade da Assinatura: <strong>${expirationText}</strong></small><br>
                <span class="status-badge ${carpenter.pago ? 'status-approved' : 'status-pending'}">${carpenter.pago ? 'Ativo' : 'Pendente / Vencido'}</span>
            </div>
            <div style="display:flex; gap:6px;">
                ${!carpenter.pago ? `<button class="btn btn-wood btn-sm" onclick="approveCarpenter(${carpenter.id})">Aprovar / Renovar</button>` : `<button class="btn btn-danger btn-sm" onclick="deactivateCarpenter(${carpenter.id})">Bloquear</button>`}
            </div>
        `;
        container.appendChild(div);
    });
}

// APROVAÇÃO E CÁLCULO DA DATA DE EXPIRAÇÃO
function approveCarpenter(id) {
    carpentersData = JSON.parse(localStorage.getItem('sos_carpenters_aracatuba') || '[]');
    const c = carpentersData.find(x => x.id === id);
    if (c) {
        c.pago = true;
        c.expired = false;
        
        // CALCULA O TEMPO DE ACORDO COM O PLANO ESCOLHIDO
        const now = new Date();
        let daysToAdd = 30; // Padrão Mensal
        if (c.rawPlanKey === 'trimestral') daysToAdd = 90;
        if (c.rawPlanKey === 'semestral') daysToAdd = 180;
        if (c.rawPlanKey === 'anual') daysToAdd = 365;

        now.setDate(now.getDate() + daysToAdd);
        c.expirationTimestamp = now.getTime();

        localStorage.setItem('sos_carpenters_aracatuba', JSON.stringify(carpentersData));
        renderAdminCarpentersList();
        alert(`Oficina aprovada com sucesso! Válido por ${daysToAdd} dias (até ${now.toLocaleDateString('pt-BR')}).`);
     }
}

function deactivateCarpenter(id) {
    carpentersData = JSON.parse(localStorage.getItem('sos_carpenters_aracatuba') || '[]');
    const c = carpentersData.find(x => x.id === id);
    if (c) {
         c.pago = false;
         localStorage.setItem('sos_carpenters_aracatuba', JSON.stringify(carpentersData));
         renderAdminCarpentersList();
         alert("Oficina desativada.");
     }
}

function applyAppBranding() {
    const brandTitleEl = document.getElementById('header-brand-title');
    const brandSubEl = document.getElementById('header-brand-subtitle');
    const logoContainerEl = document.getElementById('header-logo-container');
    const browserTitleEl = document.getElementById('page-browser-title');
    if (brandTitleEl) brandTitleEl.textContent = appBranding.name;
    if (brandSubEl) brandSubEl.textContent = appBranding.subtitle;
    if (browserTitleEl) browserTitleEl.textContent = `${appBranding.name} — ${appBranding.subtitle}`;
    if (logoContainerEl) {
        if (appBranding.logoType === 'image' && appBranding.logoValue) {
            logoContainerEl.innerHTML = `<img src="${appBranding.logoValue}" alt="Logo">`;
        } else {
            logoContainerEl.innerHTML = `<span id="header-logo-icon">${appBranding.logoValue || '🪚'}</span>`;
        }
    }
    const inputName = document.getElementById('setting-brand-name');
    const inputSub = document.getElementById('setting-brand-subtitle');
    if (inputName) inputName.value = appBranding.name;
    if (inputSub) inputSub.value = appBranding.subtitle;
}

async function saveAppBrandingSettings() {
    const name = document.getElementById('setting-brand-name').value.trim();
    const subtitle = document.getElementById('setting-brand-subtitle').value.trim();
    const logoFileInput = document.getElementById('setting-logo-file');
    if (!name) { alert("Preencha o nome do aplicativo."); return; }
    appBranding.name = name;
    appBranding.subtitle = subtitle;
    if (logoFileInput && logoFileInput.files && logoFileInput.files[0]) {
        const file = logoFileInput.files[0];
        if (file.size > 2 * 1024 * 1024) { alert("A imagem da logo deve ter no máximo 2MB."); return; }
        try {
            appBranding.logoType = 'image';
            appBranding.logoValue = await readFileAsDataURL(file);
        } catch (e) {
            alert("Erro ao carregar a imagem.");
            return;
        }
    }
    localStorage.setItem('sos_app_branding', JSON.stringify(appBranding));
    applyAppBranding();
    alert("Alterações salvas!");
}

function resetToEmojiLogo() {
    appBranding.logoType = 'emoji';
    appBranding.logoValue = '🪚';
    localStorage.setItem('sos_app_branding', JSON.stringify(appBranding));
    applyAppBranding();
    alert("Logo restaurada para o ícone padrão.");
}

function clearAllTestAccounts() {
    if (confirm("Deseja apagar todos os dados de testes e utilizadores registrados?")) {
        localStorage.clear();
        registeredUsers = [];
        currentUser = null;
        carpentersData = [];
        internalOrdersData = [];
        location.reload();
    }
}

function updateAdminPixDisplay() {
    const el1 = document.getElementById('display-admin-pix-key');
    const el2 = document.getElementById('admin-pix-setting');
    const el3 = document.getElementById('display-admin-pix-key-renew');
    if(el1) el1.value = adminPixKey;
    if(el2) el2.value = adminPixKey;
    if(el3) el3.value = adminPixKey;
}

function saveAdminPixKey() {
    const newKey = document.getElementById('admin-pix-setting').value.trim();
    if (!newKey) return;
    adminPixKey = newKey;
    localStorage.setItem('sos_admin_pix_key', adminPixKey);
    updateAdminPixDisplay();
    alert("Chave Pix atualizada!");
}

function toggleAdminPasswordVisibility() {
    const input = document.getElementById('admin-password-input');
    input.type = input.type === "password" ? "text" : "password";
}

function copyPixKey() {
    const input = document.getElementById('display-admin-pix-key');
    input.select();
    navigator.clipboard.writeText(input.value);
    alert("Chave Pix copiada!");
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function checkOfflineStatus() {
    const banner = document.getElementById('offline-banner');
    if (banner) {
        if (!navigator.onLine) banner.classList.remove('hidden');
        else banner.classList.add('hidden');
    }
}