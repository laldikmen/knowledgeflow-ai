-- KnowledgeFlow AI MVP PostgreSQL schema
-- Run this file against the `knowledgeflow` database.

BEGIN;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    system_role VARCHAR(50) NOT NULL DEFAULT 'member'
        CHECK (system_role IN ('admin', 'member')),
    account_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    department_name VARCHAR(150),
    description TEXT,
    created_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,
    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    project_role VARCHAR(50) NOT NULL
        CHECK (project_role IN ('manager', 'contributor', 'viewer')),
    added_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, user_id)
);

CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,
    uploaded_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    document_type VARCHAR(50),
    s3_key TEXT NOT NULL,
    s3_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded'
        CHECK (status IN ('uploaded', 'processing', 'processed', 'failed')),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_texts (
    id SERIAL PRIMARY KEY,
    document_id INTEGER UNIQUE NOT NULL
        REFERENCES documents(id)
        ON DELETE CASCADE,
    extracted_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_summaries (
    id SERIAL PRIMARY KEY,
    document_id INTEGER UNIQUE NOT NULL
        REFERENCES documents(id)
        ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    review_status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (review_status IN ('draft', 'confirmed', 'rejected')),
    created_by_ai BOOLEAN NOT NULL DEFAULT TRUE,
    ai_confidence DECIMAL(4,3)
        CHECK (ai_confidence IS NULL OR ai_confidence BETWEEN 0 AND 1),
    reviewed_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE decisions (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL
        REFERENCES documents(id)
        ON DELETE CASCADE,
    decision_text TEXT NOT NULL,
    source_excerpt TEXT,
    review_status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (review_status IN ('draft', 'confirmed', 'rejected')),
    created_by_ai BOOLEAN NOT NULL DEFAULT TRUE,
    ai_confidence DECIMAL(4,3)
        CHECK (ai_confidence IS NULL OR ai_confidence BETWEEN 0 AND 1),
    reviewed_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE action_items (
    id SERIAL PRIMARY KEY,
    document_id INTEGER
        REFERENCES documents(id)
        ON DELETE CASCADE,
    project_id INTEGER NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,
    task_title VARCHAR(255) NOT NULL,
    description TEXT,
    source_excerpt TEXT,
    suggested_owner_text VARCHAR(150),
    assigned_to_user_id INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,
    deadline DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'draft'
        CHECK (
            status IN (
                'draft',
                'confirmed',
                'in_progress',
                'completed',
                'cancelled',
                'rejected'
            )
        ),
    risk_level VARCHAR(50) NOT NULL DEFAULT 'low'
        CHECK (risk_level IN ('low', 'medium', 'high')),
    created_by_ai BOOLEAN NOT NULL DEFAULT TRUE,
    ai_confidence DECIMAL(4,3)
        CHECK (ai_confidence IS NULL OR ai_confidence BETWEEN 0 AND 1),
    reviewed_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_note TEXT,
    completed_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,
    completed_at TIMESTAMP,
    completion_note TEXT,
    cancelled_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,
    cancelled_at TIMESTAMP,
    cancel_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_status_history (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL
        REFERENCES action_items(id)
        ON DELETE CASCADE,
    previous_status VARCHAR(50)
        CHECK (
            previous_status IS NULL
            OR previous_status IN (
                'draft',
                'confirmed',
                'in_progress',
                'completed',
                'cancelled',
                'rejected'
            )
        ),
    new_status VARCHAR(50) NOT NULL
        CHECK (
            new_status IN (
                'draft',
                'confirmed',
                'in_progress',
                'completed',
                'cancelled',
                'rejected'
            )
        ),
    changed_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,
    change_note TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,
    user_id INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sources_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_project_members_user
    ON project_members(user_id);

CREATE INDEX idx_project_members_project
    ON project_members(project_id);

CREATE INDEX idx_documents_project
    ON documents(project_id);

CREATE INDEX idx_action_items_project
    ON action_items(project_id);

CREATE INDEX idx_action_items_assignee
    ON action_items(assigned_to_user_id);

CREATE INDEX idx_action_items_status
    ON action_items(status);

CREATE INDEX idx_action_items_deadline
    ON action_items(deadline);

CREATE INDEX idx_chat_messages_project_user
    ON chat_messages(project_id, user_id);

COMMIT;
