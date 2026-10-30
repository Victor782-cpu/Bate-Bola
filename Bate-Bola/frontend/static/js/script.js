const API_URL = "http://127.0.0.1:5001";

// Inicialização imediata do tema para evitar qualquer flicker
(function () {
    try {
        const temaSalvo = localStorage.getItem("batebola_theme");
        const prefereEscuro = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (temaSalvo === "dark" || (!temaSalvo && prefereEscuro)) {
            document.documentElement.setAttribute("data-theme", "dark");
        }
    } catch (e) {}
})();

document.addEventListener("DOMContentLoaded", () => {
    configurarModoEscuro();
    configurarAvaliacaoSite();

    const usuarioLogado = obterUsuarioLogado();
    const path = window.location.pathname.toLowerCase();

    const paginasRestritas = ["perfil.html", "historico.html"];
    const ehPaginaRestrita = paginasRestritas.some(pagina => path.endsWith(pagina));

    if (!usuarioLogado && ehPaginaRestrita) {
        window.location.href = "login.html";
        return;
    }

    if (usuarioLogado && path.endsWith("login.html")) {
        window.location.href = "perfil.html";
        return;
    }

    const menuButtons = document.querySelectorAll(".menu-toggle");
    const sidebar = document.querySelector(".sidebar");

    if (sidebar && menuButtons.length > 0) {
        menuButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                sidebar.classList.toggle("open");
            });
        });
    }

    const containerPartidas = document.getElementById("container-partidas");
    if (containerPartidas) {
        const urlParams = new URLSearchParams(window.location.search);
        const esporteURL = urlParams.get("esporte") || "Todos";

        marcarPillAtiva(esporteURL);
        carregarPartidas(esporteURL);
        configurarFiltros();
    }

    const containerHistorico = document.getElementById("container-historico");
    if (containerHistorico && usuarioLogado) {
        carregarHistoricoPartidas(usuarioLogado);
    }

    if (usuarioLogado) {
        carregarPerfil(usuarioLogado.id);
    }

    configurarAvatarAnonimo();
    configurarAcoesGlobais();
    configurarAuth();
    configurarLinksAlternanciaAuth();
    configurarModalAvaliacao();

    if (typeof configurarModal === "function") {
        configurarModal();
    }

    if (document.getElementById("modal-editar-perfil")) {
        configurarModalEditarPerfil(usuarioLogado);
    }
});

