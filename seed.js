// seed.js
const db = require("./db");
const sqlStatements = `
-- Таблиця користувачів
CREATE TABLE IF NOT EXISTS Users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('teacher', 'student'))
);

-- Таблиця курсів
CREATE TABLE IF NOT EXISTS Courses (
    course_id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_name TEXT NOT NULL,
    teacher_id INTEGER NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES Users (user_id)
);

-- Таблиця груп
CREATE TABLE IF NOT EXISTS Groups (
    group_id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name TEXT NOT NULL,
    teacher_id INTEGER NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES Users (user_id)
);

-- Таблиця студентів у групах
CREATE TABLE IF NOT EXISTS Group_Students (
    group_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    PRIMARY KEY (group_id, student_id),
    FOREIGN KEY (group_id) REFERENCES Groups (group_id),
    FOREIGN KEY (student_id) REFERENCES Users (user_id)
);

-- Таблиця завдань
CREATE TABLE IF NOT EXISTS Tasks (
    task_id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_content TEXT NOT NULL,
    course_id INTEGER NOT NULL,
    FOREIGN KEY (course_id) REFERENCES Courses (course_id)
);

-- Таблиця виконання завдань студентами
CREATE TABLE IF NOT EXISTS Student_Task_Submissions (
    submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    submission_content TEXT NOT NULL,
    grade INTEGER CHECK (grade >= 0 AND grade <= 100),
    FOREIGN KEY (task_id) REFERENCES Tasks (task_id),
    FOREIGN KEY (student_id) REFERENCES Users (user_id)
);

-- Таблиця призначення курсів групам
CREATE TABLE IF NOT EXISTS Group_Course_Assignments (
    group_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    PRIMARY KEY (group_id, course_id),
    FOREIGN KEY (group_id) REFERENCES Groups (group_id),
    FOREIGN KEY (course_id) REFERENCES Courses (course_id)
);
`;
const insertStatements = `
-- Додавання вчителя
INSERT INTO Users (username, password, role) VALUES ('teacher', 'te123', 'teacher');

-- Додавання студентів
INSERT INTO Users (username, password, role) VALUES 
    ('student1', 'st123', 'student'),
    ('student2', 'st123', 'student'),
    ('student3', 'st123', 'student'),
    ('student4', 'st123', 'student');

-- Додавання груп
INSERT INTO Groups (group_name, teacher_id) VALUES 
    ('Group A', (SELECT user_id FROM Users WHERE username = 'teacher')),
    ('Group B', (SELECT user_id FROM Users WHERE username = 'teacher'));

-- Прив'язка студентів до груп
INSERT INTO Group_Students (group_id, student_id) VALUES 
    ((SELECT group_id FROM Groups WHERE group_name = 'Group A'), (SELECT user_id FROM Users WHERE username = 'student1')),
    ((SELECT group_id FROM Groups WHERE group_name = 'Group A'), (SELECT user_id FROM Users WHERE username = 'student2')),
    ((SELECT group_id FROM Groups WHERE group_name = 'Group B'), (SELECT user_id FROM Users WHERE username = 'student3')),
    ((SELECT group_id FROM Groups WHERE group_name = 'Group B'), (SELECT user_id FROM Users WHERE username = 'student4'));
`;
const insertStatements2 = `
-- Додавання ще одного вчителя
INSERT INTO Users (username, password, role) VALUES ('teacher2', 'te456', 'teacher');

-- Прив'язка груп до вчителів
UPDATE Groups
SET teacher_id = (SELECT user_id FROM Users WHERE username = 'teacher')
WHERE group_name = 'Group A';

UPDATE Groups
SET teacher_id = (SELECT user_id FROM Users WHERE username = 'teacher2')
WHERE group_name = 'Group B';
`;
const insCourses = `
INSERT INTO Courses (course_name, teacher_id)
VALUES
    ('A1', (SELECT user_id FROM Users WHERE username = 'teacher2')),
    ('A2', (SELECT user_id FROM Users WHERE username = 'teacher2'));

-- Прив'язка Group B до курсів A1 і A2
INSERT INTO Group_Course_Assignments (group_id, course_id)
VALUES
    ((SELECT group_id FROM Groups WHERE group_name = 'Group B'), 
     (SELECT course_id FROM Courses WHERE course_name = 'A1')),
    ((SELECT group_id FROM Groups WHERE group_name = 'Group B'), 
     (SELECT course_id FROM Courses WHERE course_name = 'A2'));`;

db.exec(insCourses, (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Teacher added and groups reassigned successfully.');
    }
});

// Закриття з'єднання з базою даних
db.close((err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Closed the database connection.');
});


