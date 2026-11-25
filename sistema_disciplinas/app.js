/* Aplicação: navegação por hash, estado de tela e inicialização dos módulos. */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const pageLabels = {
    inicio: "Início", turnos: "Gerenciar Turnos", areas: "Gerenciar Áreas Acadêmicas", professores: "Gerenciar Professores",
    cursos: "Gerenciar Cursos", curriculos: "Currículos", disciplinas: "Gerenciar Disciplinas",
    "vincular-disciplina": "Alocar Disciplina ao Currículo", ingressantes: "Turmas Ingressantes",
    "gerar-ingressantes": "Gerar Turmas Ingressantes", "turmas-periodo": "Turmas em Período Letivo",
    "gerar-turmas": "Gerar Turmas em Período Letivo", ofertas: "Ofertar Disciplinas",
    "alocar-professor": "Alocar Professor à Disciplina-Turma", cargas: "Cargas Horárias", "importar-exportar": "Importação / Exportação",
    "form-turno": "Cadastrar Turno", "form-area": "Cadastrar Área Acadêmica", "form-curso": "Cadastrar Curso",
    "form-disciplina": "Cadastrar Disciplina", "form-professor": "Cadastrar Professor", "form-curriculo": "Cadastrar Currículo",
    "form-ingressante": "Cadastrar Turma Ingressante", "form-turma": "Cadastrar Turma em Período Letivo"
};
function showToast(message) {
    let toast = $("#toast");
    if (!toast) { toast = document.createElement("div"); toast.id = "toast"; toast.className = "toast"; toast.setAttribute("role", "status"); document.body.appendChild(toast); }
    toast.textContent = message; toast.classList.add("show"); clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}
function parseRoute() {
    const raw = location.hash.replace(/^#/, "") || "inicio";
    const [key, query = ""] = raw.split("?");
    return { key: key || "inicio", params: new URLSearchParams(query) };
}
async function navigate() {
    const { key } = parseRoute();
    const target = $(`.app-page[data-page="${CSS.escape(key)}"]`);
    const pageKey = target ? key : "inicio";
    $$(".app-page").forEach(page => page.hidden = page.dataset.page !== pageKey);
    $$("#main-nav [data-page]").forEach(link => link.classList.toggle("active", link.dataset.page === pageKey));
    const label = $("#breadcrumb-label"); if (label) label.textContent = pageLabels[pageKey] || "Início";
    $("#sidebar")?.classList.remove("open");
    if (window.SistemaCrudPresenter.config[pageKey]) await window.SistemaCrudPresenter.startForm(pageKey);
    else await window.SistemaCrudPresenter.startList(pageKey);
    if (window.SistemaWorkflows) await window.SistemaWorkflows.onNavigate(pageKey);
    if (pageKey === "importar-exportar") setupBackup();
}
let backupBound = false;
function setupBackup() {
    if (backupBound) return; backupBound = true;
    $("#export-button")?.addEventListener("click", async () => {
        try {
            const data = await window.SistemaDatabase.repository.exportAll();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob); const link = document.createElement("a");
            link.href = url; link.download = "backup-sistema-ifrs.json"; link.click(); URL.revokeObjectURL(url); showToast("Backup JSON exportado.");
        } catch (error) { showToast(error.message || "Não foi possível exportar o backup."); }
    });
}
$("#mobile-menu")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));
document.addEventListener("click", event => {
    const toggle = event.target.closest(".group-toggle");
    if (toggle) {
        const children = document.querySelector(`[data-children="${toggle.dataset.group}"]`);
        if (children) { children.classList.toggle("hidden"); const arrow = toggle.querySelector("b"); if (arrow) arrow.textContent = children.classList.contains("hidden") ? "⌄" : "⌃"; }
    }
});
function searchPages() {
    const query = $("#global-search")?.value.toLocaleLowerCase("pt-BR").trim(); if (!query) return;
    const match = Object.entries(pageLabels).find(([, label]) => label.toLocaleLowerCase("pt-BR").includes(query));
    if (!match) { showToast("Nenhuma tela encontrada com esse termo."); return; }
    location.hash = `#${match[0]}`;
}
$("#search-btn")?.addEventListener("click", searchPages);
$("#global-search")?.addEventListener("keydown", event => { if (event.key === "Enter") searchPages(); });
window.addEventListener("hashchange", () => navigate().catch(error => { console.error(error); showToast(error.message || "Erro ao abrir a tela."); }));
(async function initializeApplication() {
    try { await window.SistemaDatabase.open(); await navigate(); }
    catch (error) { console.error(error); showToast(error.message || "Erro ao iniciar o banco local."); }
})();