function configurarAvaliacaoSite() {
    const chaveAvaliacao = "avaliacao_site_batebola";
    let avaliacoes = [];

    try {
        const dadosSalvos = JSON.parse(localStorage.getItem(chaveAvaliacao) || "null");
        if (Array.isArray(dadosSalvos?.avaliacoes)) {
            avaliacoes = dadosSalvos.avaliacoes.filter(avaliacao =>
                Number.isInteger(avaliacao.estrelas) &&
                avaliacao.estrelas >= 1 &&
                avaliacao.estrelas <= 5
            ).slice(0, 3);
        } else if (Number.isInteger(dadosSalvos?.estrelas) &&
                   dadosSalvos.estrelas >= 1 &&
                   dadosSalvos.estrelas <= 5) {
            avaliacoes = [{
                estrelas: dadosSalvos.estrelas,
                enviadaEm: dadosSalvos.enviadaEm
            }];
        }
    } catch (error) {
        console.error("Não foi possível carregar as avaliações salvas:", error);
    }

    const widget = document.createElement("section");
    widget.className = "site-rating-widget";
    widget.setAttribute("aria-label", "Avaliação do site");
    widget.innerHTML = `
        <div class="site-rating-panel" id="site-rating-panel" aria-hidden="true">
            <button class="site-rating-close" type="button" aria-label="Fechar avaliação">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <h2>Avalie sua experiência</h2>
            <p>Como foi sua experiência com o BateBola?</p>
            <div class="site-rating-stars" role="group" aria-label="Escolha uma nota de 1 a 5 estrelas">
                ${Array.from({ length: 5 }, (_, index) => `
                    <button type="button" class="site-rating-star" data-rating="${index + 1}"
                            aria-label="${index + 1} ${index === 0 ? "estrela" : "estrelas"}" aria-pressed="false">
                        <i class="fa-regular fa-star" aria-hidden="true"></i>
                    </button>
                `).join("")}
            </div>
            <p class="site-rating-error" role="alert" hidden></p>
            <button class="site-rating-submit" type="button" disabled>Enviar avaliação</button>
        </div>
        <div class="site-rating-status"></div>
    `;
    document.body.appendChild(widget);

    const painel = widget.querySelector(".site-rating-panel");
    const botaoFechar = widget.querySelector(".site-rating-close");
    const botaoEnviar = widget.querySelector(".site-rating-submit");
    const mensagemErro = widget.querySelector(".site-rating-error");
    let notaSelecionada = 0;
    let timerMensagem;
    let timerRemocaoMensagem;

    const mostrarToastAvaliacao = (estrelas) => {
        const estrelinhas = "⭐".repeat(Math.min(estrelas, 5));
        const toast = document.createElement("div");
        toast.className = "site-rating-toast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.innerHTML = `
            <div class="site-rating-toast-icon">
                <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
            </div>
            <div class="site-rating-toast-content">
                <h4>Obrigado pela avaliação! ${estrelinhas}</h4>
                <p>Sua opinião nos ajuda a melhorar o BateBola.</p>
            </div>
        `;
        document.body.appendChild(toast);
        void toast.offsetWidth;
        toast.classList.add("is-visible");
        setTimeout(() => {
            toast.classList.add("is-leaving");
            toast.classList.remove("is-visible");
            setTimeout(() => toast.remove(), 450);
        }, 3500);
    };

    const renderizarStatus = () => {
        window.clearTimeout(timerMensagem);
        window.clearTimeout(timerRemocaoMensagem);
        const status = widget.querySelector(".site-rating-status");
        if (avaliacoes.length === 0) {
            widget.style.display = "";
            status.innerHTML = `
                <button class="btn-primary site-rating-trigger" type="button"
                        aria-expanded="false" aria-controls="site-rating-panel">
                    <i class="fa-solid fa-star" aria-hidden="true"></i> Avalie-nos
                </button>
            `;
        } else {
            widget.style.display = "none";
        }
    };

    const fecharPainel = () => {
        widget.classList.remove("is-open");
        const botaoAbrir = widget.querySelector(".site-rating-trigger, .site-rating-again");
        if (botaoAbrir) botaoAbrir.setAttribute("aria-expanded", "false");
        painel.setAttribute("aria-hidden", "true");
    };

    widget.addEventListener("click", event => {
        const botaoAbrir = event.target.closest(".site-rating-trigger, .site-rating-again");
        if (!botaoAbrir) return;

        widget.classList.add("is-open");
        botaoAbrir.setAttribute("aria-expanded", "true");
        painel.setAttribute("aria-hidden", "false");
        notaSelecionada = 0;
        widget.querySelectorAll(".site-rating-star").forEach(estrela => {
            estrela.classList.remove("is-selected");
            estrela.setAttribute("aria-pressed", "false");
            estrela.querySelector("i").className = "fa-regular fa-star";
        });
        botaoEnviar.disabled = true;
        mensagemErro.hidden = true;
        widget.querySelector(".site-rating-star").focus();
    });

    botaoFechar.addEventListener("click", fecharPainel);

    widget.querySelectorAll(".site-rating-star").forEach(botao => {
        botao.addEventListener("click", () => {
            notaSelecionada = Number(botao.dataset.rating);
            widget.querySelectorAll(".site-rating-star").forEach(estrela => {
                const selecionada = Number(estrela.dataset.rating) <= notaSelecionada;
                estrela.classList.toggle("is-selected", selecionada);
                estrela.setAttribute("aria-pressed", String(Number(estrela.dataset.rating) === notaSelecionada));
                estrela.querySelector("i").className = `${selecionada ? "fa-solid" : "fa-regular"} fa-star`;
            });
            botaoEnviar.disabled = false;
            mensagemErro.hidden = true;
        });
    });

    botaoEnviar.addEventListener("click", () => {
        if (notaSelecionada < 1 || notaSelecionada > 5) return;
        if (avaliacoes.length >= 3) {
            fecharPainel();
            renderizarStatus();
            return;
        }

        const novasAvaliacoes = [...avaliacoes, {
            estrelas: notaSelecionada,
            enviadaEm: new Date().toISOString()
        }];

        try {
            localStorage.setItem(chaveAvaliacao, JSON.stringify({ avaliacoes: novasAvaliacoes }));
        } catch (error) {
            console.error("Não foi possível salvar a avaliação:", error);
            mensagemErro.textContent = "Não foi possível salvar sua avaliação. Tente novamente.";
            mensagemErro.hidden = false;
            return;
        }

        avaliacoes = novasAvaliacoes;
        fecharPainel();
        renderizarStatus();
        mostrarToastAvaliacao(notaSelecionada);
    });

    renderizarStatus();
}

document.addEventListener("click", (e) => {
    const btnLogout = e.target.closest("#btn-logout, .btn-logout, .fa-right-from-bracket, .fa-sign-out-alt");

    if (btnLogout) {
        e.preventDefault();
        fazerLogout();
    }
});

async function fazerLogout() {
    try {
        await fetch(`${API_URL}/logout`, { method: "POST" });
    } catch (e) {
        console.warn("Aviso no logout na API:", e);
    } finally {
        localStorage.removeItem("usuario_batebola");
        sessionStorage.clear();
        window.location.href = "login.html";
    }
}

function configurarAvatarAnonimo() {
    const avatarContainer = document.querySelector(".avatar-container");
    if (avatarContainer && !avatarContainer.querySelector("img") && !avatarContainer.querySelector("i")) {
        avatarContainer.innerHTML = `<i class="fa-solid fa-user-large avatar-placeholder"></i>`;
    }
}

function obterUsuarioLogado() {
    try {
        const item = localStorage.getItem("usuario_batebola");
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.error("Erro ao ler localStorage:", e);
        return null;
    }
}

function selecionarEsporte(esporte) {
    window.location.href = `partidas.html?esporte=${encodeURIComponent(esporte)}`;
}

function configurarAcoesGlobais() {
    // Delegação de eventos global para garantir que o botão Excluir Conta funcione independentemente de quando for carregado
    document.addEventListener("click", (e) => {
        const btnDeletar = e.target.closest("#btn-deletar-perfil, .btn-deletar-perfil");
        if (btnDeletar) {
            e.preventDefault();
            const usuarioLogado = obterUsuarioLogado();
            if (usuarioLogado && usuarioLogado.id) {
                deletarPerfil(usuarioLogado.id);
            } else {
                alert("Sessão inválida. Por favor, faça login novamente.");
            }
        }
    });
}

function configurarLinksAlternanciaAuth() {
    const linkCadastro = document.getElementById("btn-mudar-cadastro") || document.getElementById("link-ir-cadastro");
    const linkLogin = document.getElementById("btn-mudar-login") || document.getElementById("link-ir-login");

    if (linkCadastro) {
        linkCadastro.addEventListener("click", (e) => {
            e.preventDefault();
            alternarAuthForms('cadastro');
        });
    }

    if (linkLogin) {
        linkLogin.addEventListener("click", (e) => {
            e.preventDefault();
            alternarAuthForms('login');
        });
    }
}

function alternarAuthForms(tipo) {
    const formLogin = document.getElementById("loginForm") || document.getElementById("form-login");
    const formCadastro = document.getElementById("cadastroForm") || document.getElementById("form-cadastro");

    if (!formLogin || !formCadastro) return;

    if (tipo === 'cadastro') {
        formLogin.style.display = 'none';
        formCadastro.style.display = 'flex';
    } else {
        formCadastro.style.display = 'none';
        formLogin.style.display = 'flex';
    }
}

async function carregarPerfil(usuarioId) {
    try {
        const response = await fetch(`${API_URL}/perfil/${usuarioId}`);
        if (!response.ok) throw new Error("Erro ao buscar perfil");

        const usuario = await response.json();

        const elNome = document.getElementById("user-display-name") || document.querySelector(".user-name-row h2");
        const elCidadeTexto = document.querySelector(".location span");
        const elSobre = document.getElementById("user-about-text") || document.querySelector(".about-section p");
        const elPartidas = document.getElementById("stat-partidas");
        const elPresencas = document.getElementById("stat-presencas");
        const elFaltas = document.getElementById("stat-faltas");
        const elNotaMedia = document.getElementById("stat-nota-media");
        const avatarContainer = document.querySelector(".avatar-container");
        const containerEsportes = document.querySelector(".sports-tags");

        if (elNome) elNome.textContent = usuario.nome || "Usuário";
        if (elCidadeTexto) elCidadeTexto.textContent = usuario.cidade || "Belo Horizonte - MG";
        if (elSobre) elSobre.textContent = usuario.sobre || "Nenhum detalhe informado sobre o jogador.";
        if (elPartidas) elPartidas.textContent = usuario.partidas_jogadas ?? 0;
        if (elPresencas) elPresencas.textContent = usuario.presencas ?? 0;
        if (elFaltas) elFaltas.textContent = usuario.faltas ?? 0;

        // Atualizar foto de perfil (se houver Base64/URL cadastrada)
        if (avatarContainer) {
            if (usuario.foto_perfil) {
                avatarContainer.innerHTML = `<img src="${usuario.foto_perfil}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            } else {
                avatarContainer.innerHTML = `<i class="fa-solid fa-user-large avatar-placeholder"></i>`;
            }
        }

        // Atualizar esportes favoritos dinamicamente
        if (containerEsportes && usuario.esportes_favoritos) {
            containerEsportes.innerHTML = "";
            const esportesArray = usuario.esportes_favoritos.split(",").map(e => e.trim());
            esportesArray.forEach(esporte => {
                if (esporte) {
                    containerEsportes.innerHTML += `<span class="sport-tag"><i class="fa-solid fa-medal"></i> ${esporte}</span>`;
                }
            });
        }

        if (elNotaMedia) {
            const nota = usuario.nota_media ? parseFloat(usuario.nota_media).toFixed(1) : "5.0";
            elNotaMedia.innerHTML = `<i class="fa-solid fa-star" style="color: #f59e0b;"></i> ${nota} / 5.0`;
        }

    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
    }
}

