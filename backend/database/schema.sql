CREATE DATABASE IF NOT EXISTS feuerwehr_checkliste;
USE feuerwehr_checkliste;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('benutzer', 'geraetewart') NOT NULL DEFAULT 'benutzer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  username VARCHAR(80) NOT NULL,
  vehicle_key VARCHAR(50) NOT NULL,
  vehicle_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS checklist_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  item_key VARCHAR(80) NOT NULL,
  item_label VARCHAR(200) NOT NULL,
  status ENUM('ok', 'defekt') NOT NULL,
  comment_text TEXT,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS defects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  item_key VARCHAR(80) NOT NULL,
  item_label VARCHAR(200) NOT NULL,
  description_text TEXT NOT NULL,
  priority ENUM('niedrig', 'mittel', 'kritisch') NOT NULL,
  timestamp DATETIME NOT NULL,
  username VARCHAR(80) NOT NULL,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);
