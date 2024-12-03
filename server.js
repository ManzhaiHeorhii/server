// server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const db = require("./db");

const app = express();
const SECRET_KEY = "your_secret_key";

app.use(bodyParser.json());
app.use(cors());
const multer = require("multer");
const path = require("path");
app.use(express.static(path.join(__dirname, "client/build")));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Маршрут для авторизації
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    db.get(
        "SELECT * FROM Users WHERE username = ? AND password = ?",
        [username, password],
        (err, user) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Internal server error" });
            }

            if (!user) {
                return res.status(401).json({ message: "Invalid credentials" });
            }
            console.log(user);
            // Генеруємо токен з роллю користувача
            const token = jwt.sign({ username: user.username, role: user.role, id: user.user_id }, SECRET_KEY, { expiresIn: "1h" });
            res.json({ token });
        }
    );
});

app.get("/api/groups", (req, res) => {
    const teacherId = req.query.teacher_id; // Отримуємо ID викладача з параметрів запиту
    if (!teacherId) {
        return res.status(400).json({ message: "Teacher ID is required" });
    }

    const sql = "SELECT * FROM Groups WHERE teacher_id = ?";
    db.all(sql, [teacherId], (err, rows) => {
        if (err) {
            console.error("Error fetching groups:", err);
            return res.status(500).json({ message: "Internal server error" });
        }
        res.json(rows); // Повертаємо лише групи, прив'язані до викладача
    });
});
app.get("/api/students", (req, res) => {
    const groupId = req.query.group_id;

    if (!groupId) {
        return res.status(400).json({ message: "Group ID is required" });
    }

    const sql = `SELECT u.user_id, u.username, u.role
    FROM Users u
    JOIN Group_Students gs ON u.user_id = gs.student_id
    WHERE gs.group_id = ? AND u.role = 'student';`;
    db.all(sql, [groupId], (err, rows) => {
        if (err) {
            console.error("Error fetching students:", err);
            return res.status(500).json({ message: "Internal server error" });
        }
        res.json(rows);
    });
});


app.post("/api/groups", (req, res) => {
    const { group_name, teacher_id } = req.body;

    if (!group_name || !teacher_id) {
        return res.status(400).json({ message: "Group name and teacher ID are required" });
    }

    const sql = "INSERT INTO Groups (group_name, teacher_id) VALUES (?, ?)";
    db.run(sql, [group_name, teacher_id], function (err) {
        if (err) {
            console.error("Error adding group:", err);
            return res.status(500).json({ message: "Internal server error" });
        }

        res.json({ group_id: this.lastID, group_name, teacher_id });
    });
});

// Маршрут для редагування групи
app.put("/api/groups/:id", (req, res) => {
    const groupId = req.params.id;
    const { group_name } = req.body;

    if (!group_name) {
        return res.status(400).json({ message: "Group name is required" });
    }

    const sql = "UPDATE Groups SET group_name = ? WHERE group_id = ?";
    db.run(sql, [group_name, groupId], function (err) {
        if (err) {
            console.error("Error updating group:", err);
            return res.status(500).json({ message: "Internal server error" });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: "Group not found" });
        }

        res.json({ message: "Group updated successfully" });
    });
});

// Маршрут для видалення групи
app.delete("/api/groups/:id", (req, res) => {
    const groupId = req.params.id;

    const sql = "DELETE FROM Groups WHERE group_id = ?";
    db.run(sql, [groupId], function (err) {
        if (err) {
            console.error("Error deleting group:", err);
            return res.status(500).json({ message: "Internal server error" });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: "Group not found" });
        }

        res.json({ message: "Group deleted successfully" });
    });
});


app.get("/api/courses", (req, res) => {
    const teacherId = req.query.teacher_id;

    if (!teacherId) {
        return res.status(400).json({ message: "Teacher ID is required" });
    }

    const sql = "SELECT * FROM Courses WHERE teacher_id = ?";
    db.all(sql, [teacherId], (err, rows) => {
        if (err) {
            console.error("Error fetching courses:", err);
            return res.status(500).json({ message: "Internal server error" });
        }

        res.json(rows);
    });
});