function configurarModalEditarPerfil(usuarioLogado) {
    const modal = document.getElementById("modal-editar-perfil");
    const btnAbrir = document.getElementById("btn-abrir-editar-perfil") || document.querySelector(".btn-edit-profile");
    const btnCancelar = document.getElementById("btn-cancelar-editar-perfil");
    const form = document.getElementById("form-editar-perfil");

    if (!modal || !btnAbrir) return;

    btnAbrir.onclick = async () => {
        try {
            const response = await fetch(`${API_URL}/perfil/${usuarioLogado.id}`);
            if (response.ok) {
                const usuario = await response.json();
                if (document.getElementById("input-edit-nome")) document.getElementById("input-edit-nome").value = usuario.nome || "";
                if (document.getElementById("input-edit-cidade")) document.getElementById("input-edit-cidade").value = usuario.cidade || "";
                if (document.getElementById("input-edit-esportes")) document.getElementById("input-edit-esportes").value = usuario.esportes_favoritos || "";
                if (document.getElementById("input-edit-sobre")) document.getElementById("input-edit-sobre").value = usuario.sobre || "";
            }
        } catch (e) {
            console.error("Erro ao carregar dados para edição", e);
        }

        modal.classList.add("active");
    };

    const fecharModal = () => {
        modal.classList.remove("active");
    };

    if (btnCancelar) btnCancelar.onclick = fecharModal;

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();

            const inputFoto = document.getElementById("input-edit-foto");
            let base64Foto = null;

            if (inputFoto && inputFoto.files && inputFoto.files[0]) {
                const reader = new FileReader();
                base64Foto = await new Promise((resolve) => {
                    reader.onload = (uploadEvent) => resolve(uploadEvent.target.result);
                    reader.readAsDataURL(inputFoto.files[0]);
                });
            }

            const dadosAtualizados = {
                nome: document.getElementById("input-edit-nome")?.value || "",
                cidade: document.getElementById("input-edit-cidade")?.value || "",
                esportes_favoritos: document.getElementById("input-edit-esportes")?.value || "",
                sobre: document.getElementById("input-edit-sobre")?.value || ""
            };

            if (base64Foto) {
                dadosAtualizados.foto_perfil = base64Foto;
            }

            if (usuarioLogado) {
                try {
                    const response = await fetch(`${API_URL}/perfil/${usuarioLogado.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(dadosAtualizados)
                    });

                    if (response.ok) {
                        const usuarioAtualizado = await response.json();
                        
                        // Atualizar o LocalStorage com o novo nome
                        const sessaoLocal = obterUsuarioLogado();
                        if (sessaoLocal) {
                            sessaoLocal.nome = usuarioAtualizado.nome || dadosAtualizados.nome;
                            localStorage.setItem("usuario_batebola", JSON.stringify(sessaoLocal));
                        }

                        // Recarregar o perfil na tela imediatamente
                        await carregarPerfil(usuarioLogado.id);
                        alert("Perfil atualizado com sucesso!");
                    } else {
                        alert("Erro ao atualizar o perfil no servidor.");
                    }
                } catch (error) {
                    console.error("Erro na API ao atualizar perfil:", error);
                    alert("Erro de conexão ao tentar atualizar.");
                }
            }

            fecharModal();
        };
    }
}

async function deletarPerfil(usuarioId) {
    if (!confirm("Tem certeza que deseja excluir permanentemente sua conta?")) return;

    try {
        const response = await fetch(`${API_URL}/perfil/${usuarioId}`, { method: "DELETE" });
        if (response.ok) {
            alert("Sua conta foi excluída com sucesso.");
            localStorage.removeItem("usuario_batebola");
            sessionStorage.clear();
            window.location.href = "login.html";
        } else {
            const erro = await response.json();
            alert(erro.erro || "Erro ao excluir conta.");
        }
    } catch (error) {
        console.error("Erro na exclusão:", error);
        alert("Erro de conexão ao tentar excluir a conta.");
    }
}

function configurarAuth() {
    const formLogin = document.getElementById("loginForm") || document.getElementById("form-login");
    const formCadastro = document.getElementById("cadastroForm") || document.getElementById("form-cadastro");

    if (formLogin) {
        formLogin.onsubmit = async (e) => {
            e.preventDefault();
            const email = (document.getElementById("email") || document.getElementById("login-email"))?.value;
            const senha = (document.getElementById("senha") || document.getElementById("login-senha"))?.value;

            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, senha })
                });

                const data = await response.json();

                if (response.ok) {
                    const usuario = data.usuario || data;
                    localStorage.setItem("usuario_batebola", JSON.stringify(usuario));
                    window.location.href = "perfil.html";
                } else {
                    alert(data.erro || "E-mail ou senha inválidos.");
                }
            } catch (err) {
                console.error("Erro no login:", err);
                alert("Erro ao conectar com o servidor.");
            }
        };
    }

    if (formCadastro) {
        formCadastro.onsubmit = async (e) => {
            e.preventDefault();
            const dados = {
                nome: (document.getElementById("cad-nome"))?.value,
                email: (document.getElementById("cad-email"))?.value,
                cidade: (document.getElementById("cad-cidade"))?.value || "Belo Horizonte - MG",
                senha: (document.getElementById("cad-senha"))?.value
            };

            try {
                const response = await fetch(`${API_URL}/usuarios`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(dados)
                });

                const resultado = await response.json();

                if (response.ok) {
                    const usuario = resultado.usuario || resultado;
                    localStorage.setItem("usuario_batebola", JSON.stringify(usuario));
                    alert("Conta criada com sucesso!");
                    window.location.href = "perfil.html";
                } else {
                    alert(resultado.erro || "Erro ao criar conta.");
                }
            } catch (err) {
                console.error("Erro no cadastro:", err);
                alert("Erro de conexão ao tentar cadastrar.");
            }
        };
    }
}

function formatarDataExibicao(dataIso) {
    if (!dataIso) return "Data não informada";
    const partes = dataIso.split("-");
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataIso;
}

function verificarPartidaRealizada(dataIso, horario) {
    if (!dataIso) return false;
    const hora = horario || "23:59";
    const dataHoraPartida = new Date(`${dataIso}T${hora}:00`);
    return !isNaN(dataHoraPartida.getTime()) && dataHoraPartida < new Date();
}

async function carregarPartidas(esporteFiltro = "Todos") {
    const container = document.getElementById("container-partidas");
    if (!container) return;

    container.innerHTML = `<p style="grid-column: 1/-1; color: #64748b;">Carregando partidas...</p>`;

    try {
        const endpoint = esporteFiltro === "Todos" 
            ? `${API_URL}/partidas` 
            : `${API_URL}/partidas/por-esporte?esporte=${encodeURIComponent(esporteFiltro)}`;

        const response = await fetch(endpoint);
        if (!response.ok) throw new Error("Erro na API");

        let partidas = await response.json();
        container.innerHTML = "";

        partidas = partidas.filter(partida => !verificarPartidaRealizada(partida.data_hora, partida.horario));

        if (!Array.isArray(partidas) || partidas.length === 0) {
            container.innerHTML = `<p style="grid-column: 1/-1; color: #64748b;">Nenhuma partida disponível no momento.</p>`;
            return;
        }

        const partidasFavoritas = obterPartidasFavoritas();
        partidas.sort((partidaA, partidaB) =>
            Number(partidasFavoritas.has(String(partidaB.id))) -
            Number(partidasFavoritas.has(String(partidaA.id)))
        );
        partidas.forEach(partida => {
            const favorita = partidasFavoritas.has(String(partida.id));
            container.appendChild(criarCardPartida(partida, favorita));
        });
    } catch (error) {
        console.error("Erro no GET:", error);
        container.innerHTML = `<p style="grid-column: 1/-1; color: #ef4444;">Erro ao carregar partidas.</p>`;
    }
}

function obterChavePartidasFavoritas() {
    const usuarioLogado = obterUsuarioLogado();
    return `partidas_favoritas_${usuarioLogado ? usuarioLogado.id : "anonimo"}`;
}

function obterPartidasFavoritas() {
    const favoritas = JSON.parse(localStorage.getItem(obterChavePartidasFavoritas()) || "[]");
    return new Set(Array.isArray(favoritas) ? favoritas.map(String) : []);
}

function alternarFavorita(partidaId) {
    const container = document.getElementById("container-partidas");
    if (!container) return;

    const favoritas = obterPartidasFavoritas();
    const id = String(partidaId);
    if (favoritas.has(id)) {
        favoritas.delete(id);
    } else {
        favoritas.add(id);
    }
    localStorage.setItem(obterChavePartidasFavoritas(), JSON.stringify(Array.from(favoritas)));

    const card = Array.from(container.querySelectorAll(".card-partida"))
        .find(item => item.dataset.partidaId === id);
    if (!card) return;

    const favorita = favoritas.has(id);
    card.dataset.favorita = String(favorita);

    const botao = card.querySelector(".btn-favoritar");
    if (botao) {
        botao.classList.toggle("favorito", favorita);
        botao.setAttribute("aria-pressed", String(favorita));
        botao.setAttribute("aria-label", favorita ? "Remover dos favoritos" : "Adicionar aos favoritos");
        botao.title = favorita ? "Remover dos favoritos" : "Adicionar aos favoritos";
        botao.innerHTML = `<i class="${favorita ? "fa-solid" : "fa-regular"} fa-star"></i>`;
    }

    Array.from(container.querySelectorAll(".card-partida"))
        .sort((cardA, cardB) =>
            Number(cardB.dataset.favorita === "true") -
            Number(cardA.dataset.favorita === "true")
        )
        .forEach(item => container.appendChild(item));
}

async function carregarHistoricoPartidas(usuarioLogado) {
    const container = document.getElementById("container-historico");
    if (!container) return;

    container.innerHTML = `<p style="grid-column: 1/-1; color: #64748b;">Carregando histórico...</p>`;

    try {
        const response = await fetch(`${API_URL}/partidas`);
        if (!response.ok) throw new Error("Erro ao buscar histórico");

        const partidas = await response.json();
        container.innerHTML = "";

        const inscricoesChave = `inscricoes_${usuarioLogado.id}`;
        const inscricoesLocais = JSON.parse(localStorage.getItem(inscricoesChave) || "[]");

        const historico = partidas.filter(partida => {
            const estaInscrito = inscricoesLocais.includes(partida.id) || 
                                 (Array.isArray(partida.participantes) && partida.participantes.includes(usuarioLogado.nome));
            const ehCriador = partida.usuario_id && Number(partida.usuario_id) === Number(usuarioLogado.id);

            return estaInscrito || ehCriador;
        });

        if (!Array.isArray(historico) || historico.length === 0) {
            container.innerHTML = `<p style="grid-column: 1/-1; color: #64748b;">Você ainda não participou de nenhuma partida.</p>`;
            return;
        }

        historico.forEach(partida => container.appendChild(criarCardPartida(partida)));

    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        container.innerHTML = `<p style="grid-column: 1/-1; color: #ef4444;">Erro ao carregar histórico de partidas.</p>`;
    }
}

function criarCardPartida(partida, favorita = null) {
    const card = document.createElement("div");
    card.className = "card-partida";
    card.dataset.partidaId = String(partida.id);
    if (favorita !== null) {
        card.dataset.favorita = String(favorita);
    }

    const usuarioLogado = obterUsuarioLogado();
    const inscricoesChave = usuarioLogado ? `inscricoes_${usuarioLogado.id}` : null;
    const inscricoes = usuarioLogado ? JSON.parse(localStorage.getItem(inscricoesChave) || "[]") : [];

    const estaInscrito = inscricoes.map(id => Number(id)).includes(Number(partida.id));
    const jaRealizada = verificarPartidaRealizada(partida.data_hora, partida.horario);
    const ehDono = usuarioLogado && partida.usuario_id && Number(partida.usuario_id) === Number(usuarioLogado.id);

    const iconesEsporte = {
        "Futebol": "fa-futbol",
        "Futsal": "fa-futbol",
        "Basquete": "fa-basketball",
        "Vôlei": "fa-volleyball"
    };

    const iconeClass = iconesEsporte[partida.esporte] || "fa-trophy";

    const totalParticipantes = Array.isArray(partida.participantes) ? partida.participantes.length : 0;
    const vagasTotais = partida.vagas || 0;
    const vagasCheias = totalParticipantes >= vagasTotais;

    const botaoFavoritarHTML = favorita === null ? "" : `
        <button class="btn-icon btn-favoritar${favorita ? " favorito" : ""}"
                type="button"
                aria-label="${favorita ? "Remover dos favoritos" : "Adicionar aos favoritos"}"
                aria-pressed="${favorita}"
                title="${favorita ? "Remover dos favoritos" : "Adicionar aos favoritos"}"
                onclick="alternarFavorita(${partida.id})">
            <i class="${favorita ? "fa-solid" : "fa-regular"} fa-star"></i>
        </button>
    `;

    const acoesCriadorHTML = ehDono || botaoFavoritarHTML ? `
        <div class="card-header-actions">
            ${botaoFavoritarHTML}
            ${ehDono ? `
            <button class="btn-icon" onclick="prepararEdicao(${JSON.stringify(partida).replace(/"/g, '&quot;')})">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-icon delete" onclick="deletarPartida(${partida.id})">
                <i class="fa-solid fa-trash"></i>
            </button>
            ` : ""}
        </div>
    ` : `<div></div>`;

    let botaoHTML = "";
    if (jaRealizada) {
        botaoHTML = `
            <div style="display: flex; gap: 0.5rem; flex-direction: column;">
                <span style="text-align: center; color: #64748b; font-size: 0.85rem; font-weight: 600;">
                    <i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Partida Realizada
                </span>
                <button class="btn-participar" style="background-color: #f59e0b;" onclick="abrirModalAvaliacao(${partida.id})">
                    <i class="fa-solid fa-star"></i> Avaliar Jogadores
                </button>
            </div>
        `;
    } else if (estaInscrito) {
        botaoHTML = `
            <div style="display: flex; gap: 0.5rem; width: 100%;">
                <button class="btn-participar" style="background-color: #2563eb; flex: 1; margin: 0;" onclick="window.location.href='chat.html?id=${partida.id}'">
                    <i class="fa-solid fa-comments"></i> Abrir Chat
                </button>
                <button class="btn-participar" style="background-color: #ef4444; width: 45px; min-width: 45px; padding: 0; display: flex; align-items: center; justify-content: center; margin: 0;" title="Cancelar Participação" onclick="cancelarParticipacao(${partida.id})">
                    <i class="fa-solid fa-user-minus"></i>
                </button>
            </div>
        `;
    } else {
        botaoHTML = `
            <button class="btn-participar" 
                    style="${vagasCheias ? 'background-color: #94a3b8; cursor: not-allowed;' : ''}"
                    onclick="participarPartida(${partida.id}, ${vagasCheias})">
                ${vagasCheias ? 'Vagas Esgotadas' : 'Participar'}
            </button>
        `;
    }

    card.innerHTML = `
        <div class="card-header">
            <div class="card-header-title">
                <i class="fa-solid ${iconeClass}"></i>
                <span>${partida.esporte}</span>
            </div>
            ${acoesCriadorHTML}
        </div>
        <div class="card-body">
            <div class="card-info">
                <i class="fa-regular fa-calendar"></i>
                <span>${formatarDataExibicao(partida.data_hora)}</span>
            </div>
            <div class="card-info">
                <i class="fa-solid fa-location-dot"></i>
                <span>${partida.local || 'Cotemig Barroca'}</span>
            </div>
            <div class="card-info">
                <i class="fa-regular fa-clock"></i>
                <span>${partida.horario || '00:00'}</span>
            </div>
            <div class="card-info">
                <i class="fa-regular fa-user"></i>
                <span>${totalParticipantes}/${vagasTotais} Participantes</span>
            </div>
        </div>
        <div class="map-placeholder">
            <i class="fa-solid fa-map-pin" style="color: #cbd5e1;"></i>
        </div>
        ${botaoHTML}
    `;

    return card;
}

async function participarPartida(id, vagasCheias) {
    if (vagasCheias) {
        alert("Não é possível entrar: as vagas desta partida já estão esgotadas!");
        return;
    }

    const usuarioLogado = obterUsuarioLogado();
    
    if (!usuarioLogado) {
        alert("Você precisa estar logado para entrar na partida.");
        window.location.href = "login.html";
        return;
    }

    const inscricoesChave = `inscricoes_${usuarioLogado.id}`;
    let inscricoes = JSON.parse(localStorage.getItem(inscricoesChave) || "[]").map(n => Number(n));

    if (!inscricoes.includes(Number(id))) {
        try {
            await fetch(`${API_URL}/partidas/${id}/participar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario_id: usuarioLogado.id, nome: usuarioLogado.nome })
            });
        } catch (error) {
            console.warn("Aviso ao registrar na API:", error);
        }

        inscricoes.push(Number(id));
        localStorage.setItem(inscricoesChave, JSON.stringify(inscricoes));
    }

    window.location.href = `chat.html?id=${id}`;
}

