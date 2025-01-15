CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL
);

CREATE TABLE statistics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    kills INT NOT NULL,
    date DATE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO users (username, password, first_name, last_name)
VALUES
    ('user1', 'password1', 'John', 'Doe'),
    ('user2', 'password2', 'Jane', 'Smith'),
    ('user3', 'password3', 'Alice', 'Johnson');

INSERT INTO statistics (user_id, kills, date)
VALUES
    (1, 5, '2025-01-01'),
    (1, 10, '2025-01-02'),
    (2, 3, '2025-01-01'),
    (3, 7, '2025-01-03');

SELECT * FROM users;
SELECT * FROM statistics;