// Налаштування для завантаження файлів
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({ storage });

// Маршрут для завантаження файлів
app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

app.get("/api/tasks", (req, res) => {
    const courseId = req.query.course_id;

    if (!courseId) {
        return res.status(400).json({ message: "Course ID is required" });
    }

    const sql = "SELECT * FROM Tasks WHERE course_id = ?";
    db.all(sql, [courseId], (err, rows) => {
        if (err) {
            console.error("Error fetching tasks:", err);
            return res.status(500).json({ message: "Internal server error" });
        }

        // Розпарсити поле task_content для кожного завдання
        const tasks = rows.map((row) => ({
            task_id: row.task_id,
            course_id: row.course_id,
            task_content: JSON.parse(row.task_content), // Розпарсуємо JSON
        }));

        res.json(tasks);
    });
});

app.post("/api/tasks", (req, res) => {
    const { course_id, task_content } = req.body;
    console.log(course_id, task_content);
    if (!course_id || !task_content) {
        return res.status(400).json({ message: "Course ID and task content are required" });
    }

    const sql = "INSERT INTO Tasks (course_id, task_content) VALUES (?, ?)";
    db.run(sql, [course_id, task_content], function (err) {
        if (err) {
            console.error("Error inserting task:", err);
            return res.status(500).json({ message: "Internal server error" });
        }

        res.json({ task_id: this.lastID, course_id, task_content });
    });
});


const fs = require("fs");

app.put("/api/tasks/:id", (req, res) => {
    const taskId = req.params.id;
    const { task_content } = req.body;

    if (!task_content) {
        return res.status(400).json({ message: "Task content is required" });
    }

    const sqlSelect = "SELECT task_content FROM Tasks WHERE task_id = ?";
    db.get(sqlSelect, [taskId], (err, row) => {
        if (err) {
            console.error("Error fetching task:", err);
            return res.status(500).json({ message: "Internal server error" });
        }

        if (!row) {
            return res.status(404).json({ message: "Task not found" });
        }

        // Парсимо існуючий контент для отримання URL старого медіафайлу
        const existingTaskContent = JSON.parse(row.task_content);
        const oldMediaPath = existingTaskContent.media
            ? path.join(__dirname, "uploads", path.basename(existingTaskContent.media))
            : null;

        const sqlUpdate = "UPDATE Tasks SET task_content = ? WHERE task_id = ?";
        db.run(sqlUpdate, [JSON.stringify(task_content), taskId], function (updateErr) {
            if (updateErr) {
                console.error("Error updating task:", updateErr);
                return res.status(500).json({ message: "Internal server error" });
            }

            if (this.changes === 0) {
                return res.status(404).json({ message: "Task not updated" });
            }

            // Видаляємо старий медіафайл, якщо новий медіафайл був переданий
            if (oldMediaPath && task_content.media !== existingTaskContent.media) {
                fs.unlink(oldMediaPath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error("Error deleting old media file:", unlinkErr);
                        // Не завершуємо запит помилкою, якщо файл не вдалося видалити
                    }
                });
            }

            res.json({ message: "Task updated successfully" });
        });
    });
});

app.delete("/api/tasks/:id", (req, res) => {
    const taskId = req.params.id;

    const sqlSelect = "SELECT task_content FROM Tasks WHERE task_id = ?";
    db.get(sqlSelect, [taskId], (err, row) => {
        if (err) {
            console.error("Error fetching task:", err);
            return res.status(500).json({ message: "Internal server error" });
        }

        if (!row) {
            return res.status(404).json({ message: "Task not found" });
        }

        // Витягуємо URL медіафайлу
        const taskContent = JSON.parse(row.task_content);
        const mediaPath = taskContent.media
            ? path.join(__dirname, "uploads", path.basename(taskContent.media))
            : null;

        const sqlDelete = "DELETE FROM Tasks WHERE task_id = ?";
        db.run(sqlDelete, [taskId], function (deleteErr) {
            if (deleteErr) {
                console.error("Error deleting task:", deleteErr);
                return res.status(500).json({ message: "Internal server error" });
            }

            if (this.changes === 0) {
                return res.status(404).json({ message: "Task not deleted" });
            }

            // Видалення медіафайлу, якщо він існує
            if (mediaPath) {
                fs.unlink(mediaPath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error("Error deleting media file:", unlinkErr);
                        // Не завершуємо запит помилкою, якщо файл не вдалося видалити
                    }
                });
            }

            res.json({ message: "Task deleted successfully" });
        });
    });
});