async function cancelarParticipacao(id) {
    if (!confirm("Tem certeza que deseja cancelar sua participação nesta partida?")) return;

    const usuarioLogado = obterUsuarioLogado();
    if (!usuarioLogado) return;

    const inscricoesChave = `inscricoes_${usuarioLogado.id}`;
    let inscricoes = JSON.parse(localStorage.getItem(inscricoesChave) || "[]").map(n => Number(n));

    inscricoes = inscricoes.filter(partidaId => partidaId !== Number(id));
    localStorage.setItem(inscricoesChave, JSON.stringify(inscricoes));

    try {
        await fetch(`${API_URL}/partidas/${id}/cancelar-participacao`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario_id: usuarioLogado.id })
        });
    } catch (error) {
        console.warn("Aviso ao cancelar na API:", error);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const esporteAtual = urlParams.get("esporte") || "Todos";
    
    if (document.getElementById("container-partidas")) {
        carregarPartidas(esporteAtual);
    } else if (document.getElementById("container-historico")) {
        carregarHistoricoPartidas(usuarioLogado);
    }
}

async function abrirModalAvaliacao(partidaId) {
    const usuarioLogado = obterUsuarioLogado();
    const modal = document.getElementById("modal-avaliar");
    const containerLista = document.getElementById("lista-jogadores-avaliar");

    if (!modal || !containerLista) return;

    containerLista.innerHTML = `<p style="color: #64748b;">Carregando participantes...</p>`;
    document.getElementById("partida-avaliar-id").value = partidaId;
    modal.classList.add("active");

    try {
        const response = await fetch(`${API_URL}/partidas/${partidaId}`);
        if (!response.ok) throw new Error("Erro ao carregar partida.");

        const partida = await response.json();
        let participantes = partida.participantes || [];

        if (usuarioLogado && usuarioLogado.nome) {
            participantes = participantes.filter(nome => nome.toLowerCase() !== usuarioLogado.nome.toLowerCase());
        }

        containerLista.innerHTML = "";

        if (participantes.length === 0) {
            containerLista.innerHTML = `<p style="color: #64748b;">Não há outros jogadores para avaliar nesta partida.</p>`;
            return;
        }

        participantes.forEach((nome, index) => {
            const item = document.createElement("div");
            item.className = "player-eval-item";
            item.innerHTML = `
                <span class="player-eval-name"><i class="fa-solid fa-user-check" style="color: var(--primary);"></i> ${nome}</span>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <select name="nota_${index}" class="player-eval-select" required>
                        <option value="5">5 ★★★★★</option>
                        <option value="4">4 ★★★★</option>
                        <option value="3">3 ★★★</option>
                        <option value="2">2 ★★</option>
                        <option value="1">1 ★</option>
                    </select>
                </div>
            `;
            containerLista.appendChild(item);
        });

    } catch (err) {
        console.error("Erro ao carregar participantes:", err);
        containerLista.innerHTML = `<p style="color: #ef4444;">Erro ao carregar lista de jogadores.</p>`;
    }
}

