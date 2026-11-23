/* Model: camada de persistência. Banco local compartilhado pelas páginas na mesma origem. */
(function () {
    const DATABASE_NAME = "SistemaDisciplinasIFRS";
    const DATABASE_VERSION = 1;
    const STORES = {
        curso: { keyPath: "id", indexes: [{ name: "codigo", keyPath: "codigo", unique: true }] },
        turno: { keyPath: "id", indexes: [{ name: "sigla", keyPath: "sigla", unique: true }] },
        curriculo: { keyPath: "id", indexes: [{ name: "cursoId", keyPath: "cursoId" }] },
        curriculo_turno: { keyPath: "id", indexes: [{ name: "curriculoId", keyPath: "curriculoId" }, { name: "turnoId", keyPath: "turnoId" }] },
        area_academica: { keyPath: "id", indexes: [{ name: "sigla", keyPath: "sigla", unique: true }] },
        disciplina: { keyPath: "id", indexes: [{ name: "codigo", keyPath: "codigo", unique: true }, { name: "areaId", keyPath: "areaId" }] },
        disciplina_curriculo: { keyPath: "id", indexes: [{ name: "disciplinaId", keyPath: "disciplinaId" }, { name: "curriculoId", keyPath: "curriculoId" }] },
        periodo_letivo: { keyPath: "id", indexes: [{ name: "anoTipoNumero", keyPath: ["ano", "tipo", "numero"], unique: true }] },
        turma_ingressante: { keyPath: "id", indexes: [{ name: "curriculoId", keyPath: "curriculoId" }, { name: "periodoId", keyPath: "periodoId" }] },
        turma: { keyPath: "id", indexes: [{ name: "ingressanteId", keyPath: "ingressanteId" }, { name: "periodoId", keyPath: "periodoId" }] },
        oferta_disciplina_turma: { keyPath: "id", indexes: [{ name: "turmaId", keyPath: "turmaId" }, { name: "disciplinaCurriculoId", keyPath: "disciplinaCurriculoId" }] },
        professor: { keyPath: "id", indexes: [{ name: "email", keyPath: "email", unique: true }, { name: "areaId", keyPath: "areaId" }] },
        professor_oferta_disciplina_turma: { keyPath: "id", indexes: [{ name: "professorId", keyPath: "professorId" }, { name: "ofertaId", keyPath: "ofertaId" }] }
    };

    let databasePromise;

    function openDatabase() {
        if (databasePromise) return databasePromise;
        databasePromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
            request.onupgradeneeded = () => {
                const database = request.result;
                Object.entries(STORES).forEach(([storeName, definition]) => {
                    const store = database.objectStoreNames.contains(storeName)
                        ? request.transaction.objectStore(storeName)
                        : database.createObjectStore(storeName, { keyPath: definition.keyPath, autoIncrement: true });
                    definition.indexes.forEach(index => {
                        if (!store.indexNames.contains(index.name)) {
                            store.createIndex(index.name, index.keyPath, { unique: Boolean(index.unique) });
                        }
                    });
                });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error("Feche outras abas do sistema para atualizar a estrutura do banco."));
        });
        return databasePromise;
    }

    async function execute(storeName, mode, action) {
        const database = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            let result;
            try { result = action(store); } catch (error) { reject(error); return; }
            transaction.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
            transaction.onerror = () => reject(transaction.error || (result && result.error));
            transaction.onabort = () => reject(transaction.error || new Error("Operação cancelada."));
        });
    }

    const repository = {
        async all(storeName) {
            const database = await openDatabase();
            return new Promise((resolve, reject) => {
                const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },
        async get(storeName, id) {
            const database = await openDatabase();
            return new Promise((resolve, reject) => {
                const request = database.transaction(storeName, "readonly").objectStore(storeName).get(Number(id));
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        },
        async add(storeName, record) {
            const database = await openDatabase();
            return new Promise((resolve, reject) => {
                const request = database.transaction(storeName, "readwrite").objectStore(storeName).add(record);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },
        async update(storeName, record) {
            const database = await openDatabase();
            return new Promise((resolve, reject) => {
                const request = database.transaction(storeName, "readwrite").objectStore(storeName).put(record);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },
        async remove(storeName, id) {
            const database = await openDatabase();
            return new Promise((resolve, reject) => {
                const request = database.transaction(storeName, "readwrite").objectStore(storeName).delete(Number(id));
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        },
        async clearAll() {
            const database = await openDatabase();
            const names = Object.keys(STORES);
            return new Promise((resolve, reject) => {
                const transaction = database.transaction(names, "readwrite");
                names.forEach(name => transaction.objectStore(name).clear());
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error);
            });
        },
        async exportAll() {
            const result = {};
            for (const name of Object.keys(STORES)) result[name] = await this.all(name);
            return { schemaVersion: DATABASE_VERSION, exportedAt: new Date().toISOString(), data: result };
        }
    };

    window.SistemaDatabase = { open: openDatabase, repository, stores: Object.keys(STORES) };
})();