app.post("/api/assignments", (req, res) => {
    const { group_id, course_id } = req.body;

    if (!group_id || !course_id) {
        return res.status(400).json({ message: "Group ID and Course ID are required" });
    }

    const sql = "INSERT INTO Group_Course_Assignments (group_id, course_id) VALUES (?, ?)";
    db.run(sql, [group_id, course_id], function (err) {
        if (err) {
            console.error("Error assigning group to course:", err);
            return res.status(500).json({ message: "Internal server error" });
        }

        res.json({ message: "Group assigned to course successfully" });
    });
});


app.get("/api/student/courses", (req, res) => {
    const { student_id } = req.query;

    if (!student_id) {
        return res.status(400).json({ message: "Student ID is required" });
    }

    const sql = `
        SELECT c.course_id, c.course_name
        FROM Courses c
                 JOIN Group_Course_Assignments gca ON c.course_id = gca.course_id
                 JOIN Group_Students gs ON gca.group_id = gs.group_id
        WHERE gs.student_id = ?
    `;
    db.all(sql, [student_id], (err, rows) => {
        if (err) {
            console.error("Error fetching courses:", err);
            return res.status(500).json({ message: "Internal server error" });
        }
        res.json(rows);
    });
});

app.get("/api/student/available-courses", (req, res) => {
    const { student_id } = req.query;

    if (!student_id) {
        return res.status(400).json({ message: "Student ID is required." });
    }

    const sql = `
        SELECT c.course_id, c.course_name
        FROM Courses c
        LEFT JOIN Completed_Courses cc ON c.course_id = cc.course_id AND cc.student_id = ?
        WHERE cc.course_id IS NULL
    `;

    db.all(sql, [student_id], (err, rows) => {
        if (err) {
            console.error("Error fetching available courses:", err);
            return res.status(500).json({ message: "Internal server error." });
        }
        console.log(rows);
        res.json(rows);
    });
});

app.post("/api/student/complete-course", (req, res) => {
    const { student_id, course_id } = req.body;
    console.log(course_id);
    console.log(student_id);
    if (!student_id || !course_id) {
        return res.status(400).json({ message: "Student ID and Course ID are required." });
    }

    const sql = `
        INSERT INTO Completed_Courses (student_id, course_id)
        VALUES (?, ?)
    `;

    db.run(sql, [student_id, course_id], function (err) {
        if (err) {
            console.error("Error marking course as completed:", err);
            return res.status(500).json({ message: "Internal server error." });
        }

        res.json({ message: "Course marked as completed successfully." });
    });
});


app.get("/api/student/tasks", (req, res) => {
    const { course_id } = req.query;

    if (!course_id) {
        return res.status(400).json({ message: "Course ID is required" });
    }

    const sql = "SELECT * FROM Tasks WHERE course_id = ?";
    db.all(sql, [course_id], (err, rows) => {
        if (err) {
            console.error("Error fetching tasks:", err);
            return res.status(500).json({ message: "Internal server error" });
        }

        const tasks = rows.map((row) => ({
            task_id: row.task_id,
            course_id: row.course_id,
            task_content: JSON.parse(row.task_content), // Розпарсуємо JSON
        }));

        res.json(tasks);
    });
});