function configurarModalAvaliacao() {
    const modal = document.getElementById("modal-avaliar");
    const btnFechar = document.getElementById("btn-fechar-avaliar");
    const form = document.getElementById("form-avaliacao");

    if (!modal) return;

    if (btnFechar) {
        btnFechar.onclick = () => modal.classList.remove("active");
    }

    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            alert("Avaliações enviadas com sucesso! Obrigado pelo feedback.");
            modal.classList.remove("active");
        };
    }
}

function configurarModal() {
    const modal = document.getElementById("modal-partida");
    const btnAbrir = document.getElementById("btn-abrir-modal");
    const btnFechar = document.getElementById("btn-fechar-modal");
    const btnCancelar = document.getElementById("btn-cancelar");
    const form = document.getElementById("form-partida");
    const inputData = document.getElementById("input-data");

    if (!modal || !btnAbrir) return;

    const abrirModal = () => {
        form.reset();
        document.getElementById("partida-id").value = "";
        document.getElementById("modal-titulo").textContent = "Criar Nova Partida";

        if (inputData) {
            const hoje = new Date().toISOString().split('T')[0];
            inputData.min = hoje;
        }

        modal.classList.add("active");
    };

    const fecharModal = () => {
        modal.classList.remove("active");
        form.reset();
    };

    btnAbrir.onclick = abrirModal;
    if (btnFechar) btnFechar.onclick = fecharModal;
    if (btnCancelar) btnCancelar.onclick = fecharModal;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById("partida-id").value;
        const usuarioLogado = obterUsuarioLogado();

        const dataSelecionada = document.getElementById("input-data").value;
        
        const hojeIso = new Date().toISOString().split('T')[0];
        if (dataSelecionada < hojeIso) {
            alert("Não é possível criar partidas para datas que já passaram!");
            return;
        }

        const dados = {
            esporte: document.getElementById("input-esporte").value,
            local: document.getElementById("input-local").value,
            data_hora: dataSelecionada,
            horario: document.getElementById("input-horario").value,
            vagas: parseInt(document.getElementById("input-vagas").value),
            usuario_id: usuarioLogado ? usuarioLogado.id : null
        };

        try {
            const url = id ? `${API_URL}/partidas/${id}` : `${API_URL}/partidas`;
            const method = id ? "PUT" : "POST";

            const response = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dados)
            });

            if (response.ok) {
                fecharModal();
                const urlParams = new URLSearchParams(window.location.search);
                const esporteAtual = urlParams.get("esporte") || "Todos";
                carregarPartidas(esporteAtual);
            } else {
                const erro = await response.json();
                alert(erro.erro || "Erro ao salvar a partida.");
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
        }
    };
}

