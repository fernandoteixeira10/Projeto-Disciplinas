/* Esquema declarativo do domínio acadêmico. O motor interpreta estes metadados. */
(function () {
    const texto = (opcoes = {}) => ({ tipo: "texto", ...opcoes });
    const numero = (opcoes = {}) => ({ tipo: "numero", ...opcoes });
    const data = (opcoes = {}) => ({ tipo: "data", ...opcoes });
    const opcao = (valores, opcoes = {}) => ({ tipo: "opcao", valores, ...opcoes });
    const fk = (tabela, opcoes = {}) => ({ tipo: "fk", tabela, ...opcoes });

    const esquema = {
        curso: { rotulo: "curso", campos: { codigo: texto({ unico: true }), nome: texto(), nivel: opcao(["emi", "sub", "gra", "pos", "mes", "dou"]) } },
        turno: { rotulo: "turno", campos: { sigla: texto({ unico: true }), nome: texto(), descricao: texto({ opcional: true }) } },
        area_academica: { rotulo: "área acadêmica", campos: { sigla: texto({ unico: true }), nome: texto(), descricao: texto({ opcional: true }) } },
        curriculo: { rotulo: "currículo", campos: {
            curso_id: fk("curso"), area_id: fk("area_academica", { opcional: true }),
            ano_inicial: numero({ opcional: true, inteiro: true, minimo: 1900 }), semestre_inicial: numero({ opcional: true, inteiro: true, minimo: 0, maximo: 2 }),
            ano_final: numero({ opcional: true, inteiro: true, minimo: 1900 }), semestre_final: numero({ opcional: true, inteiro: true, minimo: 0, maximo: 2 }),
            periodicidade_ingresso: texto({ opcional: true }), periodicidade_curricular: texto({ opcional: true }),
            total_periodos: numero({ opcional: true, inteiro: true, positivo: true }), duracao_aula: numero({ opcional: true, positivo: true }),
            situacao: texto({ opcional: true }), turnos: { tipo: "lista", opcional: true }
        } },
        curriculo_turno: { rotulo: "turno do currículo", campos: { curriculo_id: fk("curriculo", { dono: true }), turno_id: fk("turno", { dono: true }) }, indices: [{ campos: ["curriculo_id", "turno_id"], unico: true }] },
        disciplina: { rotulo: "disciplina", campos: { codigo: texto({ unico: true }), nome: texto(), aulas_semana: numero({ opcional: true, minimo: 0 }), total_aulas: numero({ opcional: true, minimo: 0 }), area_id: fk("area_academica", { opcional: true }) } },
        disciplina_curriculo: { rotulo: "disciplina do currículo", campos: { disciplina_id: fk("disciplina", { dono: true }), curriculo_id: fk("curriculo", { dono: true }), periodo: numero({ opcional: true, inteiro: true, minimo: 0 }) }, indices: [{ campos: ["disciplina_id", "curriculo_id", "periodo"], unico: true }] },
        periodo_letivo: { rotulo: "período letivo", campos: { ano: numero({ inteiro: true, minimo: 1900 }), tipo: opcao(["ano", "semestre", "trimestre", "bimestre"], { opcional: true }), numero: numero({ opcional: true, inteiro: true, positivo: true }) }, indices: [{ campos: ["ano", "tipo", "numero"], unico: true }] },
        turma_ingressante: { rotulo: "turma ingressante", campos: { curriculo_id: fk("curriculo"), periodo_id: fk("periodo_letivo", { opcional: true }), turno_id: fk("turno", { opcional: true }), numero: numero({ opcional: true, inteiro: true, positivo: true }), situacao: texto({ opcional: true }) }, indices: [{ campos: ["curriculo_id", "periodo_id", "turno_id", "numero"], unico: true }] },
        turma: { rotulo: "turma", campos: { ingressante_id: fk("turma_ingressante"), periodo_id: fk("periodo_letivo"), numero: numero({ opcional: true, inteiro: true, positivo: true }), fase: numero({ opcional: true, inteiro: true, minimo: 0 }) }, indices: [{ campos: ["ingressante_id", "periodo_id", "numero"], unico: true }] },
        oferta_disciplina_turma: { rotulo: "oferta de disciplina", campos: { turma_id: fk("turma"), disciplina_curriculo_id: fk("disciplina_curriculo"), situacao: texto({ opcional: true }) }, indices: [{ campos: ["turma_id", "disciplina_curriculo_id"], unico: true }] },
        professor: { rotulo: "professor", campos: { nome: texto(), sobrenome: texto(), nome_abreviado: texto(), email: texto({ unico: true }), area_id: fk("area_academica", { opcional: true }), horas_min: numero({ opcional: true, minimo: 0 }), horas_max: numero({ opcional: true, minimo: 0 }), horas_med: numero({ opcional: true, minimo: 0 }), observacoes: texto({ opcional: true }) } },
        professor_oferta_disciplina_turma: { rotulo: "alocação de professor", campos: { professor_id: fk("professor", { dono: true }), oferta_id: fk("oferta_disciplina_turma", { dono: true }), aulas: numero({ opcional: true, minimo: 0 }) }, indices: [{ campos: ["professor_id", "oferta_id"], unico: true }] }
    };
    const obter = async (t, tabela, id) => id == null ? null : t.get(tabela, Number(id));
    esquema.curriculo.antesDeSalvar = async (t, r) => {
        if (!await obter(t, "curso", r.curso_id)) throw new Error("Todo currículo precisa estar vinculado a um curso válido.");
        if (!Array.isArray(r.turnos) || !r.turnos.length) throw new Error("Selecione ao menos um turno para o currículo.");
        function periodoCompleto(ano, semestre, nome) {
            if (ano == null && semestre == null) return null;
            if (ano == null || semestre == null) {
                throw new Error(`Preencha o ano e o semestre do período ${nome} do currículo, ou deixe ambos vazios.`);
            }
            return [ano, semestre];
        }
        const inicial = periodoCompleto(r.ano_inicial, r.semestre_inicial, "inicial");
        const final = periodoCompleto(r.ano_final, r.semestre_final, "final");
        if (!inicial && final) throw new Error("Informe o período inicial antes de preencher o período final.");
        // Ano inteiro (0) abrange os dois semestres: início em 1 e término em 2.
        // O zero permanece armazenado no registro; só os limites são usados na comparação.
        if (inicial && final) {
            const inicio = inicial[0] * 2 + (inicial[1] === 0 ? 1 : inicial[1]);
            const fim = final[0] * 2 + (final[1] === 0 ? 2 : final[1]);
            if (fim < inicio) throw new Error("O período final não pode ser anterior ao inicial. Confira os anos e semestres do currículo.");
        }
        if (r.total_periodos != null && r.total_periodos < 1) throw new Error("O currículo precisa ter ao menos um período.");
    };
    esquema.professor.antesDeSalvar = (t, r) => {
        if (r.horas_min != null && r.horas_max != null && r.horas_min > r.horas_max) throw new Error("A carga horária mínima do professor não pode ser maior que a máxima.");
        if (r.horas_med != null && r.horas_min != null && r.horas_med < r.horas_min) throw new Error("A carga horária média do professor não pode ser menor que a mínima.");
        if (r.horas_med != null && r.horas_max != null && r.horas_med > r.horas_max) throw new Error("A carga horária média do professor não pode ser maior que a máxima.");
    };
    esquema.disciplina_curriculo.antesDeSalvar = async (t, r) => {
        const curriculo = await obter(t, "curriculo", r.curriculo_id);
        if (!curriculo) throw new Error("Currículo não encontrado.");
        if (r.periodo == null || !Number.isInteger(Number(r.periodo)) || Number(r.periodo) < 0) throw new Error("Informe um período curricular válido (zero ou maior).");
        if (curriculo.total_periodos != null && r.periodo > curriculo.total_periodos) throw new Error("O período da disciplina ultrapassa o total de períodos do currículo.");
    };
    esquema.turma_ingressante.antesDeSalvar = async (t, r) => {
        const curriculo = await obter(t, "curriculo", r.curriculo_id);
        if (!curriculo) throw new Error("Currículo da turma ingressante não encontrado.");
        if (r.turno_id != null && Array.isArray(curriculo.turnos) && !curriculo.turnos.map(String).includes(String(r.turno_id))) {
            const turno = await obter(t, "turno", r.turno_id);
            const sigla = turno?.sigla;
            if (!curriculo.turnos.map(String).includes(String(sigla))) throw new Error("O turno selecionado não está habilitado no currículo.");
        }
    };
    esquema.turma.antesDeSalvar = async (t, r) => {
        const ingresso = await obter(t, "turma_ingressante", r.ingressante_id);
        if (!ingresso) throw new Error("Turma ingressante não encontrada.");
        const curriculo = await obter(t, "curriculo", ingresso.curriculo_id);
        if (r.fase != null && (r.fase < 0 || (curriculo?.total_periodos != null && r.fase > curriculo.total_periodos))) throw new Error("A fase da turma precisa estar entre zero e o total de períodos do currículo.");
    };
    esquema.oferta_disciplina_turma.antesDeSalvar = async (t, r) => {
        const turma = await obter(t, "turma", r.turma_id);
        const vinculo = await obter(t, "disciplina_curriculo", r.disciplina_curriculo_id);
        const ingresso = turma ? await obter(t, "turma_ingressante", turma.ingressante_id) : null;
        if (!turma || !vinculo || !ingresso) throw new Error("Turma ou vínculo curricular inválido para a oferta.");
        if (Number(ingresso.curriculo_id) !== Number(vinculo.curriculo_id)) throw new Error("A disciplina não pertence ao currículo da turma.");
        if (Number(vinculo.periodo) !== 0 && Number(vinculo.periodo) !== Number(turma.fase)) throw new Error("A disciplina não corresponde à fase atual da turma.");
    };
    esquema.professor_oferta_disciplina_turma.antesDeSalvar = async (t, r, anterior) => {
        const professor = await obter(t, "professor", r.professor_id);
        if (!professor) throw new Error("Professor não encontrado.");
        const alocacoes = await t.all("professor_oferta_disciplina_turma");
        const total = alocacoes.filter(x => Number(x.professor_id) === Number(r.professor_id) && Number(x.id) !== Number(anterior?.id)).reduce((s, x) => s + Number(x.aulas || 0), 0) + Number(r.aulas || 0);
        if (professor.horas_max != null && total > Number(professor.horas_max)) throw new Error(`Esta alocação ultrapassa a carga máxima do professor. Limite: ${professor.horas_max}; total com a nova alocação: ${total}. Revise a quantidade de aulas.`);
    };
    window.SistemaSchema = { esquema, helpers: { texto, numero, data, opcao, fk } };
})();


