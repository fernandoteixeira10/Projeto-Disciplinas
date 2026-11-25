/* Motor genérico IndexedDB: esquema, normalização, validação, FKs e exclusão referencial. */
(function () {
    const DATABASE_NAME = "SistemaDisciplinasIFRS";
    const DATABASE_VERSION = 3;
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
            result.push({ name: Array.isArray(keyPath) ? keyPath.join("+") : keyPath, keyPath, unique: unique && !Array.isArray(keyPath) });
        });
        return result;
    }

    function openDatabase() {
        if (databasePromise) return databasePromise;
        databasePromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
            request.onupgradeneeded = () => {
                const database = request.result;
                for (const [name, table] of Object.entries(esquema)) {
                    const store = database.objectStoreNames.contains(name)
                        ? request.transaction.objectStore(name)
                        : database.createObjectStore(name, { keyPath: "id", autoIncrement: true });
                    for (const index of indexDefinitions(table)) {
                        if (!store.indexNames.contains(index.name)) {
                            try { store.createIndex(index.name, index.keyPath, { unique: index.unique }); }
                            catch (error) { console.error(`Índice ${name}.${index.name} não criado:`, error); }
                        }
                    }
                }
            };
            request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); resolve(db); };
            request.onerror = () => { databasePromise = null; reject(request.error); };
            request.onblocked = () => reject(new Error("Feche outras abas do sistema para atualizar a estrutura do banco."));
        });
        return databasePromise;
    }

    function normalizeRecord(storeName, input) {
        const table = esquema[storeName];
        if (!table) fail(`Tabela desconhecida: ${storeName}.`);
        const record = { ...input };
        for (const [name, field] of Object.entries(table.campos || {})) {
            let value = record[name];
            if ((value === undefined || value === null || value === "") && Object.hasOwn(field, "padrao")) value = field.padrao;
            if (value === undefined || value === null || value === "") {
                if (!field.opcional && !Object.hasOwn(field, "padrao")) fail(`O campo ${name} é obrigatório em ${table.rotulo}.`);
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
                fail(`Não existe registro relacionado em ${field.tabela} para o campo ${fieldName}.`, "ReferentialIntegrityError");
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
                fail(`Já existe ${table.rotulo} com a mesma combinação de ${fields.join(", ")}.`, "ConstraintError");
            }
        }
    }

    async function save(storeName, input, isUpdate) {
        return withTransaction(async context => {
            const record = normalizeRecord(storeName, input);
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
        });
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