function prepararEdicao(partida) {
    document.getElementById("partida-id").value = partida.id;
    document.getElementById("input-esporte").value = partida.esporte;
    document.getElementById("input-local").value = partida.local || "";
    document.getElementById("input-data").value = partida.data_hora || "";
    document.getElementById("input-horario").value = partida.horario || "";
    document.getElementById("input-vagas").value = partida.vagas || "";

    const inputData = document.getElementById("input-data");
    if (inputData) {
        const hoje = new Date().toISOString().split('T')[0];
        inputData.min = hoje;
    }

    document.getElementById("modal-titulo").textContent = "Editar Partida";
    document.getElementById("modal-partida").classList.add("active");
}

async function deletarPartida(id) {
    if (!confirm("Tem certeza que deseja excluir esta partida?")) return;

    const usuarioLogado = obterUsuarioLogado();
    const urlParam = usuarioLogado ? `?usuario_id=${usuarioLogado.id}` : "";

    try {
        const response = await fetch(`${API_URL}/partidas/${id}${urlParam}`, { method: "DELETE" });
        if (response.ok) {
            const urlParams = new URLSearchParams(window.location.search);
            const esporteAtual = urlParams.get("esporte") || "Todos";
            carregarPartidas(esporteAtual);
        } else {
            const erro = await response.json();
            alert(erro.erro || "Erro ao excluir partida.");
        }
    } catch (error) {
        console.error("Erro no DELETE:", error);
    }
}

