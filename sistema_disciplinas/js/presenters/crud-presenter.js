/* Presenter: coordena formulários, listagens, regras acadêmicas e o Model. */
(function () {
    const db = window.SistemaDatabase.repository;
    const config = {
        "form-turno": { store: "turno", fields: { sigla: "turno-sigla", nome: "turno-nome", descricao: "turno-descricao" }, list: "turnos" },
        "form-area": { store: "area_academica", fields: { sigla: "area-sigla", nome: "area-nome", descricao: "area-descricao" }, list: "areas" },
        "form-curso": { store: "curso", fields: { codigo: "curso-codigo", nome: "curso-nome" }, list: "cursos" },
        "form-disciplina": { store: "disciplina", fields: { codigo: "disc-codigo", nome: "disc-nome", aulasSemana: "disc-aulas-semanais", totalAulas: "disc-total-aulas", areaId: "disc-area" }, list: "disciplinas" },
        "form-professor": { store: "professor", fields: { nome: "prof-nome", sobrenome: "prof-sobrenome", nomeAbreviado: "prof-abreviado", email: "prof-email", areaId: "prof-area", horasMin: "prof-min", horasMax: "prof-max", horasMed: "prof-med", observacoes: "prof-obs" }, list: "professores" },
        "form-curriculo": { store: "curriculo", fields: { anoInicial: "cur-ano-inicial", semestreInicial: "cur-sem-inicial", anoFinal: "cur-ano-final", semestreFinal: "cur-sem-final", periodicidadeIngresso: "cur-ingresso", periodicidadeCurricular: "cur-periodicidade", totalPeriodos: "cur-total-periodos", duracaoAula: "cur-duracao", areaId: "cur-area", situacao: "cur-situacao" }, list: "curriculos" }
    };
    const pageToList = { turnos: "turno", areas: "area_academica", cursos: "curso", disciplinas: "disciplina", professores: "professor", curriculos: "curriculo" };
    const listToForm = { turnos: "form-turno", areas: "form-area", cursos: "form-curso", disciplinas: "form-disciplina", professores: "form-professor", curriculos: "form-curriculo" };
    const numberFields = new Set(["aulasSemana", "totalAulas", "horasMin", "horasMax", "horasMed", "areaId", "cursoId", "anoInicial", "anoFinal", "semestreInicial", "semestreFinal", "totalPeriodos", "duracaoAula"]);
    const rootFor = key => document.querySelector(`.app-page[data-page="${CSS.escape(key)}"]`);
    const getValue = (root, id) => root.querySelector(`#${CSS.escape(id)}`)?.value.trim() ?? "";
    const setValue = (root, id, value) => { const el = root.querySelector(`#${CSS.escape(id)}`); if (el) el.value = value ?? ""; };

    async function hydrateRelations(root) {
        const areas = await db.all("area_academica");
        const options = areas.map(area => ({ ...area, label: `${area.sigla} — ${area.nome}` }));
        ["disc-area", "prof-area"].forEach(id => window.SistemaCrudView.fillSelect(root.querySelector(`#${id}`), options, "id", "label", "Sem área"));
    }

    function routeParams() {
        const raw = location.hash.replace(/^#/, "");
        const queryIndex = raw.indexOf("?");
        return new URLSearchParams(queryIndex >= 0 ? raw.slice(queryIndex + 1) : "");
    }

    async function startForm(pageKey) {
        const definition = config[pageKey];
        const root = rootFor(pageKey);
        if (!definition || !root) return;
        await hydrateRelations(root);
        if (pageKey === "form-curriculo") {
            const areas = await db.all("area_academica");
            window.SistemaCrudView.fillSelect(root.querySelector("#cur-area"), areas, "id", "nome", "Selecione a área");
        }
        const params = routeParams();
        const id = params.get("id");
        const form = root.querySelector(".data-form");
        if (!form) return;
        form.dataset.recordId = "";
        const heading = root.querySelector("h1");
        if (heading && !form.dataset.originalHeading) form.dataset.originalHeading = heading.textContent;
        if (heading) heading.textContent = id ? form.dataset.originalHeading.replace(/^Cadastrar/, "Editar") : form.dataset.originalHeading;
        const submit = form.querySelector('[type="submit"]');
        if (submit && !submit.dataset.originalText) submit.dataset.originalText = submit.textContent;
        if (submit) submit.textContent = id ? "Salvar alterações" : submit.dataset.originalText;
        if (id) {
            const record = await db.get(definition.store, Number(id));
            if (!record) { showToast("Registro não encontrado."); return; }
            Object.entries(definition.fields).forEach(([field, inputId]) => setValue(root, inputId, record[field]));
            if (pageKey === "form-curriculo" && record.periodoInicial) { const [ano, periodo] = String(record.periodoInicial).split(" / "); setValue(root, "cur-ano-inicial", ano); setValue(root, "cur-sem-inicial", periodo); }
            if (pageKey === "form-curriculo" && record.periodoFinal) { const [ano, periodo] = String(record.periodoFinal).split(" / "); setValue(root, "cur-ano-final", ano); setValue(root, "cur-sem-final", periodo); }
            if (pageKey === "form-curriculo") root.querySelectorAll('input[name="turnos"]').forEach(input => input.checked = (record.turnos || []).includes(input.value));
            form.dataset.recordId = id;
        } else if (pageKey === "form-curriculo") {
            const cursoId = params.get("cursoId");
            const hint = root.querySelector("[data-curso-context]");
            if (hint) hint.textContent = cursoId ? `Currículo vinculado ao curso ${cursoId}` : "Abra o cadastro de currículo a partir do curso correspondente.";
        }
        if (form.dataset.bound === "true") return;
        form.dataset.bound = "true";
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const record = {};
            Object.entries(definition.fields).forEach(([field, inputId]) => { const raw = getValue(root, inputId); record[field] = numberFields.has(field) ? (raw === "" ? null : Number(raw)) : raw; });
            if (definition.store === "curriculo") {
                const currentParams = routeParams();
                const existing = form.dataset.recordId ? await db.get("curriculo", Number(form.dataset.recordId)) : null;
                record.cursoId = existing?.cursoId ?? (currentParams.get("cursoId") ? Number(currentParams.get("cursoId")) : null);
                if (!record.cursoId || !await db.get("curso", record.cursoId)) { showToast("Abra o cadastro de currículo a partir do curso correspondente."); return; }
                const hasInitialYear = getValue(root, "cur-ano-inicial") !== "", hasInitialPeriod = getValue(root, "cur-sem-inicial") !== "";
                const hasFinalYear = getValue(root, "cur-ano-final") !== "", hasFinalPeriod = getValue(root, "cur-sem-final") !== "";
                if (hasInitialYear !== hasInitialPeriod) { showToast("Preencha ano e período inicial juntos ou deixe ambos vazios."); return; }
                if (hasFinalYear !== hasFinalPeriod) { showToast("Preencha ano e período final juntos ou deixe ambos vazios."); return; }
                if (!hasInitialYear && hasFinalYear) { showToast("Sem período inicial previsto, o período final também deve ficar vazio."); return; }
                record.anoInicial = hasInitialYear ? Number(getValue(root, "cur-ano-inicial")) : null;
                record.semestreInicial = hasInitialPeriod ? Number(getValue(root, "cur-sem-inicial")) : null;
                record.anoFinal = hasFinalYear ? Number(getValue(root, "cur-ano-final")) : null;
                record.semestreFinal = hasFinalPeriod ? Number(getValue(root, "cur-sem-final")) : null;
                record.turnos = [...root.querySelectorAll('input[name="turnos"]:checked')].map(input => input.value);
                if (!record.turnos.length) { showToast("Selecione ao menos um turno."); return; }
                const area = record.areaId ? await db.get("area_academica", record.areaId) : null;
                const curso = await db.get("curso", record.cursoId);
                record.areaNome = area?.nome || ""; record.cursoNome = curso?.nome || ""; record.cursoCodigo = curso?.codigo || "";
                record.curriculoLabel = `${record.cursoNome} — ${record.anoInicial ?? "sem previsão"}`;
                record.periodoInicial = record.anoInicial === null ? null : `${record.anoInicial} / ${record.semestreInicial}`;
                record.periodoFinal = record.anoFinal === null ? null : `${record.anoFinal} / ${record.semestreFinal}`;
            }
            if (definition.store === "professor" && record.horasMin > record.horasMax) { showToast("A carga horária mínima não pode superar a máxima."); return; }
            if (definition.store === "professor" && (record.horasMed < record.horasMin || record.horasMed > record.horasMax)) { showToast("A média de horas deve ficar entre o mínimo e o máximo."); return; }
            if (definition.store === "disciplina" && !record.areaId) delete record.areaId;
            if (definition.store === "professor" || definition.store === "disciplina") {
                const area = record.areaId ? await db.get("area_academica", record.areaId) : null;
                record.areaNome = area ? area.nome : "Não informada";
            }
            record.updatedAt = new Date().toISOString();
            try {
                if (form.dataset.recordId) {
                    record.id = Number(form.dataset.recordId); record.createdAt = (await db.get(definition.store, record.id))?.createdAt || record.updatedAt;
                    await db.update(definition.store, record); showToast("Registro atualizado com sucesso.");
                } else { record.createdAt = record.updatedAt; await db.add(definition.store, record); showToast("Registro cadastrado com sucesso."); }
                location.hash = `#${definition.list}`;
            } catch (error) { showToast(error.message || "Não foi possível salvar. Verifique os dados."); console.error(error); }
        });
    }

    async function startList(pageKey) {
        const storeName = pageToList[pageKey], root = rootFor(pageKey);
        if (!storeName || !root) return;
        const render = async () => window.SistemaCrudView.renderTable(pageKey, await db.all(storeName), root);
        await render();
        const filter = root.querySelector("#table-filter");
        if (filter && filter.dataset.bound !== "true") {
            filter.dataset.bound = "true";
            filter.addEventListener("input", () => { const term = filter.value.toLocaleLowerCase("pt-BR"); root.querySelectorAll("#table-holder tbody tr").forEach(row => row.hidden = !row.textContent.toLocaleLowerCase("pt-BR").includes(term)); });
        }
        const holder = root.querySelector("#table-holder");
        if (holder && holder.dataset.bound !== "true") {
            holder.dataset.bound = "true";
            holder.addEventListener("click", async event => {
                const button = event.target.closest("button[data-action]"); if (!button) return;
                const id = Number(button.dataset.id);
                if (button.dataset.action === "edit") { location.hash = `#${listToForm[pageKey]}?id=${id}`; return; }
                if (button.dataset.action === "delete") {
                    if (!confirm("Deseja realmente excluir este registro?")) return;
                    try { await db.remove(storeName, id); showToast("Registro excluído."); await render(); }
                    catch (error) { showToast(error.message || "Não foi possível excluir o registro."); console.error(error); }
                }
            });
        }
    }
    window.SistemaCrudPresenter = { startForm, startList, config };
})();
