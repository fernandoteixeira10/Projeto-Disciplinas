/* Presenter: coordena formulário, validação, Model e View. */
(function () {
    const db = window.SistemaDatabase.repository;
    const config = {
        "form-turno": { store: "turno", fields: { sigla: "turno-sigla", nome: "turno-nome", descricao: "turno-descricao" }, list: "turnos", unique: "sigla" },
        "form-area": { store: "area_academica", fields: { sigla: "area-sigla", nome: "area-nome", descricao: "area-descricao" }, list: "areas", unique: "sigla" },
        "form-curso": { store: "curso", fields: { codigo: "curso-codigo", nome: "curso-nome" }, list: "cursos", unique: "codigo" },
        "form-disciplina": { store: "disciplina", fields: { codigo: "disc-codigo", nome: "disc-nome", aulasSemana: "disc-aulas-semanais", totalAulas: "disc-total-aulas", areaId: "disc-area" }, list: "disciplinas", unique: "codigo" },
        "form-professor": { store: "professor", fields: { nome: "prof-nome", sobrenome: "prof-sobrenome", nomeAbreviado: "prof-abreviado", email: "prof-email", areaId: "prof-area", horasMin: "prof-min", horasMax: "prof-max", horasMed: "prof-med", observacoes: "prof-obs" }, list: "professores", unique: "email" },
        "form-curriculo": { store: "curriculo", fields: { anoInicial: "cur-ano-inicial", semestreInicial: "cur-sem-inicial", anoFinal: "cur-ano-final", semestreFinal: "cur-sem-final", periodicidadeIngresso: "cur-ingresso", periodicidadeCurricular: "cur-periodicidade", totalPeriodos: "cur-total-periodos", duracaoAula: "cur-duracao", areaId: "cur-area", situacao: "cur-situacao" }, list: "curriculos", unique: null }
    };
    const pageToList = { turnos: "turno", areas: "area_academica", cursos: "curso", disciplinas: "disciplina", professores: "professor", curriculos: "curriculo" };
    const listToForm = { turnos: "form-turno.html", areas: "form-area-academica.html", cursos: "form-curso.html", disciplinas: "form-disciplina.html", professores: "form-professor.html", curriculos: "form-curriculo.html" };
    const $ = selector => document.querySelector(selector);
    const value = id => { const element = document.getElementById(id); return element ? element.value.trim() : ""; };
    const setValue = (id, content) => { const element = document.getElementById(id); if (element) element.value = content ?? ""; };
    const numberFields = new Set(["aulasSemana", "totalAulas", "horasMin", "horasMax", "horasMed", "areaId", "cursoId", "anoInicial", "anoFinal", "semestreInicial", "semestreFinal", "totalPeriodos", "duracaoAula"]);

    async function hydrateRelations(pageKey) {
        const areas = await db.all("area_academica");
        const options = areas.map(area => ({ ...area, label: `${area.sigla} — ${area.nome}` }));
        ["disc-area", "prof-area"].forEach(id => window.SistemaCrudView.fillSelect(document.getElementById(id), options, "id", "label", "Sem área"));
    }

    async function startForm(pageKey) {
        const definition = config[pageKey];
        if (!definition) return;
        await hydrateRelations(pageKey);
        if (pageKey === "form-curriculo") {
            const areas = await db.all("area_academica");
            window.SistemaCrudView.fillSelect(document.getElementById("cur-area"), areas, "id", "nome", "Selecione a área");
        }
        const params = new URLSearchParams(location.search);
        const id = params.get("id");
        const form = $(".data-form");
        if (!form) return;
        if (id) {
            const record = await db.get(definition.store, id);
            if (!record) { showToast("Registro não encontrado."); return; }
            Object.entries(definition.fields).forEach(([field, inputId]) => setValue(inputId, record[field]));
            if (pageKey === "form-curriculo" && record.periodoInicial) {
                const [ano, periodo] = String(record.periodoInicial).split(" / ");
                setValue("cur-ano-inicial", ano);
                setValue("cur-sem-inicial", periodo);
            }
            if (pageKey === "form-curriculo" && record.periodoFinal) {
                const [ano, periodo] = String(record.periodoFinal).split(" / ");
                setValue("cur-ano-final", ano);
                setValue("cur-sem-final", periodo);
            }
            if (pageKey === "form-curriculo") document.querySelectorAll('input[name="turnos"]').forEach(input => input.checked = (record.turnos || []).includes(input.value));
            const submit = form.querySelector('[type="submit"]');
            if (submit) submit.textContent = "Salvar alterações";
            const heading = document.querySelector("h1");
            if (heading) heading.textContent = heading.textContent.replace(/^Cadastrar/, "Editar");
            form.dataset.recordId = id;
        }
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const record = {};
            Object.entries(definition.fields).forEach(([field, inputId]) => {
                const raw = value(inputId);
                record[field] = numberFields.has(field) ? (raw === "" ? null : Number(raw)) : raw;
            });
            if (definition.store === "curriculo") {
                const params = new URLSearchParams(location.search);
                const existing = form.dataset.recordId ? await db.get("curriculo", Number(form.dataset.recordId)) : null;
                record.cursoId = existing?.cursoId ?? (params.get("cursoId") ? Number(params.get("cursoId")) : null);
                if (!record.cursoId || !await db.get("curso", record.cursoId)) { showToast("Abra o cadastro de currículo a partir do curso correspondente."); return; }
                const hasInitialYear = value("cur-ano-inicial") !== "";
                const hasInitialPeriod = value("cur-sem-inicial") !== "";
                if (hasInitialYear !== hasInitialPeriod) { showToast("Preencha ano e período inicial juntos ou deixe ambos vazios."); return; }
                const hasFinalYear = value("cur-ano-final") !== "";
                const hasFinalPeriod = value("cur-sem-final") !== "";
                if (hasFinalYear !== hasFinalPeriod) { showToast("Preencha ano e período final juntos ou deixe ambos vazios."); return; }
                if (!hasInitialYear && hasFinalYear) { showToast("Sem período inicial previsto, o período final também deve ficar vazio."); return; }
                record.anoInicial = hasInitialYear ? Number(value("cur-ano-inicial")) : null;
                record.semestreInicial = hasInitialPeriod ? Number(value("cur-sem-inicial")) : null;
                record.anoFinal = hasFinalYear ? Number(value("cur-ano-final")) : null;
                record.semestreFinal = hasFinalPeriod ? Number(value("cur-sem-final")) : null;
                record.turnos = [...document.querySelectorAll('input[name="turnos"]:checked')].map(input => input.value);
                if (!record.turnos.length) { showToast("Selecione ao menos um turno."); return; }
                record.areaNome = (await db.get("area_academica", record.areaId))?.nome || "";
                const curso = await db.get("curso", record.cursoId);
                record.cursoNome = curso?.nome || "";
                record.cursoCodigo = curso?.codigo || "";
                record.curriculoLabel = `${record.cursoNome} — ${record.anoInicial ?? "sem previsão"}`;
                record.periodoInicial = record.anoInicial === null ? null : `${record.anoInicial} / ${record.semestreInicial}`;
                record.periodoFinal = record.anoFinal === null ? null : `${record.anoFinal} / ${record.semestreFinal}`;
            }
            if (definition.store === "professor" && record.horasMin > record.horasMax) {
                showToast("A carga horária mínima não pode superar a máxima."); return;
            }
            if (definition.store === "professor" && (record.horasMed < record.horasMin || record.horasMed > record.horasMax)) {
                showToast("A média de horas deve ficar entre o mínimo e o máximo."); return;
            }
            if (definition.store === "disciplina" && !record.areaId) delete record.areaId;
            if (definition.store === "professor" || definition.store === "disciplina") {
                const area = record.areaId ? await db.get("area_academica", record.areaId) : null;
                record.areaNome = area ? area.nome : "Não informada";
            }
            record.updatedAt = new Date().toISOString();
            try {
                if (form.dataset.recordId) {
                    record.id = Number(form.dataset.recordId);
                    record.createdAt = (await db.get(definition.store, record.id))?.createdAt || record.updatedAt;
                    await db.update(definition.store, record);
                    showToast("Registro atualizado com sucesso.");
                } else {
                    record.createdAt = record.updatedAt;
                    await db.add(definition.store, record);
                    showToast("Registro cadastrado com sucesso.");
                }
                location.href = ({ areas: "areas-academicas.html", curriculos: "curriculos.html" }[definition.list] || definition.list + ".html");
            } catch (error) {
                showToast(error.name === "ConstraintError" ? "Já existe um registro com esse código, sigla ou e-mail." : "Não foi possível salvar. Verifique os dados.");
                console.error(error);
            }
        });
    }

    async function startList(pageKey) {
        const storeName = pageToList[pageKey];
        if (!storeName) return;
        const records = await db.all(storeName);
        window.SistemaCrudView.renderTable(pageKey, records);
        const filter = $("#table-filter");
        filter?.addEventListener("input", () => {
            const term = filter.value.toLocaleLowerCase("pt-BR");
            document.querySelectorAll("#table-holder tbody tr").forEach(row => {
                row.hidden = !row.textContent.toLocaleLowerCase("pt-BR").includes(term);
            });
        });
        document.querySelector("#table-holder")?.addEventListener("click", async event => {
            const button = event.target.closest("button[data-action]");
            if (!button) return;
            const id = Number(button.dataset.id);
            if (button.dataset.action === "edit") location.href = listToForm[pageKey] + `?id=${id}`;
            if (button.dataset.action === "delete") {
                if (!confirm("Deseja realmente excluir este registro?")) return;
                try {
                    if (storeName === "area_academica") {
                        const [professores, disciplinas] = await Promise.all([db.all("professor"), db.all("disciplina")]);
                        if (professores.some(item => item.areaId === id) || disciplinas.some(item => item.areaId === id)) {
                            showToast("Esta área está vinculada a professores ou disciplinas e não pode ser excluída."); return;
                        }
                    }
                    if (storeName === "curriculo") {
                        const associations = await db.all("disciplina_curriculo");
                        if (associations.some(item => item.curriculoId === id)) { showToast("Este currículo possui disciplinas vinculadas e não pode ser excluído."); return; }
                    }
                    if (storeName === "curso") {
                        const curriculos = await db.all("curriculo");
                        if (curriculos.some(item => item.cursoId === id)) {
                            showToast("Este curso possui currículos vinculados e não pode ser excluído."); return;
                        }
                    }
                    await db.remove(storeName, id);
                    showToast("Registro excluído.");
                    startList(pageKey);
                } catch (error) { showToast("Não foi possível excluir o registro."); console.error(error); }
            }
        });
    }

    window.SistemaCrudPresenter = { startForm, startList, config };
})();