function configurarFiltros() {
    const pills = document.querySelectorAll(".sport-pills .pill");
    pills.forEach(pill => {
        pill.addEventListener("click", (e) => {
            const esporteSelecionado = e.target.getAttribute("data-esporte");
            pills.forEach(p => p.classList.remove("active"));
            e.target.classList.add("active");

            const novaUrl = `${window.location.pathname}?esporte=${encodeURIComponent(esporteSelecionado)}`;
            window.history.pushState({ path: novaUrl }, '', novaUrl);

            carregarPartidas(esporteSelecionado);
        });
    });
}

function marcarPillAtiva(esporte) {
    const pills = document.querySelectorAll(".sport-pills .pill");
    pills.forEach(pill => {
        const valorPill = pill.getAttribute("data-esporte");
        if (valorPill && valorPill.toLowerCase() === esporte.toLowerCase()) {
            pill.classList.add("active");
        } else {
            pill.classList.remove("active");
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!window.location.pathname.toLowerCase().includes("chat.html")) return;

    const urlParams = new URLSearchParams(window.location.search);
    const partidaId = urlParams.get('id');
    const usuarioLogado = typeof obterUsuarioLogado === "function" ? obterUsuarioLogado() : null;

    if (!partidaId) {
        alert("Nenhuma partida selecionada.");
        window.location.href = "partidas.html";
        return;
    }

    await carregarDetalhesPartida(partidaId, usuarioLogado);
    carregarMensagensSalvas(partidaId);

    const formChat = document.getElementById("form-chat");
    const inputMensagem = document.getElementById("input-mensagem");

    if (formChat) {
        formChat.addEventListener("submit", (e) => {
            e.preventDefault();
            const texto = inputMensagem.value.trim();
            if (!texto) return;

            const nomeUsuario = usuarioLogado ? usuarioLogado.nome : "Convidado";
            const horaAtual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const novaMensagem = {
                usuario: nomeUsuario,
                hora: horaAtual,
                texto: texto
            };

            salvarMensagemLocal(partidaId, novaMensagem);
            renderizarMensagem(novaMensagem);

            inputMensagem.value = "";
        });
    }
});

async function carregarDetalhesPartida(id, usuarioLogado) {
    try {
        const response = await fetch(`${API_URL}/partidas/${id}`);
        if (!response.ok) throw new Error("Erro ao carregar dados da partida");

        const partida = await response.json();

        const elEsporte = document.getElementById("nome-esporte");
        if (elEsporte) {
            elEsporte.textContent = (partida.esporte || "FUTEBOL").toUpperCase();
        }

        const elPinned = document.getElementById("pinned-text");
        if (elPinned) {
            const dataFormatada = formatarDataExibicao(partida.data_hora);
            const horarioPartida = partida.horario || "00:00";
            elPinned.textContent = `${partida.esporte || 'Partida'} para ${dataFormatada} às ${horarioPartida}`;
        }

        let participantes = partida.participantes || [];
        if (usuarioLogado && usuarioLogado.nome && !participantes.includes(usuarioLogado.nome)) {
            participantes.unshift(usuarioLogado.nome);
        }
        if (participantes.length === 0 && usuarioLogado) {
            participantes = [usuarioLogado.nome];
        }

        renderizarParticipantes(participantes);

    } catch (err) {
        console.error("Erro ao carregar dados:", err);
        if (usuarioLogado) {
            renderizarParticipantes([usuarioLogado.nome]);
        }
    }
}

function renderizarParticipantes(lista) {
    const container = document.getElementById("lista-participantes");
    if (!container) return;
    
    container.innerHTML = "";

    if (!lista || lista.length === 0) {
        container.innerHTML = `<p class="empty-participants">Nenhum participante ainda.</p>`;
        return;
    }

    lista.forEach(nome => {
        const card = document.createElement("div");
        card.className = "participant-card";
        card.innerHTML = `
            <i class="fa-solid fa-circle-user"></i>
            <span>${nome}</span>
        `;
        container.appendChild(card);
    });
}

function salvarMensagemLocal(partidaId, mensagemObj) {
    const chave = `chat_mensagens_partida_${partidaId}`;
    const historico = JSON.parse(localStorage.getItem(chave) || "[]");
    historico.push(mensagemObj);
    localStorage.setItem(chave, JSON.stringify(historico));
}

function carregarMensagensSalvas(partidaId) {
    const messagesContainer = document.getElementById("messages-container");
    if (messagesContainer) {
        messagesContainer.innerHTML = ""; 
    }

    const chave = `chat_mensagens_partida_${partidaId}`;
    const historico = JSON.parse(localStorage.getItem(chave) || "[]");
    historico.forEach(msg => renderizarMensagem(msg));
}

function renderizarMensagem(msg) {
    const messagesContainer = document.getElementById("messages-container");
    if (!messagesContainer) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-msg-bubble";
    msgDiv.innerHTML = `
        <div class="chat-msg-header">
            <span class="chat-msg-user">${msg.usuario}</span>
            <span class="chat-msg-time">Hoje às ${msg.hora}</span>
        </div>
        <span class="chat-msg-text">${msg.texto}</span>
    `;

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/* ==========================================================================
   Modo Escuro / Dark Mode Management
   ========================================================================== */

const CHAVE_TEMA = "batebola_theme";

function aplicarTema(tema, salvar = true) {
    const root = document.documentElement;
    const ehEscuro = tema === "dark";
    
    if (ehEscuro) {
        root.setAttribute("data-theme", "dark");
    } else {
        root.removeAttribute("data-theme");
    }

    if (salvar) {
        try {
            localStorage.setItem(CHAVE_TEMA, tema);
        } catch (e) {
            console.warn("Não foi possível salvar o tema no localStorage:", e);
        }
    }

    // Atualiza todos os botões de alternância da página
    const botoes = document.querySelectorAll(".theme-toggle-btn");
    botoes.forEach(btn => {
        btn.setAttribute("aria-pressed", String(ehEscuro));
        btn.setAttribute("aria-label", ehEscuro ? "Mudar para modo claro" : "Mudar para modo escuro");
        btn.setAttribute("title", ehEscuro ? "Mudar para modo claro" : "Mudar para modo escuro");
    });

    // Atualiza a meta tag theme-color dos navegadores mobile
    let metaThemeColor = document.getElementById("meta-theme-color") || document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
        metaThemeColor = document.createElement("meta");
        metaThemeColor.name = "theme-color";
        metaThemeColor.id = "meta-theme-color";
        document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute("content", ehEscuro ? "#0b0f19" : "#f8f9fa");

    // Dispara evento customizado para outros componentes
    window.dispatchEvent(new CustomEvent("temaalterado", { detail: { tema, ehEscuro } }));
}

function alternarTema() {
    const temaAtual = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const novoTema = temaAtual === "dark" ? "light" : "dark";
    aplicarTema(novoTema, true);
}

function obterTemaInicial() {
    try {
        const temaSalvo = localStorage.getItem(CHAVE_TEMA);
        if (temaSalvo === "dark" || temaSalvo === "light") {
            return temaSalvo;
        }
    } catch (e) {}

    const prefereEscuro = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefereEscuro ? "dark" : "light";
}

function configurarModoEscuro() {
    const temaInicial = obterTemaInicial();
    aplicarTema(temaInicial, false);

    // Garante que o botão existe no header
    const topHeader = document.querySelector(".top-header");
    if (topHeader && !document.getElementById("theme-toggle-header")) {
        let containerRight = topHeader.querySelector(".header-right");
        if (!containerRight) {
            containerRight = document.createElement("div");
            containerRight.className = "header-right";
            topHeader.appendChild(containerRight);
        }
        if (!containerRight.querySelector("#theme-toggle-header")) {
            const btnHeader = document.createElement("button");
            btnHeader.id = "theme-toggle-header";
            btnHeader.className = "theme-toggle-btn";
            btnHeader.type = "button";
            btnHeader.setAttribute("aria-label", "Alternar modo escuro");
            btnHeader.setAttribute("title", "Alternar modo escuro");
            btnHeader.innerHTML = `
                <i class="fa-solid fa-moon icon-moon"></i>
                <i class="fa-solid fa-sun icon-sun"></i>
            `;
            containerRight.appendChild(btnHeader);
        }
    }

    // Garante que o botão existe no sidebar
    const sidebarBottom = document.querySelector(".sidebar-bottom");
    if (sidebarBottom && !document.getElementById("theme-toggle-sidebar")) {
        const btnSidebar = document.createElement("button");
        btnSidebar.id = "theme-toggle-sidebar";
        btnSidebar.className = "nav-icon theme-toggle-btn";
        btnSidebar.type = "button";
        btnSidebar.setAttribute("aria-label", "Alternar modo escuro");
        btnSidebar.setAttribute("title", "Alternar modo escuro");
        btnSidebar.innerHTML = `
            <i class="fa-solid fa-moon icon-moon"></i>
            <i class="fa-solid fa-sun icon-sun"></i>
        `;
        const btnLogout = sidebarBottom.querySelector("#btn-logout, a:last-child");
        if (btnLogout) {
            sidebarBottom.insertBefore(btnSidebar, btnLogout);
        } else {
            sidebarBottom.appendChild(btnSidebar);
        }
    }

    // Vincula evento de clique via delegação global
    document.removeEventListener("click", tratarCliqueTema);
    document.addEventListener("click", tratarCliqueTema);

    // Escuta mudanças do sistema operacional se o usuário não escolheu manualmente
    if (window.matchMedia) {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener("change", (e) => {
            const temaSalvo = localStorage.getItem(CHAVE_TEMA);
            if (!temaSalvo) {
                aplicarTema(e.matches ? "dark" : "light", false);
            }
        });
    }

    // Reatualiza estados visuais dos botões
    aplicarTema(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light", false);
}

function tratarCliqueTema(e) {
    const botao = e.target.closest(".theme-toggle-btn, #theme-toggle-header, #theme-toggle-sidebar");
    if (botao) {
        e.preventDefault();
        alternarTema();
    }
}