app.post("/api/student/submissions", (req, res) => {
    const { submissions } = req.body;
    const studentId = req.query.student_id; // Отримуємо ID студента

    if (!Array.isArray(submissions) || submissions.length === 0) {
        return res.status(400).json({ message: "Submissions are required." });
    }

    if (!studentId) {
        return res.status(400).json({ message: "Student ID is required." });
    }

    const sql = `
        INSERT INTO Student_Task_Submissions (task_id, student_id, submission_content)
        VALUES (?, ?, ?)
    `;

    db.serialize(() => {
        db.run("BEGIN TRANSACTION", (err) => {
            if (err) {
                console.error("Error starting transaction:", err);
                return res.status(500).json({ message: "Failed to start transaction." });
            }

            submissions.forEach(({ task_id, submission_content }, index) => {
                db.run(sql, [task_id, studentId, submission_content], (err) => {
                    if (err) {
                        console.error("Error inserting submission:", err);
                        db.run("ROLLBACK", () => {
                            return res.status(500).json({ message: "Failed to save submissions." });
                        });
                    }

                    // Якщо всі запити виконані, завершуємо транзакцію
                    if (index === submissions.length - 1) {
                        db.run("COMMIT", (err) => {
                            if (err) {
                                console.error("Error committing transaction:", err);
                                return res.status(500).json({ message: "Failed to commit transaction." });
                            }
                            res.json({ message: "Submissions saved successfully." });
                        });
                    }
                });
            });
        });
    });
});


app.get("/api/teacher/audition", (req, res) => {
    const { teacher_id } = req.query;

    if (!teacher_id) {
        return res.status(400).json({ message: "Teacher ID is required." });
    }

    const sql = `
        SELECT
            g.group_id,
            g.group_name,
            c.course_id,
            c.course_name,
            COUNT(DISTINCT gs.student_id) AS total_students,
            COUNT(DISTINCT cc.student_id) AS completed_students
        FROM Groups g
                 JOIN Group_Students gs ON g.group_id = gs.group_id
                 JOIN Group_Course_Assignments gca ON g.group_id = gca.group_id
                 JOIN Courses c ON gca.course_id = c.course_id
                 LEFT JOIN Completed_Courses cc
                           ON gs.student_id = cc.student_id
                               AND gca.course_id = cc.course_id
        WHERE g.teacher_id = ?
        GROUP BY g.group_id, c.course_id;
    `;

    db.all(sql, [teacher_id], (err, rows) => {
        if (err) {
            console.error("Error fetching audition data:", err);
            return res.status(500).json({ message: "Internal server error." });
        }
        res.json(rows);
    });
});

app.get("/api/teacher/submissions", (req, res) => {
    const { group_id, course_id } = req.query;

    if (!group_id || !course_id) {
        return res.status(400).json({ message: "Group ID and Course ID are required." });
    }

    const sql = `
        SELECT
            gs.student_id,
            u.username AS name,
            COUNT(DISTINCT sts.submission_id) AS submission_count,
            SUM(CASE WHEN sts.grade IS NULL THEN 1 ELSE 0 END) AS ungraded_count
        FROM
            Group_Students gs
                LEFT JOIN
            Users u ON gs.student_id = u.user_id
                LEFT JOIN
            Student_Task_Submissions sts ON gs.student_id = sts.student_id
                LEFT JOIN
            Tasks t ON sts.task_id = t.task_id AND t.course_id = ?
        WHERE
            gs.group_id = ?
        GROUP BY
            gs.student_id, u.username;
    `;

    db.all(sql, [course_id, group_id], (err, rows) => {
        if (err) {
            console.error("Error fetching submissions:", err);
            return res.status(500).json({ message: "Internal server error." });
        }

        res.json(rows);
    });
});





app.get("/api/teacher/review-tasks", (req, res) => {
    const { student_id, course_id } = req.query;

    if (!student_id || !course_id) {
        return res.status(400).json({ message: "Student ID and Course ID are required." });
    }
    console.log(JSON.stringify(student_id));
    console.log(JSON.stringify(course_id));
    const sql = `
        SELECT
            t.task_id,
            t.task_content,
            sts.submission_content
        FROM
            Tasks t
                JOIN
            Student_Task_Submissions sts ON t.task_id = sts.task_id
        WHERE
            sts.student_id = ? AND t.course_id = ?;
    `;

    db.all(sql, [student_id, course_id], (err, rows) => {
        if (err) {
            console.error("Error fetching review tasks:", err);
            return res.status(500).json({ message: "Internal server error." });
        }

        res.json(rows);
    });
});