/* Motor genérico IndexedDB: esquema, normalização, validação, FKs e exclusão referencial. */
(function () {
    const DATABASE_NAME = "SistemaDisciplinasIFRS";
    const DATABASE_VERSION = 5;
    const esquema = window.SistemaSchema.esquema;
    const storeNames = Object.keys(esquema);
    let databasePromise;

    const requestResult = request => new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Falha na operação IndexedDB."));
    });
    const transactionDone = transaction => new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("Transação não concluída."));
        transaction.onabort = () => reject(transaction.error || new Error("Transação cancelada."));
    });
    const fail = (message, name = "ValidationError") => { const error = new Error(message); error.name = name; throw error; };

    function indexDefinitions(table) {
        const result = [];
        Object.entries(table.campos || {}).forEach(([name, field]) => {
            if (field.tipo === "fk" || field.unico) result.push({ name, keyPath: name, unique: Boolean(field.unico) });
        });
        (table.indices || []).forEach(definition => {
            const keyPath = typeof definition === "string" || Array.isArray(definition) ? definition : definition.campos;
            const unique = typeof definition === "object" && !Array.isArray(definition) && Boolean(definition.unico);
            result.push({ name: Array.isArray(keyPath) ? keyPath.join("+") : keyPath, keyPath, unique });
        });
        return result;
    }

    function openDatabase() {
        if (databasePromise) return databasePromise;
        databasePromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
            let erroMigracao;
            request.onupgradeneeded = event => {
                const database = request.result;
                for (const [name, table] of Object.entries(esquema)) {
                    const store = database.objectStoreNames.contains(name)
                        ? request.transaction.objectStore(name)
                        : database.createObjectStore(name, { keyPath: "id", autoIncrement: true });
                    // Recria índices incompatíveis. A atualização inteira é revertida se houver duplicatas.
                    const atualizarIndices = () => {
                        const leitura = store.getAll();
                        leitura.onsuccess = () => {
                            try {
                                for (const index of indexDefinitions(table)) {
                                    if (index.unique) {
                                        const campos = Array.isArray(index.keyPath) ? index.keyPath : [index.keyPath];
                                        const vistos = new Set();
                                        for (const row of leitura.result) {
                                            const valores = campos.map(c => row[c]);
                                            if (valores.some(v => v == null)) continue;
                                            const chave = JSON.stringify(valores);
                                            if (vistos.has(chave)) throw new Error(`Atualização cancelada: duplicidade em ${table.rotulo} (${campos.join(", ")}). Abra a versão anterior do aplicativo compatível com o banco existente (estrutura ${event.oldVersion}), exporte um backup e corrija os registros duplicados antes de tentar atualizar para a estrutura ${DATABASE_VERSION}. Nenhum registro foi apagado.`);
                                            vistos.add(chave);
                                        }
                                    }
                                    if (store.indexNames.contains(index.name)) {
                                        const anterior = store.index(index.name);
                                        if (anterior.unique === index.unique && JSON.stringify(anterior.keyPath) === JSON.stringify(index.keyPath)) continue;
                                        store.deleteIndex(index.name);
                                    }
                                    store.createIndex(index.name, index.keyPath, { unique: index.unique });
                                }
                            } catch (error) {
                                erroMigracao = error;
                                request.transaction.abort();
                            }
                        };
                    };
                    if (event.oldVersion > 0 && event.oldVersion < 4) {
                        const conversoes = {'cursoId': 'curso_id', 'areaId': 'area_id', 'anoInicial': 'ano_inicial', 'semestreInicial': 'semestre_inicial', 'anoFinal': 'ano_final', 'semestreFinal': 'semestre_final', 'periodicidadeIngresso': 'periodicidade_ingresso', 'periodicidadeCurricular': 'periodicidade_curricular', 'totalPeriodos': 'total_periodos', 'duracaoAula': 'duracao_aula', 'aulasSemana': 'aulas_semana', 'totalAulas': 'total_aulas', 'curriculoId': 'curriculo_id', 'turnoId': 'turno_id', 'disciplinaId': 'disciplina_id', 'periodoId': 'periodo_id', 'ingressanteId': 'ingressante_id', 'turmaId': 'turma_id', 'disciplinaCurriculoId': 'disciplina_curriculo_id', 'professorId': 'professor_id', 'ofertaId': 'oferta_id', 'nomeAbreviado': 'nome_abreviado', 'horasMin': 'horas_min', 'horasMax': 'horas_max', 'horasMed': 'horas_med', 'areaNome': 'area_nome', 'cursoNome': 'curso_nome', 'cursoCodigo': 'curso_codigo', 'curriculoLabel': 'curriculo_label', 'periodoInicial': 'periodo_inicial', 'periodoFinal': 'periodo_final', 'createdAt': 'created_at', 'updatedAt': 'updated_at'};
                        const cursorRequest = store.openCursor();
                        cursorRequest.onsuccess = event => {
                            const cursor = event.target.result;
                            if (!cursor) { atualizarIndices(); return; }
                            const row = cursor.value;
                            for (const [antigo, novo] of Object.entries(conversoes)) if (Object.hasOwn(row, antigo)) { row[novo] = row[antigo]; delete row[antigo]; }
                            cursor.update(row); cursor.continue();
                        };
                    } else { atualizarIndices(); }
                }
            };
            request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); resolve(db); };
            request.onerror = () => { databasePromise = null; reject(erroMigracao || request.error); };
            request.onblocked = () => reject(new Error("Feche outras abas do sistema para atualizar a estrutura do banco."));
        });
        return databasePromise;
    }

    const CAMPOS_LEGADOS = {'cursoId':'curso_id','areaId':'area_id','anoInicial':'ano_inicial','semestreInicial':'semestre_inicial','anoFinal':'ano_final','semestreFinal':'semestre_final','periodicidadeIngresso':'periodicidade_ingresso','periodicidadeCurricular':'periodicidade_curricular','totalPeriodos':'total_periodos','duracaoAula':'duracao_aula','aulasSemana':'aulas_semana','totalAulas':'total_aulas','curriculoId':'curriculo_id','turnoId':'turno_id','disciplinaId':'disciplina_id','periodoId':'periodo_id','ingressanteId':'ingressante_id','turmaId':'turma_id','disciplinaCurriculoId':'disciplina_curriculo_id','professorId':'professor_id','ofertaId':'oferta_id','nomeAbreviado':'nome_abreviado','horasMin':'horas_min','horasMax':'horas_max','horasMed':'horas_med','areaNome':'area_nome','cursoNome':'curso_nome','cursoCodigo':'curso_codigo','curriculoLabel':'curriculo_label','periodoInicial':'periodo_inicial','periodoFinal':'periodo_final','createdAt':'created_at','updatedAt':'updated_at'};
    function normalizeRecord(storeName, input, { permitirCursoLegado = false } = {}) {
        const table = esquema[storeName];
        if (!table) fail(`Tabela desconhecida: ${storeName}.`);
        const record = { ...input };
        for (const [legado, canonico] of Object.entries(CAMPOS_LEGADOS)) if (Object.hasOwn(record, legado) && !Object.hasOwn(record, canonico)) { record[canonico] = record[legado]; delete record[legado]; }
        for (const [name, field] of Object.entries(table.campos || {})) {
            let value = record[name];
            if (typeof value === "string") value = value.trim();
            if ((value === undefined || value === null || value === "") && Object.hasOwn(field, "padrao")) value = field.padrao;
            if (value === undefined || value === null || value === "") {
                if (!field.opcional && !Object.hasOwn(field, "padrao")) {
                    if (permitirCursoLegado && storeName === "curso" && name === "nivel") { record[name] = null; continue; }
                    fail(name === "nivel" && storeName === "curso" ? "Selecione o nível do curso." : `O campo ${name} é obrigatório em ${table.rotulo}.`);
                }
                if (field.tipo === "texto" && value == null) value = "";
                else if (field.tipo !== "texto" && field.tipo !== "lista") value = null;
            }
            if (value !== null && value !== undefined && value !== "") {
                if (field.tipo === "texto") {
                    if (typeof value !== "string") fail(`O campo ${name} deve ser texto.`);
                    value = value.trim();
                    if (!field.opcional && !value) fail(`O campo ${name} é obrigatório.`);
                } else if (field.tipo === "numero") {
                    value = Number(value);
                    if (!Number.isFinite(value)) fail(`O campo ${name} deve ser numérico.`);
                    if (field.inteiro && !Number.isInteger(value)) fail(`O campo ${name} deve ser inteiro.`);
                    if (field.positivo && value <= 0) fail(`O campo ${name} deve ser maior que zero.`);
                    if (field.minimo != null && value < field.minimo) fail(`O campo ${name} deve ser no mínimo ${field.minimo}.`);
                    if (field.maximo != null && value > field.maximo) fail(`O campo ${name} deve ser no máximo ${field.maximo}.`);
                } else if (field.tipo === "opcao" && !field.valores.includes(value)) fail(`Valor inválido para ${name}.`);
                else if (field.tipo === "fk") {
                    value = Number(value);
                    if (!Number.isInteger(value) || value <= 0) fail(`Referência inválida no campo ${name}.`);
                } else if (field.tipo === "lista" && !Array.isArray(value)) fail(`O campo ${name} deve ser uma lista.`);
            }
            record[name] = value;
        }
        return record;
    }

    async function withTransaction(callback) {
        const database = await openDatabase();
        const transaction = database.transaction(storeNames, "readwrite");
        const done = transactionDone(transaction);
        const context = {
            get: (store, id) => requestResult(transaction.objectStore(store).get(id)),
            all: store => requestResult(transaction.objectStore(store).getAll()),
            add: (store, record) => requestResult(transaction.objectStore(store).add(record)),
            put: (store, record) => requestResult(transaction.objectStore(store).put(record)),
            delete: (store, key) => requestResult(transaction.objectStore(store).delete(key))
        };
        try {
            const result = await callback(context);
            await done;
            return result;
        } catch (error) {
            try { transaction.abort(); } catch (_) {}
            await done.catch(() => {});
            throw error;
        }
    }

    async function validateReferences(context, storeName, record) {
        for (const [fieldName, field] of Object.entries(esquema[storeName].campos || {})) {
            const id = record[fieldName];
            if (field.tipo === "fk" && id != null && !(await context.get(field.tabela, id))) {
                fail(`O registro de ${esquema[field.tabela].rotulo} selecionado não existe mais. Atualize a seleção e tente novamente.`, "ReferentialIntegrityError");
            }
        }
    }

    async function validateUnique(context, storeName, record, currentId) {
        const table = esquema[storeName];
        const all = await context.all(storeName);
        for (const [fieldName, field] of Object.entries(table.campos || {})) {
            if (!field.unico || record[fieldName] == null || record[fieldName] === "") continue;
            if (all.some(item => item.id !== currentId && String(item[fieldName]).toLocaleLowerCase("pt-BR") === String(record[fieldName]).toLocaleLowerCase("pt-BR"))) {
                fail(`Já existe ${table.rotulo} com ${fieldName} '${record[fieldName]}'.`, "ConstraintError");
            }
        }
        for (const definition of table.indices || []) {
            if (!definition || Array.isArray(definition) || typeof definition !== "object" || !definition.unico) continue;
            const fields = definition.campos || [];
            if (!fields.length || fields.some(field => record[field] === undefined)) continue;
            if (all.some(item => item.id !== currentId && fields.every(field => item[field] === record[field]))) {
                if (storeName === "professor_oferta_disciplina_turma") fail("Este professor já está alocado nesta oferta.", "ConstraintError");
                fail(`Já existe um registro de ${table.rotulo} com esses mesmos dados. Confira a listagem antes de cadastrar novamente.`, "ConstraintError");
            }
        }
    }

    async function saveInContext(context, storeName, input, isUpdate, opcoes) {
            const record = normalizeRecord(storeName, input, opcoes);
            const currentId = isUpdate ? Number(record.id) : null;
            if (isUpdate && (!currentId || !(await context.get(storeName, currentId)))) fail("Registro não encontrado.", "NotFoundError");
            await validateReferences(context, storeName, record);
            await validateUnique(context, storeName, record, currentId);
            const hook = esquema[storeName].antesDeSalvar;
            if (hook) await hook(context, record, isUpdate ? await context.get(storeName, currentId) : undefined);
            const key = isUpdate ? await context.put(storeName, record) : await context.add(storeName, record);
            const after = esquema[storeName].depoisDeSalvar;
            if (after) await after(context, record, key);
            return key;
    }

    async function save(storeName, input, isUpdate) {
        return withTransaction(context => saveInContext(context, storeName, input, isUpdate));
    }

    async function removeWithRules(context, storeName, id, visited = new Set()) {
        const token = `${storeName}:${id}`;
        if (visited.has(token)) return;
        visited.add(token);
        const record = await context.get(storeName, id);
        if (!record) return false;
        const hook = esquema[storeName].antesDeExcluir;
        if (hook) await hook(context, record);
        for (const [childName, childTable] of Object.entries(esquema)) {
            for (const [fieldName, field] of Object.entries(childTable.campos || {})) {
                if (field.tipo !== "fk" || field.tabela !== storeName) continue;
                const children = (await context.all(childName)).filter(item => Number(item[fieldName]) === Number(id));
                if (!children.length) continue;
                if (field.dono) {
                    for (const child of children) await removeWithRules(context, childName, child.id, visited);
                } else {
                    fail(`Não é possível excluir ${esquema[storeName].rotulo}: existem registros vinculados em ${childTable.rotulo}.`, "ReferentialIntegrityError");
                }
            }
        }
        await context.delete(storeName, id);
        return true;
    }

    const repository = {
        all: async store => { const db = await openDatabase(); return requestResult(db.transaction(store, "readonly").objectStore(store).getAll()); },
        get: async (store, id) => { const db = await openDatabase(); return (await requestResult(db.transaction(store, "readonly").objectStore(store).get(Number(id)))) || null; },
        add: (store, record) => save(store, record, false),
        update: (store, record) => save(store, record, true),
        save: (store, record) => save(store, record, record.id != null),
        remove: (store, id) => withTransaction(context => removeWithRules(context, store, Number(id))),
        clearAll: async () => withTransaction(async context => { for (const name of storeNames) for (const item of await context.all(name)) await context.delete(name, item.id); }),
        transacao: operacao => withTransaction(context => operacao({
            all: context.all, get: context.get,
            salvar: async (store, record) => saveInContext(context, store, record, record.id != null),
            excluir: (store, id) => removeWithRules(context, store, Number(id)),
            limpar: async () => { for (const name of storeNames) for (const item of await context.all(name)) await context.delete(name, item.id); }
        })),
        importarTudo: data => withTransaction(async context => {
            for (const name of storeNames) for (const item of await context.all(name)) await context.delete(name, item.id);
            const ordem = ["curso","turno","area_academica","periodo_letivo","curriculo","disciplina","professor","curriculo_turno","disciplina_curriculo","turma_ingressante","turma","oferta_disciplina_turma","professor_oferta_disciplina_turma"];
            for (const name of ordem) for (const row of (data[name] || [])) await saveInContext(context, name, row, false, { permitirCursoLegado: true });
            return true;
        }),
        exportAll: async () => {
            const db = await openDatabase();
            const tx = db.transaction(storeNames, "readonly");
            const result = {};
            await Promise.all(storeNames.map(async name => { result[name] = await requestResult(tx.objectStore(name).getAll()); }));
            return { system: DATABASE_NAME, schemaVersion: DATABASE_VERSION, exportedAt: new Date().toISOString(), data: result };
        }
    };

    window.SistemaDatabase = { open: openDatabase, repository, stores: storeNames, schema: esquema, version: DATABASE_VERSION };
})();
