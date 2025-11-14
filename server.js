const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Инициализация БД
const db = new sqlite3.Database('./maintenance.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
    } else {
        console.log('Подключение к SQLite базе данных установлено');
        initializeDatabase();
    }
});

// Функция инициализации базы данных
function initializeDatabase() {
    db.serialize(() => {
        // Таблица клиентов
        db.run(`CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            contact_person TEXT,
            phone TEXT,
            email TEXT,
            address TEXT
        )`);

        // Таблица оборудования
        db.run(`CREATE TABLE IF NOT EXISTS equipment (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            model TEXT,
            serial_number TEXT UNIQUE,
            location TEXT,
            client_id INTEGER,
            installation_date DATE,
            last_service DATE,
            next_service DATE,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (client_id) REFERENCES clients (id)
        )`);

        // Таблица запчастей
        db.run(`CREATE TABLE IF NOT EXISTS parts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            part_number TEXT UNIQUE,
            quantity INTEGER,
            min_quantity INTEGER,
            price REAL,
            supplier TEXT,
            category TEXT
        )`);

        // Таблица обслуживания
        db.run(`CREATE TABLE IF NOT EXISTS maintenance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipment_id INTEGER,
            maintenance_date DATE,
            type TEXT,
            description TEXT,
            work_cost REAL DEFAULT 0,
            parts_cost REAL DEFAULT 0,
            technician TEXT,
            status TEXT DEFAULT 'planned',
            duration_hours REAL,
            difficulty TEXT DEFAULT 'medium',
            actual_hours REAL,
            start_time DATETIME,
            end_time DATETIME,
            FOREIGN KEY (equipment_id) REFERENCES equipment (id)
        )`);

        // Таблица заявок на обслуживание
        db.run(`CREATE TABLE IF NOT EXISTS service_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_name TEXT NOT NULL,
            equipment_name TEXT NOT NULL,
            equipment_model TEXT,
            serial_number TEXT,
            problem_description TEXT NOT NULL,
            contact_person TEXT,
            phone TEXT,
            urgency TEXT DEFAULT 'средняя',
            status TEXT DEFAULT 'новая',
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            assigned_technician TEXT,
            solution_description TEXT
        )`);

        // Таблица отчетов
        db.run(`CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            period_start DATE,
            period_end DATE,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            data TEXT,
            file_path TEXT
        )`);

        // Проверяем, есть ли уже тестовые данные
        db.get("SELECT COUNT(*) as count FROM clients", [], (err, row) => {
            if (err) {
                console.error('Ошибка проверки данных:', err);
                return;
            }
            
            if (row.count === 0) {
                console.log('Добавление тестовых данных...');
                insertTestData();
            } else {
                console.log('Тестовые данные уже существуют');
            }
        });
    });
}