app.post("/api/teacher/submit-grades", (req, res) => {
    const { student_id, grades } = req.body;

    const sql = `
        UPDATE Student_Task_Submissions
        SET grade = ?
        WHERE task_id = ? AND student_id = ?;
    `;

    db.serialize(() => {
        Object.entries(grades).forEach(([task_id, grade]) => {
            db.run(sql, [grade, task_id, student_id], (err) => {
                if (err) {
                    console.error("Error updating grades:", err);
                    return res.status(500).json({ message: "Failed to update grades." });
                }
            });
        });
        res.json({ message: "Grades submitted successfully." });
    });
});

app.get("/api/teacher/statistics", (req, res) => {
    const { group_id } = req.query;

    const sql = `
        SELECT 
            u.user_id AS student_id,
            u.username AS name,
            ROUND(AVG(sts.grade), 2) AS average_grade
        FROM 
            Group_Students gs
        JOIN 
            Users u ON gs.student_id = u.user_id
        LEFT JOIN 
            Student_Task_Submissions sts ON gs.student_id = sts.student_id
        WHERE 
            gs.group_id = ?
        GROUP BY 
            u.user_id, u.username;
    `;

    db.all(sql, [group_id], (err, rows) => {
        if (err) {
            console.error("Error fetching statistics:", err);
            return res.status(500).json({ message: "Internal server error." });
        }

        res.json(rows);
    });
});
app.get("/api/teacher/groups", (req, res) => {
    const { teacher_id } = req.query;

    const sql = `
        SELECT group_id, group_name
        FROM Groups
        WHERE teacher_id = ?
    `;

    db.all(sql, [teacher_id], (err, rows) => {
        if (err) {
            console.error("Error fetching groups:", err);
            return res.status(500).json({ message: "Internal server error." });
        }
console.log(JSON.stringify(rows));
        res.json(rows);
    });
});


// Захищений маршрут
app.get("/api/protected", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        res.json({ message: "This is a protected route", user: decoded });
    } catch (err) {
        res.status(403).json({ message: "Forbidden" });
    }
});

app.get("/api/student/grades", (req, res) => {
    const { student_id } = req.query;

    if (!student_id) {
        return res.status(400).json({ message: "Student ID is required." });
    }

    const sql = `
        SELECT 
            c.course_id,
            c.course_name,
            ROUND(AVG(sts.grade), 2) AS average_grade,
            t.task_id,
            t.task_content,
            sts.grade
        FROM 
            Completed_Courses cc
        JOIN 
            Courses c ON cc.course_id = c.course_id
        LEFT JOIN 
            Tasks t ON t.course_id = c.course_id
        LEFT JOIN 
            Student_Task_Submissions sts ON t.task_id = sts.task_id AND sts.student_id = cc.student_id
        WHERE 
            cc.student_id = ?
        GROUP BY 
            c.course_id, t.task_id;
    `;

    db.all(sql, [student_id], (err, rows) => {
        if (err) {
            console.error("Error fetching grades:", err);
            return res.status(500).json({ message: "Internal server error." });
        }

        const courses = rows.reduce((acc, row) => {
            let course = acc.find((c) => c.course_id === row.course_id);
            if (!course) {
                course = {
                    course_id: row.course_id,
                    course_name: row.course_name,
                    average_grade: row.average_grade,
                    tasks: [],
                };
                acc.push(course);
            }
            if (row.task_id) {
                course.tasks.push({
                    task_id: row.task_id,
                    name: JSON.parse(row.task_content).name,
                    description: JSON.parse(row.task_content).description,
                    grade: row.grade,
                });
            }
            return acc;
        }, []);

        res.json(courses);
    });
});


app.get("/api/admin/accounts", (req, res) => {
    const sql = `SELECT user_id, username, role FROM Users`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching accounts:", err);
            return res.status(500).json({ message: "Internal server error." });
        }
        res.json(rows);
    });
});


app.post("/api/admin/accounts", (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ message: "All fields are required." });
    }

    const sql = `INSERT INTO Users (username, password, role) VALUES (?, ?, ?)`;
    db.run(sql, [username, password, role], function (err) {
        if (err) {
            console.error("Error adding user:", err);
            return res.status(500).json({ message: "Internal server error." });
        }
        res.json({ user_id: this.lastID, username, role });
    });
});

app.delete("/api/admin/accounts/:id", (req, res) => {
    const { id } = req.params;

    const sql = `DELETE FROM Users WHERE user_id = ?`;
    db.run(sql, [id], function (err) {
        if (err) {
            console.error("Error deleting user:", err);
            return res.status(500).json({ message: "Internal server error." });
        }
        res.json({ message: "User deleted successfully." });
    });
});


app.get("/api/admin/groups", (req, res) => {
    const sql = `
        SELECT g.group_id, g.group_name, u.username AS teacher_name
        FROM Groups g
                 LEFT JOIN Users u ON g.teacher_id = u.user_id
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching groups:", err);
            return res.status(500).json({ message: "Internal server error." });
        }
        console.log(rows);
        res.json(rows);
    });
});


app.post("/api/admin/assign-student", (req, res) => {
    const { group_id, student_id } = req.body;

    if (!group_id || !student_id) {
        return res.status(400).json({ message: "Group ID and Student ID are required." });
    }

    const sql = `INSERT INTO Group_Students (group_id, student_id) VALUES (?, ?)`;
    db.run(sql, [group_id, student_id], function (err) {
        if (err) {
            console.error("Error assigning student to group:", err);
            return res.status(500).json({ message: "Internal server error." });
        }
        res.json({ message: "Student assigned to group successfully." });
    });
});


app.get("/api/admin/teachers", (req, res) => {
    const sql = `SELECT user_id, username FROM Users WHERE role = 'teacher'`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching teachers:", err);
            return res.status(500).json({ message: "Internal server error." });
        }
        res.json(rows);
    });
});

app.post("/api/admin/groups", (req, res) => {
    const { group_name, teacher_id } = req.body;

    if (!group_name || !teacher_id) {
        return res.status(400).json({ message: "Group name and teacher ID are required." });
    }

    const sql = `INSERT INTO Groups (group_name, teacher_id) VALUES (?, ?)`;
    db.run(sql, [group_name, teacher_id], function (err) {
        if (err) {
            console.error("Error creating group:", err);
            return res.status(500).json({ message: "Internal server error." });
        }
        res.json({ group_id: this.lastID, group_name, teacher_id });
    });
});


// app.post("/api/admin/assign-student", (req, res) => {
//     const { group_id, student_id } = req.body;
//
//     if (!group_id || !student_id) {
//         return res.status(400).json({ message: "Group ID and Student ID are required." });
//     }
//
//     const sql = `INSERT INTO Group_Students (group_id, student_id) VALUES (?, ?)`;
//     db.run(sql, [group_id, student_id], function (err) {
//         if (err) {
//             console.error("Error assigning student to group:", err);
//             return res.status(500).json({ message: "Internal server error." });
//         }
//         res.json({ message: "Student assigned successfully." });
//     });
// });
app.get("/api/admin/students", (req, res) => {
    const sql = `SELECT user_id, username FROM Users WHERE role = 'student'`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Error fetching students:", err);
            return res.status(500).json({ message: "Internal server error." });
        }
        res.json(rows);
    });
});

app.get("/api/admin/group-students", (req, res) => {
    const { group_id } = req.query;

    if (!group_id) {
        return res.status(400).json({ message: "Group ID is required." });
    }

    const sql = `
        SELECT u.user_id, u.username
        FROM Group_Students gs
        JOIN Users u ON gs.student_id = u.user_id
        WHERE gs.group_id = ?
    `;

    db.all(sql, [group_id], (err, rows) => {
        if (err) {
            console.error("Error fetching students in group:", err);
            return res.status(500).json({ message: "Internal server error." });
        }
        res.json(rows);
    });
});



app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client/build", "index.html"));
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

//app.listen(5000, () => console.log("Server running on http://localhost:5000"));