// Функция для добавления тестовых данных
function insertTestData() {
    // Тестовые данные клиентов
    const clientsData = [
        ['Завод Металл', 'Иванов А.С.', '+7-999-123-45-67', 'ivanov@zavodmetal.ru', 'ул. Промышленная, 15'],
        ['Завод Деталь', 'Петрова М.И.', '+7-999-765-43-21', 'petrova@zavoddetal.ru', 'ул. Заводская, 28'],
        ['Машиностроительный завод', 'Сидоров В.П.', '+7-999-555-44-33', 'sidorov@mashzavod.ru', 'пр. Технический, 42']
    ];

    const insertClients = () => {
        return new Promise((resolve, reject) => {
            const clientsStmt = db.prepare(`INSERT INTO clients 
                (name, contact_person, phone, email, address) 
                VALUES (?, ?, ?, ?, ?)`);
            
            let completed = 0;
            clientsData.forEach(data => {
                clientsStmt.run(data, (err) => {
                    if (err) console.error('Ошибка добавления клиента:', err);
                    completed++;
                    if (completed === clientsData.length) {
                        clientsStmt.finalize();
                        resolve();
                    }
                });
            });
        });
    };

    // Тестовые данные оборудования
    const equipmentData = [
        ['Токарный станок', 'CNC-100', 'TS001', 'Цех №1', 1, '2023-01-15', '2024-10-01', '2024-12-01'],
        ['Фрезерный станок', 'FM-200', 'FS001', 'Цех №2', 2, '2023-03-20', '2024-10-15', '2025-01-15'],
        ['Пресс гидравлический', 'P-500', 'PR001', 'Цех №3', 3, '2022-11-10', '2024-09-20', '2024-11-20'],
        ['Сверлильный станок', 'DR-150', 'DR001', 'Цех №1', 1, '2023-05-05', '2024-09-10', '2024-11-10']
    ];

    const insertEquipment = () => {
        return new Promise((resolve, reject) => {
            const equipmentStmt = db.prepare(`INSERT INTO equipment 
                (name, model, serial_number, location, client_id, installation_date, last_service, next_service) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            
            let completed = 0;
            equipmentData.forEach(data => {
                equipmentStmt.run(data, (err) => {
                    if (err) console.error('Ошибка добавления оборудования:', err);
                    completed++;
                    if (completed === equipmentData.length) {
                        equipmentStmt.finalize();
                        resolve();
                    }
                });
            });
        });
    };

    // Запчасти
    const partsData = [
        ['Подшипник радиальный', 'BEARING-001', 15, 5, 1200.50, 'ООО ПодшипникСервис', 'механика'],
        ['Ремень ГРМ', 'BELT-002', 8, 10, 850.75, 'ООО РеменьПро', 'механика'],
        ['Датчик температуры', 'SENSOR-003', 3, 5, 2100.00, 'ООО Электроника', 'электроника'],
        ['Масло моторное', 'OIL-004', 25, 10, 450.25, 'ООО Нефтепродукт', 'смазка'],
        ['Фильтр воздушный', 'FILTER-005', 12, 8, 780.00, 'ООО Фильтры', 'фильтры']
    ];

    const insertParts = () => {
        return new Promise((resolve, reject) => {
            const partsStmt = db.prepare(`INSERT INTO parts 
                (name, part_number, quantity, min_quantity, price, supplier, category) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`);
            
            let completed = 0;
            partsData.forEach(data => {
                partsStmt.run(data, (err) => {
                    if (err) console.error('Ошибка добавления запчасти:', err);
                    completed++;
                    if (completed === partsData.length) {
                        partsStmt.finalize();
                        resolve();
                    }
                });
            });
        });
    };

    // Обслуживание
    const maintenanceData = [
        [1, '2024-11-15', 'регламентное', 'Плановое ТО станка', 5000.00, 1200.50, 'Сергеев П.К.', 'completed', 4, 'medium', 4.5],
        [2, '2024-11-18', 'внеплановое', 'Замена датчика температуры', 3000.00, 2100.00, 'Козлов М.С.', 'completed', 3, 'high', 3.5],
        [3, '2024-11-20', 'регламентное', 'Регулировка гидравлики', 4500.00, 0.00, 'Сергеев П.К.', 'completed', 5, 'low', 4.0],
        [1, '2024-11-25', 'регламентное', 'Очередное ТО', 4000.00, 800.00, 'Козлов М.С.', 'in_progress', 4, 'medium', null],
        [4, '2024-11-28', 'внеплановое', 'Ремонт системы охлаждения', 6000.00, 1500.00, 'Сергеев П.К.', 'planned', 6, 'high', null]
    ];

    const insertMaintenance = () => {
        return new Promise((resolve, reject) => {
            const maintenanceStmt = db.prepare(`INSERT INTO maintenance 
                (equipment_id, maintenance_date, type, description, work_cost, parts_cost, technician, status, duration_hours, difficulty, actual_hours) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            
            let completed = 0;
            maintenanceData.forEach(data => {
                maintenanceStmt.run(data, (err) => {
                    if (err) console.error('Ошибка добавления обслуживания:', err);
                    completed++;
                    if (completed === maintenanceData.length) {
                        maintenanceStmt.finalize();
                        resolve();
                    }
                });
            });
        });
    };

    // Тестовые заявки
    const serviceRequestsData = [
        ['Завод Металл', 'Токарный станок', 'CNC-100', 'TS001', 'Не включается двигатель, при запуске слышны щелчки реле', 'Иванов А.С.', '+7-999-123-45-67', 'высокая'],
        ['Завод Деталь', 'Фрезерный станок', 'FM-200', 'FS001', 'Сильный шум и вибрация при работе, требуется диагностика', 'Петрова М.И.', '+7-999-765-43-21', 'средняя'],
        ['Машиностроительный завод', 'Пресс гидравлический', 'P-500', 'PR001', 'Течь масла из гидравлической системы, падение давления', 'Сидоров В.П.', '+7-999-555-44-33', 'критическая']
    ];

    const insertServiceRequests = () => {
        return new Promise((resolve, reject) => {
            const requestsStmt = db.prepare(`INSERT INTO service_requests 
                (client_name, equipment_name, equipment_model, serial_number, problem_description, contact_person, phone, urgency) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

            let completed = 0;
            serviceRequestsData.forEach(data => {
                requestsStmt.run(data, (err) => {
                    if (err) console.error('Ошибка добавления заявки:', err);
                    completed++;
                    if (completed === serviceRequestsData.length) {
                        requestsStmt.finalize();
                        resolve();
                    }
                });
            });
        });
    };

    // Последовательное выполнение вставки данных
    insertClients()
        .then(() => insertEquipment())
        .then(() => insertParts())
        .then(() => insertMaintenance())
        .then(() => insertServiceRequests())
        .then(() => {
            console.log('Тестовые данные успешно добавлены');
        })
        .catch(err => {
            console.error('Ошибка при добавлении тестовых данных:', err);
        });
}

// API маршруты

// План работ на ближайшие 7 дней
app.get('/api/work-plan', (req, res) => {
    const query = `
        SELECT 
            e.name as equipment_name,
            e.model,
            e.serial_number,
            c.name as client_name,
            c.contact_person,
            c.phone,
            m.maintenance_date,
            m.type,
            m.description,
            m.technician,
            m.status,
            m.duration_hours,
            m.difficulty,
            m.actual_hours
        FROM maintenance m
        JOIN equipment e ON m.equipment_id = e.id
        JOIN clients c ON e.client_id = c.id
        WHERE m.maintenance_date >= date('now') 
        AND m.maintenance_date <= date('now', '+7 days')
        ORDER BY m.maintenance_date, m.status
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Ошибка получения плана работ:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Запчасти для пополнения (низкий запас)
app.get('/api/low-stock-parts', (req, res) => {
    const query = `
        SELECT 
            name,
            part_number,
            quantity,
            min_quantity,
            price,
            supplier,
            category,
            (min_quantity - quantity) as need_to_order
        FROM parts 
        WHERE quantity <= min_quantity
        ORDER BY (min_quantity - quantity) DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Ошибка получения запчастей:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получить все заявки на обслуживание
app.get('/api/service-requests', (req, res) => {
    const query = `
        SELECT * FROM service_requests 
        ORDER BY created_date DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Ошибка получения заявок:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получить все оборудование с информацией о клиентах
app.get('/api/equipment', (req, res) => {
    const query = `
        SELECT 
            e.*,
            c.name as client_name,
            c.contact_person,
            c.phone
        FROM equipment e
        JOIN clients c ON e.client_id = c.id
        ORDER BY e.name
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Ошибка получения оборудования:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получить все обслуживание с детальной информацией
app.get('/api/maintenance', (req, res) => {
    const query = `
        SELECT 
            m.*,
            e.name as equipment_name,
            e.model,
            e.serial_number,
            c.name as client_name
        FROM maintenance m
        JOIN equipment e ON m.equipment_id = e.id
        JOIN clients c ON e.client_id = c.id
        ORDER BY m.maintenance_date DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Ошибка получения работ:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получить все запчасти
app.get('/api/parts', (req, res) => {
    db.all("SELECT * FROM parts ORDER BY name", [], (err, rows) => {
        if (err) {
            console.error('Ошибка получения запчастей:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получить всех клиентов
app.get('/api/clients', (req, res) => {
    db.all("SELECT * FROM clients ORDER BY name", [], (err, rows) => {
        if (err) {
            console.error('Ошибка получения клиентов:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// CRUD операции для клиентов
app.post('/api/clients', (req, res) => {
    const { name, contact_person, phone, email, address } = req.body;
    
    const query = `INSERT INTO clients 
        (name, contact_person, phone, email, address) 
        VALUES (?, ?, ?, ?, ?)`;
    
    db.run(query, [name, contact_person, phone, email, address], function(err) {
        if (err) {
            console.error('Ошибка добавления клиента:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: 'Клиент добавлен' });
    });
});

app.put('/api/clients/:id', (req, res) => {
    const { id } = req.params;
    const { name, contact_person, phone, email, address } = req.body;
    
    const query = `UPDATE clients SET 
        name = ?, contact_person = ?, phone = ?, email = ?, address = ? 
        WHERE id = ?`;
    
    db.run(query, [name, contact_person, phone, email, address, id], function(err) {
        if (err) {
            console.error('Ошибка обновления клиента:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Клиент обновлен' });
    });
});

app.delete('/api/clients/:id', (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM clients WHERE id = ?", [id], function(err) {
        if (err) {
            console.error('Ошибка удаления клиента:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Клиент удален' });
    });
});

// CRUD операции для оборудования
app.post('/api/equipment', (req, res) => {
    const { name, model, serial_number, location, client_id, installation_date } = req.body;
    
    const query = `INSERT INTO equipment 
        (name, model, serial_number, location, client_id, installation_date) 
        VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [name, model, serial_number, location, client_id, installation_date], function(err) {
        if (err) {
            console.error('Ошибка добавления оборудования:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: 'Оборудование добавлено' });
    });
});

app.put('/api/equipment/:id', (req, res) => {
    const { id } = req.params;
    const { name, model, serial_number, location, client_id, installation_date } = req.body;
    
    const query = `UPDATE equipment SET 
        name = ?, model = ?, serial_number = ?, location = ?, client_id = ?, 
        installation_date = ?
        WHERE id = ?`;
    
    db.run(query, [name, model, serial_number, location, client_id, installation_date, id], function(err) {
        if (err) {
            console.error('Ошибка обновления оборудования:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Оборудование обновлено' });
    });
});

app.delete('/api/equipment/:id', (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM equipment WHERE id = ?", [id], function(err) {
        if (err) {
            console.error('Ошибка удаления оборудования:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Оборудование удалено' });
    });
});

// CRUD операции для запчастей
app.post('/api/parts', (req, res) => {
    const { name, part_number, quantity, min_quantity, price, supplier, category } = req.body;
    
    const query = `INSERT INTO parts 
        (name, part_number, quantity, min_quantity, price, supplier, category) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [name, part_number, quantity, min_quantity, price, supplier, category], function(err) {
        if (err) {
            console.error('Ошибка добавления запчасти:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: 'Запчасть добавлена' });
    });
});

app.put('/api/parts/:id', (req, res) => {
    const { id } = req.params;
    const { name, part_number, quantity, min_quantity, price, supplier, category } = req.body;
    
    const query = `UPDATE parts SET 
        name = ?, part_number = ?, quantity = ?, min_quantity = ?, 
        price = ?, supplier = ?, category = ? 
        WHERE id = ?`;
    
    db.run(query, [name, part_number, quantity, min_quantity, price, supplier, category, id], function(err) {
        if (err) {
            console.error('Ошибка обновления запчасти:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Запчасть обновлена' });
    });
});

app.delete('/api/parts/:id', (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM parts WHERE id = ?", [id], function(err) {
        if (err) {
            console.error('Ошибка удаления запчасти:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Запчасть удалена' });
    });
});

// CRUD операции для обслуживания
app.post('/api/maintenance', (req, res) => {
    const { equipment_id, maintenance_date, type, description, work_cost, parts_cost, technician, duration_hours, difficulty } = req.body;
    
    const query = `INSERT INTO maintenance 
        (equipment_id, maintenance_date, type, description, work_cost, parts_cost, technician, duration_hours, difficulty) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [equipment_id, maintenance_date, type, description, work_cost || 0, parts_cost || 0, technician, duration_hours, difficulty], function(err) {
        if (err) {
            console.error('Ошибка добавления работы:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: 'Работа добавлена' });
    });
});

app.put('/api/maintenance/:id', (req, res) => {
    const { id } = req.params;
    const { equipment_id, maintenance_date, type, description, work_cost, parts_cost, technician, status, duration_hours, difficulty, actual_hours } = req.body;
    
    const query = `UPDATE maintenance SET 
        equipment_id = ?, maintenance_date = ?, type = ?, description = ?, 
        work_cost = ?, parts_cost = ?, technician = ?, status = ?, duration_hours = ?, difficulty = ?, actual_hours = ?
        WHERE id = ?`;
    
    db.run(query, [equipment_id, maintenance_date, type, description, work_cost || 0, parts_cost || 0, technician, status, duration_hours, difficulty, actual_hours, id], function(err) {
        if (err) {
            console.error('Ошибка обновления работы:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Работа обновлена' });
    });
});

app.delete('/api/maintenance/:id', (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM maintenance WHERE id = ?", [id], function(err) {
        if (err) {
            console.error('Ошибка удаления работы:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Работа удалена' });
    });
});

// Запустить работу (старт таймера)
app.put('/api/maintenance/:id/start', (req, res) => {
    const { id } = req.params;
    const startTime = new Date().toISOString();
    
    db.run("UPDATE maintenance SET start_time = ?, status = 'in_progress' WHERE id = ?", [startTime, id], function(err) {
        if (err) {
            console.error('Ошибка запуска работы:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Работа начата', start_time: startTime });
    });
});

// Завершить работу (стоп таймера)
app.put('/api/maintenance/:id/complete', (req, res) => {
    const { id } = req.params;
    const endTime = new Date().toISOString();
    
    // Сначала получаем данные о работе
    db.get("SELECT start_time, duration_hours FROM maintenance WHERE id = ?", [id], (err, row) => {
        if (err) {
            console.error('Ошибка получения данных работы:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        
        let actualHours = row.duration_hours;
        if (row.start_time) {
            const start = new Date(row.start_time);
            const end = new Date(endTime);
            actualHours = (end - start) / (1000 * 60 * 60); // Разница в часах
        }
        
        db.run("UPDATE maintenance SET end_time = ?, actual_hours = ?, status = 'completed' WHERE id = ?", 
               [endTime, actualHours.toFixed(2), id], function(err) {
            if (err) {
                console.error('Ошибка завершения работы:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ 
                message: 'Работа завершена', 
                end_time: endTime, 
                actual_hours: actualHours.toFixed(2) 
            });
        });
    });
});

// Операции для заявок
app.post('/api/service-requests', (req, res) => {
    const { 
        client_name, 
        equipment_name, 
        equipment_model,
        serial_number,
        problem_description,
        contact_person, 
        phone,
        urgency 
    } = req.body;
    
    const query = `INSERT INTO service_requests 
        (client_name, equipment_name, equipment_model, serial_number, problem_description, contact_person, phone, urgency) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [client_name, equipment_name, equipment_model, serial_number, problem_description, contact_person, phone, urgency], function(err) {
        if (err) {
            console.error('Ошибка создания заявки:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: 'Заявка создана успешно' });
    });
});

app.put('/api/service-requests/:id/assign', (req, res) => {
    const { id } = req.params;
    const { technician } = req.body;
    
    db.run("UPDATE service_requests SET assigned_technician = ?, status = 'в работе' WHERE id = ?", [technician, id], function(err) {
        if (err) {
            console.error('Ошибка назначения техника:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Техник назначен' });
    });
});

app.put('/api/service-requests/:id/solution', (req, res) => {
    const { id } = req.params;
    const { solution_description } = req.body;
    
    db.run("UPDATE service_requests SET solution_description = ?, status = 'решена' WHERE id = ?", [solution_description, id], function(err) {
        if (err) {
            console.error('Ошибка добавления решения:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Решение добавлено' });
    });
});

app.delete('/api/service-requests/:id', (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM service_requests WHERE id = ?", [id], function(err) {
        if (err) {
            console.error('Ошибка удаления заявки:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Заявка удалена' });
    });
});

// Отчеты
app.get('/api/reports/maintenance', (req, res) => {
    const { startDate, endDate } = req.query;
    
    const query = `
        SELECT 
            m.maintenance_date,
            e.name as equipment_name,
            e.model,
            c.name as client_name,
            m.type,
            m.description,
            m.technician,
            m.work_cost,
            m.parts_cost,
            (COALESCE(m.work_cost, 0) + COALESCE(m.parts_cost, 0)) as total_cost,
            m.duration_hours,
            m.actual_hours,
            m.difficulty,
            m.status
        FROM maintenance m
        JOIN equipment e ON m.equipment_id = e.id
        JOIN clients c ON e.client_id = c.id
        WHERE m.maintenance_date BETWEEN ? AND ?
        ORDER BY m.maintenance_date DESC
    `;

    db.all(query, [startDate || '2024-01-01', endDate || '2024-12-31'], (err, rows) => {
        if (err) {
            console.error('Ошибка формирования отчета:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Сохранить отчет
app.post('/api/reports', (req, res) => {
    const { name, type, period_start, period_end, data } = req.body;
    
    const query = `INSERT INTO reports 
        (name, type, period_start, period_end, data) 
        VALUES (?, ?, ?, ?, ?)`;
    
    db.run(query, [name, type, period_start, period_end, JSON.stringify(data)], function(err) {
        if (err) {
            console.error('Ошибка сохранения отчета:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: 'Отчет сохранен' });
    });
});

// Получить все отчеты
app.get('/api/reports', (req, res) => {
    db.all("SELECT * FROM reports ORDER BY created_date DESC", [], (err, rows) => {
        if (err) {
            console.error('Ошибка получения отчетов:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        // Парсим JSON данные
        rows.forEach(row => {
            if (row.data) {
                try {
                    row.data = JSON.parse(row.data);
                } catch (e) {
                    console.error('Ошибка парсинга данных отчета:', e);
                    row.data = null;
                }
            }
        });
        res.json(rows);
    });
});

// Скачать отчет в формате текста
app.get('/api/reports/:id/download', (req, res) => {
    const { id } = req.params;
    
    db.get("SELECT * FROM reports WHERE id = ?", [id], (err, row) => {
        if (err) {
            console.error('Ошибка получения отчета:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row) {
            res.status(404).json({ error: 'Отчет не найден' });
            return;
        }
        
        let reportContent = `ОТЧЕТ: ${row.name}\n`;
        reportContent += `Тип: ${row.type}\n`;
        reportContent += `Период: ${row.period_start} - ${row.period_end}\n`;
        reportContent += `Дата создания: ${row.created_date}\n\n`;
        
        if (row.data) {
            try {
                const data = JSON.parse(row.data);
                data.forEach(item => {
                    reportContent += `Оборудование: ${item.equipment_name}\n`;
                    reportContent += `Клиент: ${item.client_name}\n`;
                    reportContent += `Дата: ${item.maintenance_date}\n`;
                    reportContent += `Стоимость: ${item.total_cost} руб.\n`;
                    reportContent += `---\n`;
                });
                
                // Добавляем итоги
                const totalCost = data.reduce((sum, item) => sum + (item.total_cost || 0), 0);
                reportContent += `\nИТОГО: ${data.length} работ, Общая стоимость: ${totalCost.toFixed(2)} руб.`;
            } catch (e) {
                reportContent += `Ошибка обработки данных отчета: ${e.message}`;
            }
        }
        
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=report-${id}.txt`);
        res.send(reportContent);
    });
});

// Статистика для главной страницы
app.get('/api/dashboard/stats', (req, res) => {
    const queries = {
        totalEquipment: "SELECT COUNT(*) as count FROM equipment",
        activeMaintenance: "SELECT COUNT(*) as count FROM maintenance WHERE status IN ('planned', 'in_progress')",
        lowStockParts: "SELECT COUNT(*) as count FROM parts WHERE quantity <= min_quantity",
        completedThisMonth: `SELECT COUNT(*) as count FROM maintenance 
                           WHERE status = 'completed' 
                           AND strftime('%Y-%m', maintenance_date) = strftime('%Y-%m', 'now')`,
        newRequests: "SELECT COUNT(*) as count FROM service_requests WHERE status = 'новая'"
    };

    const results = {};
    let completed = 0;
    let totalQueries = 5;

    function checkCompletion() {
        if (completed === totalQueries) {
            res.json(results);
        }
    }

    db.get(queries.totalEquipment, [], (err, row) => {
        if (!err && row) results.totalEquipment = row.count;
        completed++;
        checkCompletion();
    });

    db.get(queries.activeMaintenance, [], (err, row) => {
        if (!err && row) results.activeMaintenance = row.count;
        completed++;
        checkCompletion();
    });

    db.get(queries.lowStockParts, [], (err, row) => {
        if (!err && row) results.lowStockParts = row.count;
        completed++;
        checkCompletion();
    });

    db.get(queries.completedThisMonth, [], (err, row) => {
        if (!err && row) results.completedThisMonth = row.count;
        completed++;
        checkCompletion();
    });

    db.get(queries.newRequests, [], (err, row) => {
        if (!err && row) results.newRequests = row.count;
        completed++;
        checkCompletion();
    });
});

// Стартовая страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Обработка ошибок
process.on('uncaughtException', (err) => {
    console.error('Необработанное исключение:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Необработанный промис:', promise, 'причина:', reason);
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 API доступно по адресу http://localhost:3000/api`);
});